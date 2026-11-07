import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext } from '../_shared/stripe.ts';
import { dispatchBookingPushEvent } from '../_shared/webpush.ts';

async function finalizeConfirmedBooking(
  supabase: any,
  booking: any,
  resolvedPi: any,
  applicationFeePercent: number
) {
  const paidAmountBRL = ((resolvedPi?.amount_received || resolvedPi?.amount || 0) / 100);
  const finalPaid = paidAmountBRL > 0 ? paidAmountBRL : Number(booking.amount_paid || 0);
  const finalDue = Math.max(0, Number(booking.amount_total || 0) - finalPaid);
  const primaryPaymentStatus = booking.payment_mode === 'deposit' ? 'partial_paid' : 'paid';

  const { error: upErr } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: primaryPaymentStatus,
      amount_paid: finalPaid,
      amount_due: finalDue,
    })
    .eq('id', booking.id);

  if (upErr) {
    // Fallback caso o banco tenha constraint apenas para 'full_paid'
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: booking.payment_mode === 'deposit' ? 'partial_paid' : 'full_paid',
        amount_paid: finalPaid,
        amount_due: finalDue,
      })
      .eq('id', booking.id);
  }

  if (resolvedPi?.id) {
    const methodTypes: string[] = Array.isArray(resolvedPi.payment_method_types)
      ? resolvedPi.payment_method_types
      : [];
    const detectedMethod =
      resolvedPi?.metadata?.payment_method_type ||
      (methodTypes.includes('pix') && !methodTypes.includes('card') ? 'pix' : methodTypes[0] || 'pix');

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', resolvedPi.id)
      .maybeSingle();

    const paymentStatus = resolvedPi.status === 'succeeded' ? 'succeeded' : 'pending';

    if (existingPayment?.id) {
      await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          payment_method: detectedMethod,
          amount: finalPaid,
        })
        .eq('id', existingPayment.id);
    } else {
      const feePct = (typeof applicationFeePercent === 'number' && !isNaN(applicationFeePercent) ? applicationFeePercent : 0) / 100;
      const feeBRL = Number((finalPaid * feePct).toFixed(2));
      await supabase.from('payments').insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        stripe_payment_intent_id: resolvedPi.id,
        amount: finalPaid,
        platform_fee: feeBRL,
        net_amount: Math.max(0, finalPaid - feeBRL),
        payment_method: detectedMethod,
        status: paymentStatus,
      });
    }
  }

  // Dispara Web Push após confirmação do pagamento do agendamento no banco (com deduplicação)
  await dispatchBookingPushEvent(supabase, booking.id, 'booking_new').catch(() => {});
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'create';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stripe, mode, publishableKey, applicationFeePercent } = await getStripeContext(supabase);

    // ── AÇÃO 0: Consultar status do PIX em tempo real (polling sem erro quando ainda aguardando) ─
    if (action === 'check_pix_status') {
      const { bookingId, paymentIntentId } = body;
      if (!paymentIntentId) {
        throw new Error("paymentIntentId é obrigatório para consultar o status do PIX.");
      }

      const resolvedPi = await stripe.paymentIntents.retrieve(paymentIntentId);
      const resolvedBookingId = bookingId || resolvedPi?.metadata?.booking_id;

      if (resolvedPi.status === 'succeeded' || resolvedPi.status === 'processing') {
        if (resolvedBookingId) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
            .eq('id', resolvedBookingId)
            .maybeSingle();

          if (booking) {
            await finalizeConfirmedBooking(supabase, booking, resolvedPi, applicationFeePercent);

            return new Response(
              JSON.stringify({
                confirmed: true,
                bookingId: booking.id,
                order_number: booking.order_number,
                status: resolvedPi.status,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({
            confirmed: true,
            status: resolvedPi.status,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          confirmed: false,
          status: resolvedPi.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO 1: Confirmar agendamento após pagamento aprovado no Stripe ──────────
    if (action === 'confirm_booking') {
      const { bookingId, paymentIntentId, sessionId } = body;

      let resolvedPi: any = null;
      let resolvedBookingId = bookingId;

      if (paymentIntentId) {
        resolvedPi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (!resolvedBookingId && resolvedPi?.metadata?.booking_id) {
          resolvedBookingId = resolvedPi.metadata.booking_id;
        }
      } else if (sessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!resolvedBookingId && session?.metadata?.booking_id) {
          resolvedBookingId = session.metadata.booking_id;
        }
        const piId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any)?.id;
        if (piId) {
          resolvedPi = await stripe.paymentIntents.retrieve(piId);
        }
      }

      if (!resolvedBookingId) {
        throw new Error("Agendamento não identificado para confirmação.");
      }

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
        .eq('id', resolvedBookingId)
        .maybeSingle();

      if (!booking) {
        throw new Error("Agendamento não encontrado.");
      }

      if (resolvedPi) {
        if (resolvedPi.status !== 'succeeded' && resolvedPi.status !== 'processing') {
          throw new Error(`O pagamento no Stripe ainda não foi concluído (status: ${resolvedPi.status}).`);
        }

        await finalizeConfirmedBooking(supabase, booking, resolvedPi, applicationFeePercent);
      }

      return new Response(
        JSON.stringify({
          confirmed: true,
          bookingId: booking.id,
          order_number: booking.order_number,
          status: resolvedPi?.status || 'succeeded',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO 2: Abortar/limpar agendamento pendente quando pagamento falha ou é fechado ─
    if (action === 'abort_booking') {
      const { bookingId, paymentIntentId } = body;

      // Proteção: se o cliente já tiver pago o PIX no banco antes de fechar o modal, confirma em vez de abortar!
      if (paymentIntentId) {
        try {
          const checkPi = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (checkPi.status === 'succeeded' || checkPi.status === 'processing') {
            const targetBookingId = bookingId || checkPi?.metadata?.booking_id;
            if (targetBookingId) {
              const { data: paidBk } = await supabase
                .from('bookings')
                .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
                .eq('id', targetBookingId)
                .maybeSingle();
              if (paidBk) {
                await finalizeConfirmedBooking(supabase, paidBk, checkPi, applicationFeePercent);
                return new Response(
                  JSON.stringify({
                    aborted: false,
                    confirmed: true,
                    bookingId: paidBk.id,
                    order_number: paidBk.order_number,
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }
          await stripe.paymentIntents.cancel(paymentIntentId);
        } catch (_) {}
        await supabase.from('payments').delete().eq('stripe_payment_intent_id', paymentIntentId).eq('status', 'pending');
      }

      if (bookingId) {
        const { data: bk } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('id', bookingId)
          .maybeSingle();

        if (bk && bk.status === 'pending') {
          await supabase.from('payments').delete().eq('booking_id', bookingId).eq('status', 'pending');
          await supabase.from('bookings').delete().eq('id', bookingId).eq('status', 'pending');
        }
      }

      return new Response(
        JSON.stringify({ aborted: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO 3 (Padrão): Criar PaymentIntent Real no Stripe Live/Test para o Booking ─
    const { bookingId, paymentMethodType, customerName, customerEmail, customerPhone } = body;
    if (!bookingId) {
      throw new Error("bookingId é obrigatório para iniciar o pagamento.");
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, tenants(name), services(name, price)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error("Agendamento não encontrado.");
    }

    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('tenant_id', booking.tenant_id)
      .single();

    if (!connectAccount || !connectAccount.stripe_account_id) {
      throw new Error("O salão ainda não conectou sua conta de pagamentos online. Por favor, escolha 'Pagar no local'.");
    }

    // Validar conta Connect no ambiente Stripe atual e garantir pix_payments solicitado
    try {
      const acc = await stripe.accounts.retrieve(connectAccount.stripe_account_id);
      if (!acc.charges_enabled) {
        throw new Error("A conta de recebimento do salão ainda está em verificação no Stripe. Por favor, escolha 'Pagar no local'.");
      }
      if ((acc.capabilities as any)?.pix_payments === 'unrequested') {
        try {
          await stripe.accounts.updateCapability(connectAccount.stripe_account_id, 'pix_payments' as any, { requested: true });
        } catch (_) {}
      }
    } catch (accErr: any) {
      console.warn(`[create-payment-intent] Conta Connect '${connectAccount.stripe_account_id}' inválida no ambiente ${mode.toUpperCase()}:`, accErr?.message);
      throw new Error("Os pagamentos online deste salão ainda não foram ativados no ambiente atual. Por favor, escolha 'Pagar no local'.");
    }

    const amountTotal = Number(booking.amount_total);
    const amountToCharge = booking.payment_mode === 'deposit' ? Number(booking.amount_paid) : amountTotal;

    if (amountToCharge <= 0) {
      throw new Error("Valor a cobrar inválido.");
    }

    const amountCents = Math.round(amountToCharge * 100);
    if (amountCents < 50) {
      throw new Error("O valor mínimo para pagamento online no Stripe é de R$ 0,50.");
    }

    const platformFeePercentage = (typeof applicationFeePercent === 'number' && !isNaN(applicationFeePercent) ? applicationFeePercent : 0) / 100;
    const applicationFeeAmount = Math.round(amountCents * platformFeePercentage);

    const serviceName = (booking.services as any)?.name || 'Serviço';
    const salonName = (booking.tenants as any)?.name || 'Salão';
    const description = booking.payment_mode === 'deposit'
      ? `Sinal/Entrada (#${booking.order_number}) - ${serviceName} em ${salonName}`
      : `Agendamento (#${booking.order_number}) - ${serviceName} em ${salonName}`;

    const cleanDigits = String(customerPhone || '').replace(/\D/g, '') || 'cliente';
    const safeEmail =
      customerEmail && String(customerEmail).trim().includes('@')
        ? String(customerEmail).trim()
        : `cliente.${cleanDigits}@navalha.app`;
    const safeName = String(customerName || 'Cliente Navalha').trim() || 'Cliente Navalha';

    const resolvedMethodLabel = paymentMethodType === 'card' ? 'card' : 'pix';

    const buildPiParams = (paymentMethods: string[], confirmPixNow = false) => ({
      amount: amountCents,
      currency: 'brl',
      payment_method_types: paymentMethods,
      description,
      on_behalf_of: connectAccount.stripe_account_id,
      ...(applicationFeeAmount > 0 ? { application_fee_amount: applicationFeeAmount } : {}),
      transfer_data: {
        destination: connectAccount.stripe_account_id,
      },
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        order_number: booking.order_number,
        payment_method_type: resolvedMethodLabel,
      },
      ...(confirmPixNow
        ? {
            confirm: true,
            payment_method_data: {
              type: 'pix',
              billing_details: {
                name: safeName,
                email: safeEmail,
              },
            },
          }
        : {}),
    });

    let paymentIntent: any;
    let pixQrData: any = null;

    if (paymentMethodType === 'pix') {
      paymentIntent = await stripe.paymentIntents.create(buildPiParams(['pix'], true));
      pixQrData = paymentIntent?.next_action?.pix_display_qr_code || null;
    } else if (paymentMethodType === 'card') {
      paymentIntent = await stripe.paymentIntents.create(buildPiParams(['card'], false));
    } else {
      try {
        paymentIntent = await stripe.paymentIntents.create(buildPiParams(['card', 'pix'], false));
      } catch (pixErr: any) {
        if (pixErr?.message?.toLowerCase().includes('pix')) {
          console.warn("[create-payment-intent] PIX não habilitado para esta conta Connect, usando Cartão:", pixErr.message);
          paymentIntent = await stripe.paymentIntents.create(buildPiParams(['card'], false));
        } else {
          throw pixErr;
        }
      }
    }

    // Registrar pagamento pendente na tabela payments com payment_method preenchido
    await supabase.from('payments').insert({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount: amountToCharge,
      platform_fee: applicationFeeAmount / 100,
      net_amount: amountToCharge - (applicationFeeAmount / 100),
      payment_method: resolvedMethodLabel,
      status: 'pending',
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentMethodTypes: paymentIntent.payment_method_types,
        pixQrData,
        amountToCharge,
        publishableKey,
        mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("create-payment-intent error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
