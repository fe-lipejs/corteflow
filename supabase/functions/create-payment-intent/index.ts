import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getMercadoPagoContext,
  getTenantMercadoPagoAccount,
  refreshTenantMercadoPagoToken,
  mpRequest,
} from '../_shared/stripe.ts';
import { dispatchBookingPushEvent } from '../_shared/webpush.ts';

async function finalizeConfirmedBooking(
  supabase: any,
  booking: any,
  mpPayment: any,
  collectorId: string | null,
  applicationFeePercent: number
) {
  const wasAlreadyConfirmed = booking.status === 'confirmed';
  const expectedAmount =
    booking.payment_mode === 'deposit'
      ? Number(booking.amount_paid || 0)
      : Number(booking.amount_total || 0);
  const paidAmountBRL = Number(mpPayment?.transaction_amount || 0);

  if (expectedAmount > 0 && paidAmountBRL > 0 && paidAmountBRL + 0.05 < expectedAmount) {
    throw new Error(
      `Valor pago no Mercado Pago (R$ ${paidAmountBRL.toFixed(2)}) inferior ao exigido para a reserva (R$ ${expectedAmount.toFixed(2)}).`
    );
  }

  const finalPaid = paidAmountBRL > 0 ? paidAmountBRL : Number(booking.amount_paid || 0);
  const finalDue = Math.max(0, Number(booking.amount_total || 0) - finalPaid);
  const primaryPaymentStatus = booking.payment_mode === 'deposit' ? 'partial_paid' : 'paid';

  const detectedMethod =
    mpPayment?.payment_method_id === 'pix' || mpPayment?.metadata?.payment_method_type === 'pix'
      ? 'pix'
      : 'card';

  const { error: upErr } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: primaryPaymentStatus,
      payment_method: detectedMethod,
      amount_paid: finalPaid,
      amount_due: finalDue,
    })
    .eq('id', booking.id);

  if (upErr) {
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: booking.payment_mode === 'deposit' ? 'partial_paid' : 'full_paid',
        payment_method: detectedMethod,
        amount_paid: finalPaid,
        amount_due: finalDue,
      })
      .eq('id', booking.id);
  }

  const mpPayId = mpPayment?.id ? String(mpPayment.id) : null;
  if (mpPayId) {
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .or(`mp_payment_id.eq.${mpPayId},stripe_payment_intent_id.eq.${mpPayId},booking_id.eq.${booking.id}`)
      .limit(1)
      .maybeSingle();

    const paymentStatus = mpPayment.status === 'approved' ? 'succeeded' : 'pending';
    const feeAmount =
      mpPayment.fee_details?.find?.((f: any) => f.type === 'application_fee')?.amount ??
      Number(((finalPaid * (applicationFeePercent || 0)) / 100).toFixed(2));

    if (existingPayment?.id) {
      await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          payment_method: detectedMethod,
          amount: finalPaid,
          mp_payment_id: mpPayId,
          mp_collector_id: collectorId,
          stripe_payment_intent_id: mpPayId,
          platform_fee: Number(feeAmount || 0),
          net_amount: Math.max(0, finalPaid - Number(feeAmount || 0)),
        })
        .eq('id', existingPayment.id);
    } else {
      await supabase.from('payments').insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        stripe_payment_intent_id: mpPayId,
        mp_payment_id: mpPayId,
        mp_collector_id: collectorId,
        amount: finalPaid,
        platform_fee: Number(feeAmount || 0),
        net_amount: Math.max(0, finalPaid - Number(feeAmount || 0)),
        payment_method: detectedMethod,
        status: paymentStatus,
      });
    }
  }

  if (!wasAlreadyConfirmed) {
    await dispatchBookingPushEvent(supabase, booking.id, 'booking_new').catch(() => {});
  }
}

async function resolveMercadoPagoPaymentForBooking(
  accessToken: string,
  paymentIdOrPref?: string | null,
  bookingId?: string | null
) {
  if (paymentIdOrPref && /^\d+$/.test(String(paymentIdOrPref).trim())) {
    try {
      const payment = await mpRequest<any>(`/v1/payments/${String(paymentIdOrPref).trim()}`, accessToken, {
        method: 'GET',
      });
      if (payment?.id) return payment;
    } catch (_) {}
  }

  if (bookingId) {
    try {
      const searchRes = await mpRequest<any>(
        `/v1/payments/search?external_reference=${encodeURIComponent(bookingId)}&sort=date_created&criteria=desc&limit=5`,
        accessToken,
        { method: 'GET' }
      );
      const list: any[] = searchRes?.results || [];
      const approved = list.find((p) => p.status === 'approved');
      if (approved) return approved;
      if (list[0]) return list[0];
    } catch (_) {}
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const [body, mpContext] = await Promise.all([
      req.json().catch(() => ({})),
      getMercadoPagoContext(supabase),
    ]);
    const action = body.action || 'create';

    // ── AÇÃO 0: Consultar status do PIX ou Cartão no Mercado Pago do salão ───
    if (action === 'check_pix_status') {
      const { bookingId, paymentIntentId } = body;
      if (!paymentIntentId && !bookingId) {
        throw new Error("paymentIntentId ou bookingId é obrigatório para consultar o pagamento.");
      }

      let resolvedBookingId = bookingId;
      let resolvedTenantId: string | null = null;

      if (resolvedBookingId) {
        const { data: bk } = await supabase
          .from('bookings')
          .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
          .eq('id', resolvedBookingId)
          .maybeSingle();
        if (bk) {
          resolvedTenantId = bk.tenant_id;
          if (bk.status === 'confirmed') {
            return new Response(
              JSON.stringify({
                confirmed: true,
                bookingId: bk.id,
                order_number: bk.order_number,
                status: 'succeeded',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      if (!resolvedTenantId && paymentIntentId) {
        const { data: payRow } = await supabase
          .from('payments')
          .select('tenant_id, booking_id')
          .or(`mp_payment_id.eq.${paymentIntentId},stripe_payment_intent_id.eq.${paymentIntentId},mp_preference_id.eq.${paymentIntentId}`)
          .limit(1)
          .maybeSingle();
        if (payRow) {
          resolvedTenantId = payRow.tenant_id;
          if (!resolvedBookingId) resolvedBookingId = payRow.booking_id;
        }
      }

      if (!resolvedTenantId) {
        return new Response(
          JSON.stringify({ confirmed: false, status: 'pending' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenantMp = await getTenantMercadoPagoAccount(supabase, resolvedTenantId, mpContext);
      if (!tenantMp) {
        return new Response(
          JSON.stringify({ confirmed: false, status: 'pending' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let mpPayment = await resolveMercadoPagoPaymentForBooking(
        tenantMp.accessToken,
        paymentIntentId,
        resolvedBookingId
      );

      if (!mpPayment && !tenantMp.isTestUser) {
        const refreshedTok = await refreshTenantMercadoPagoToken(supabase, resolvedTenantId, mpContext);
        if (refreshedTok) {
          mpPayment = await resolveMercadoPagoPaymentForBooking(
            refreshedTok,
            paymentIntentId,
            resolvedBookingId
          );
        }
      }

      if (
        !mpPayment &&
        (mpContext.mode === 'test' || tenantMp.isTestUser) &&
        mpContext.testAccessToken &&
        mpContext.testAccessToken !== tenantMp.accessToken
      ) {
        mpPayment = await resolveMercadoPagoPaymentForBooking(
          mpContext.testAccessToken,
          paymentIntentId,
          resolvedBookingId
        );
      }

      if (
        mpPayment &&
        mpContext.mode === 'live' &&
        mpPayment.live_mode === false &&
        !tenantMp.isTestUser
      ) {
        mpPayment = null;
      }

      if (mpPayment && mpPayment.status === 'approved') {
        const targetBookingId = resolvedBookingId || mpPayment.metadata?.booking_id || mpPayment.external_reference;
        if (targetBookingId) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
            .eq('id', targetBookingId)
            .maybeSingle();

          if (booking) {
            await finalizeConfirmedBooking(
              supabase,
              booking,
              mpPayment,
              tenantMp.mpUserId,
              mpContext.applicationFeePercent
            );
            return new Response(
              JSON.stringify({
                confirmed: true,
                bookingId: booking.id,
                order_number: booking.order_number,
                status: 'succeeded',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ confirmed: true, status: 'succeeded' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          confirmed: false,
          status: mpPayment?.status || 'pending',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO 1: Confirmar agendamento após retorno do Checkout Pro ──────────
    if (action === 'confirm_booking') {
      const { bookingId, paymentIntentId, sessionId } = body;
      const lookupId = paymentIntentId || sessionId;
      let resolvedBookingId = bookingId;

      if (!resolvedBookingId && lookupId) {
        const { data: payRow } = await supabase
          .from('payments')
          .select('booking_id')
          .or(`mp_payment_id.eq.${lookupId},stripe_payment_intent_id.eq.${lookupId},mp_preference_id.eq.${lookupId}`)
          .limit(1)
          .maybeSingle();
        if (payRow?.booking_id) resolvedBookingId = payRow.booking_id;
      }

      if (!resolvedBookingId) {
        throw new Error("Agendamento não identificado para confirmação.");
      }

      const { data: booking } = await supabase
        .from('bookings')
        .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
        .eq('id', resolvedBookingId)
        .maybeSingle();

      if (!booking) throw new Error("Agendamento não encontrado.");

      const tenantMp = await getTenantMercadoPagoAccount(supabase, booking.tenant_id, mpContext);
      if (!tenantMp) {
        return new Response(
          JSON.stringify({ confirmed: false, error: "Conta Mercado Pago do salão não encontrada." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (booking.status === 'confirmed') {
        return new Response(
          JSON.stringify({
            confirmed: true,
            bookingId: booking.id,
            order_number: booking.order_number,
            status: 'succeeded',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let mpPayment = await resolveMercadoPagoPaymentForBooking(
        tenantMp.accessToken,
        lookupId,
        booking.id
      );

      if (!mpPayment && !tenantMp.isTestUser) {
        const refreshedTok = await refreshTenantMercadoPagoToken(supabase, booking.tenant_id, mpContext);
        if (refreshedTok) {
          mpPayment = await resolveMercadoPagoPaymentForBooking(
            refreshedTok,
            lookupId,
            booking.id
          );
        }
      }

      if (
        !mpPayment &&
        (mpContext.mode === 'test' || tenantMp.isTestUser) &&
        mpContext.testAccessToken &&
        mpContext.testAccessToken !== tenantMp.accessToken
      ) {
        mpPayment = await resolveMercadoPagoPaymentForBooking(
          mpContext.testAccessToken,
          lookupId,
          booking.id
        );
      }

      if (
        mpPayment &&
        mpContext.mode === 'live' &&
        mpPayment.live_mode === false &&
        !tenantMp.isTestUser
      ) {
        mpPayment = null;
      }

      if (!mpPayment || mpPayment.status !== 'approved') {
        return new Response(
          JSON.stringify({
            confirmed: false,
            status: mpPayment?.status || 'pending',
            error: !mpPayment
              ? 'Pagamento não identificado ou cancelado no Mercado Pago.'
              : `Pagamento não aprovado (status: ${mpPayment.status}).`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await finalizeConfirmedBooking(
        supabase,
        booking,
        mpPayment,
        tenantMp.mpUserId,
        mpContext.applicationFeePercent
      );

      return new Response(
        JSON.stringify({
          confirmed: true,
          bookingId: booking.id,
          order_number: booking.order_number,
          status: 'succeeded',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── AÇÃO 2: Abortar agendamento pendente se cliente fechar antes de pagar ─
    if (action === 'abort_booking') {
      const { bookingId, paymentIntentId } = body;

      let tenantIdForLookup: string | null = null;
      if (bookingId) {
        const { data: bk } = await supabase
          .from('bookings')
          .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
          .eq('id', bookingId)
          .maybeSingle();
        if (bk) tenantIdForLookup = bk.tenant_id;
      }

      if (paymentIntentId && tenantIdForLookup) {
        const tenantMp = await getTenantMercadoPagoAccount(supabase, tenantIdForLookup, mpContext);
        if (tenantMp) {
          try {
            const mpPayment = await resolveMercadoPagoPaymentForBooking(
              tenantMp.accessToken,
              paymentIntentId,
              bookingId
            );
            if (mpPayment?.status === 'approved') {
              const { data: paidBk } = await supabase
                .from('bookings')
                .select('id, tenant_id, order_number, status, payment_mode, amount_total, amount_paid')
                .eq('id', bookingId)
                .maybeSingle();
              if (paidBk) {
                await finalizeConfirmedBooking(
                  supabase,
                  paidBk,
                  mpPayment,
                  tenantMp.mpUserId,
                  mpContext.applicationFeePercent
                );
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
            if (/^\d+$/.test(String(paymentIntentId))) {
              await mpRequest(`/v1/payments/${paymentIntentId}`, tenantMp.accessToken, {
                method: 'PUT',
                body: { status: 'cancelled' },
              }).catch(() => {});
            }
          } catch (_) {}
        }
        await supabase
          .from('payments')
          .delete()
          .or(`mp_payment_id.eq.${paymentIntentId},stripe_payment_intent_id.eq.${paymentIntentId}`)
          .eq('status', 'pending');
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

    // ── AÇÃO 3 (Padrão): Criar pagamento Pix (QR Code) ou Cartão (Checkout MP) direto na conta do salão ─
    const { bookingId, tenantId: bodyTenantId, paymentMethodType, customerName, customerEmail, customerPhone, returnUrl } = body;
    if (!bookingId) {
      throw new Error("bookingId é obrigatório para iniciar o pagamento.");
    }

    const [{ data: booking }, prefetchedTenantMp] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, tenants(name), services(name, price)')
        .eq('id', bookingId)
        .single(),
      bodyTenantId
        ? getTenantMercadoPagoAccount(supabase, bodyTenantId, mpContext)
        : Promise.resolve(null),
    ]);

    if (!booking) {
      throw new Error("Agendamento não encontrado.");
    }

    const tenantMp = prefetchedTenantMp || (await getTenantMercadoPagoAccount(supabase, booking.tenant_id, mpContext));
    if (!tenantMp || !tenantMp.chargesEnabled) {
      throw new Error("O salão ainda não conectou sua conta Mercado Pago. Por favor, escolha 'Pagar no local'.");
    }

    const amountTotal = Number(booking.amount_total);
    const amountToCharge = Number(
      (booking.payment_mode === 'deposit' ? Number(booking.amount_paid) : amountTotal).toFixed(2)
    );

    if (amountToCharge < 0.5) {
      throw new Error("O valor mínimo para pagamento online no Mercado Pago é de R$ 0,50.");
    }

    // Application fee só pode ser enviado quando a conta foi conectada via OAuth (Marketplace)
    // e precisa ser estritamente menor que o valor cobrado
    const rawFeeBRL =
      tenantMp.isOAuth && mpContext.applicationFeePercent > 0
        ? Number(((amountToCharge * mpContext.applicationFeePercent) / 100).toFixed(2))
        : 0;
    const applicationFeeBRL =
      rawFeeBRL > 0 && rawFeeBRL < amountToCharge && !tenantMp.isTestUser
        ? rawFeeBRL
        : 0;

    const serviceName = (booking.services as any)?.name || 'Serviço';
    const salonName = (booking.tenants as any)?.name || 'Salão';
    const description = booking.payment_mode === 'deposit'
      ? `Sinal/Entrada (#${booking.order_number}) - ${serviceName} em ${salonName}`
      : `Agendamento (#${booking.order_number}) - ${serviceName} em ${salonName}`;

    const cleanDigits = String(customerPhone || '').replace(/\D/g, '') || 'cliente';
    const safeEmail =
      customerEmail && String(customerEmail).trim().includes('@')
        ? String(customerEmail).trim()
        : `cliente.${cleanDigits}@raffros.com`;
    const safeName = String(customerName || 'Cliente Raffros').trim() || 'Cliente Raffros';
    const nameParts = safeName.split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Raffros';

    const notificationUrl = `${supabaseUrl}/functions/v1/stripe-webhook?tenant_id=${booking.tenant_id}`;

    // ── PIX Transparente na própria tela ────────────────────────────────────
    if (paymentMethodType === 'pix') {
      const mpPaymentBody: Record<string, any> = {
        transaction_amount: amountToCharge,
        description,
        payment_method_id: 'pix',
        external_reference: booking.id,
        notification_url: notificationUrl,
        payer: {
          email: safeEmail,
          first_name: firstName,
          last_name: lastName,
        },
        metadata: {
          type: 'booking',
          booking_id: booking.id,
          tenant_id: booking.tenant_id,
          order_number: booking.order_number,
          payment_method_type: 'pix',
        },
      };

      if (applicationFeeBRL > 0 && !tenantMp.isTestUser) {
        mpPaymentBody.application_fee = applicationFeeBRL;
      }

      const pixAccessToken =
        tenantMp.isTestUser && mpContext.testAccessToken
          ? mpContext.testAccessToken
          : tenantMp.accessToken;

      let mpPayment: any;
      try {
        mpPayment = await mpRequest<any>('/v1/payments', pixAccessToken, {
          method: 'POST',
          body: mpPaymentBody,
          idempotencyKey: `booking-pix-${booking.id}-${Date.now()}`,
        });
      } catch (pixErr: any) {
        const errMsg = String(pixErr?.message || '');
        if (errMsg.includes('unauthorized') || errMsg.includes('401')) {
          const refreshedTok = await refreshTenantMercadoPagoToken(supabase, booking.tenant_id, mpContext);
          if (refreshedTok && !tenantMp.isTestUser) {
            mpPayment = await mpRequest<any>('/v1/payments', refreshedTok, {
              method: 'POST',
              body: mpPaymentBody,
              idempotencyKey: `booking-pix-rf-${booking.id}-${Date.now()}`,
            });
          } else {
            throw pixErr;
          }
        } else if (
          (mpContext.mode === 'test' || tenantMp.isTestUser) &&
          errMsg.includes('user_allowed_only_in_test') &&
          mpContext.testAccessToken &&
          mpContext.testAccessToken !== pixAccessToken
        ) {
          delete mpPaymentBody.application_fee;
          mpPayment = await mpRequest<any>('/v1/payments', mpContext.testAccessToken, {
            method: 'POST',
            body: mpPaymentBody,
            idempotencyKey: `booking-pix-fb-${booking.id}-${Date.now()}`,
          });
        } else {
          throw pixErr;
        }
      }

      const txData = mpPayment?.point_of_interaction?.transaction_data || {};
      const pixQrData = txData.qr_code
        ? {
            data: txData.qr_code,
            image_url_png: txData.qr_code_base64
              ? `data:image/png;base64,${txData.qr_code_base64}`
              : undefined,
            hosted_instructions_url: txData.ticket_url || undefined,
          }
        : null;

      if (!pixQrData) {
        throw new Error("O Mercado Pago não retornou o código Pix para esta conta. Verifique se há uma chave Pix cadastrada na conta Mercado Pago do salão.");
      }

      const mpPayId = String(mpPayment.id);

      await supabase.from('payments').insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        stripe_payment_intent_id: mpPayId,
        mp_payment_id: mpPayId,
        mp_collector_id: tenantMp.mpUserId,
        amount: amountToCharge,
        platform_fee: applicationFeeBRL,
        net_amount: Math.max(0, amountToCharge - applicationFeeBRL),
        payment_method: 'pix',
        status: 'pending',
      });

      return new Response(
        JSON.stringify({
          provider: 'mercado_pago',
          clientSecret: mpPayId,
          paymentIntentId: mpPayId,
          paymentMethodTypes: ['pix'],
          pixQrData,
          amountToCharge,
          bookingId: booking.id,
          orderNumber: booking.order_number,
          mode: mpContext.mode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Cartão / Checkout Mercado Pago ───────────────────────────────────────
    let safeReturnUrl = returnUrl || '';
    if (!safeReturnUrl.startsWith('http://') && !safeReturnUrl.startsWith('https://')) {
      const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://raffros.com';
      const cleanOrigin = origin.replace(/\/$/, '');
      safeReturnUrl = `${cleanOrigin}${safeReturnUrl.startsWith('/') ? '' : '/'}${safeReturnUrl}`;
    }
    const baseReturnUrl = safeReturnUrl.split('?')[0];
    const successUrl = `${baseReturnUrl}?order=${booking.order_number}&booking_id=${booking.id}`;
    const pendingUrl = `${baseReturnUrl}?order=${booking.order_number}&booking_id=${booking.id}&mp_pending=true`;
    const failureUrl = `${baseReturnUrl}?cancel=true&booking_id=${booking.id}`;

    const prefBody: Record<string, any> = {
      items: [
        {
          id: booking.service_id || booking.id,
          title: `${serviceName} - ${salonName}`,
          description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amountToCharge,
        },
      ],
      ...(mpContext.mode === 'test' || tenantMp.isTestUser
        ? {}
        : { payer: { name: safeName, email: safeEmail } }),
      payment_methods: {
        // Na escolha de Cartão de Crédito, bloqueia Boleto, Lotérica e segunda via de Pix
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
          { id: 'bank_transfer' },
        ],
        excluded_payment_methods: [
          { id: 'bolbradesco' },
          { id: 'meliplace' },
          { id: 'pec' },
        ],
      },
      external_reference: booking.id,
      notification_url: notificationUrl,
      back_urls: {
        success: successUrl,
        pending: pendingUrl,
        failure: failureUrl,
      },
      statement_descriptor: salonName.slice(0, 22),
      metadata: {
        type: 'booking',
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        order_number: booking.order_number,
        payment_method_type: 'card',
      },
    };

    if (successUrl.startsWith('https://') && !successUrl.includes('localhost') && !successUrl.includes('127.0.0.1')) {
      prefBody.auto_return = 'approved';
    }

    if (applicationFeeBRL > 0 && !tenantMp.isTestUser) {
      prefBody.marketplace_fee = applicationFeeBRL;
    }

    let pref: any;
    let activeCardToken = tenantMp.accessToken;
    try {
      pref = await mpRequest<any>('/checkout/preferences', activeCardToken, {
        method: 'POST',
        body: prefBody,
      });
    } catch (prefErr: any) {
      const errMsg = String(prefErr?.message || '');
      if (errMsg.includes('unauthorized') || errMsg.includes('401') || errMsg.includes('invalid')) {
        const refreshedTok = await refreshTenantMercadoPagoToken(supabase, booking.tenant_id, mpContext);
        if (refreshedTok) {
          activeCardToken = refreshedTok;
          pref = await mpRequest<any>('/checkout/preferences', activeCardToken, {
            method: 'POST',
            body: prefBody,
          });
        } else if (
          (mpContext.mode === 'test' || tenantMp.isTestUser) &&
          mpContext.testAccessToken &&
          mpContext.testAccessToken !== activeCardToken
        ) {
          delete prefBody.marketplace_fee;
          delete prefBody.payer;
          pref = await mpRequest<any>('/checkout/preferences', mpContext.testAccessToken, {
            method: 'POST',
            body: prefBody,
          });
        } else {
          throw prefErr;
        }
      } else {
        throw prefErr;
      }
    }

    // Mercado Pago Checkout Pro moderno utiliza sempre `init_point` (inclusive para contas de teste);
    // usar `sandbox_init_point` dispara o erro "Uma das partes é de teste".
    const checkoutUrl = pref.init_point || pref.sandbox_init_point;

    await supabase.from('payments').insert({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      stripe_payment_intent_id: pref.id,
      mp_preference_id: pref.id,
      mp_collector_id: tenantMp.mpUserId,
      amount: amountToCharge,
      platform_fee: applicationFeeBRL,
      net_amount: Math.max(0, amountToCharge - applicationFeeBRL),
      payment_method: 'card',
      status: 'pending',
    });

    return new Response(
      JSON.stringify({
        provider: 'mercado_pago',
        checkoutUrl,
        clientSecret: pref.id,
        paymentIntentId: pref.id,
        paymentMethodTypes: ['card', 'pix'],
        pixQrData: null,
        amountToCharge,
        bookingId: booking.id,
        orderNumber: booking.order_number,
        mode: mpContext.mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("create-payment-intent (MP) error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
