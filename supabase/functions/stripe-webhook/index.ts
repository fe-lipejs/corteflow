import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getMercadoPagoContext,
  getTenantMercadoPagoAccount,
  mpRequest,
  preserveCustomContractAndPricing,
} from '../_shared/stripe.ts';
import { dispatchBookingPushEvent } from '../_shared/webpush.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const reqUrl = new URL(req.url);
    const tenantIdFromQuery = reqUrl.searchParams.get('tenant_id');
    const topicFromQuery = reqUrl.searchParams.get('topic') || reqUrl.searchParams.get('type') || '';
    const idFromQuery = reqUrl.searchParams.get('data.id') || reqUrl.searchParams.get('id') || '';

    const rawText = await req.text().catch(() => '');
    let payload: any = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    const eventType = payload?.type || payload?.topic || topicFromQuery || '';
    const resourceId = payload?.data?.id || idFromQuery || payload?.id || '';

    console.log(`[mp-webhook] Recebido type=${eventType} id=${resourceId} tenantQuery=${tenantIdFromQuery || '-'}`);

    // Aceita apenas notificações de pagamento por enquanto (retorna 200 para outras para evitar retries infinitos)
    if (!resourceId || (eventType && !['payment', 'payment.created', 'payment.updated'].includes(eventType))) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpContext = await getMercadoPagoContext(supabase);
    let mpPayment: any = null;
    let collectorIdForBooking: string | null = null;

    // 1. Se veio tenant_id na query string, é pagamento de agendamento direto para o salão
    if (tenantIdFromQuery) {
      const tenantMp = await getTenantMercadoPagoAccount(supabase, tenantIdFromQuery, mpContext);
      if (tenantMp) {
        collectorIdForBooking = tenantMp.mpUserId;
        mpPayment = await mpRequest<any>(`/v1/payments/${resourceId}`, tenantMp.accessToken, {
          method: 'GET',
        }).catch(() => null);
      }
    }

    // 2. Se não veio tenant_id ou ainda não encontrou, consulta usando o token da Plataforma Raffros
    if (!mpPayment && mpContext.accessToken) {
      mpPayment = await mpRequest<any>(`/v1/payments/${resourceId}`, mpContext.accessToken, {
        method: 'GET',
      }).catch(() => null);
    }

    if (!mpPayment) {
      console.warn(`[mp-webhook] Pagamento ${resourceId} não pôde ser consultado no Mercado Pago.`);
      return new Response(JSON.stringify({ received: true, not_found: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventKey = `mp_${mpPayment.id}_${mpPayment.status}`;
    const { data: existingEvent } = await supabase
      .from('billing_events')
      .select('id')
      .eq('stripe_event_id', eventKey)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let eventTenantId: string | null = tenantIdFromQuery || mpPayment.metadata?.tenant_id || null;

    // ─── CASO A: Pagamento de Agendamento (Cliente Final → Salão) ───────────
    const isBookingPayment =
      Boolean(tenantIdFromQuery) ||
      mpPayment.metadata?.type === 'booking' ||
      Boolean(mpPayment.metadata?.booking_id);

    if (isBookingPayment) {
      const bookingId = mpPayment.metadata?.booking_id || mpPayment.external_reference;
      if (bookingId && mpPayment.status === 'approved') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('id, tenant_id, payment_mode, amount_total, amount_paid')
          .eq('id', bookingId)
          .maybeSingle();

        if (booking) {
          eventTenantId = booking.tenant_id;
          const paidBRL = Number(mpPayment.transaction_amount || booking.amount_paid || booking.amount_total || 0);
          const dueBRL = Math.max(0, Number(booking.amount_total || 0) - paidBRL);
          const newPaymentStatus = booking.payment_mode === 'deposit' ? 'partial_paid' : 'paid';
          const detectedMethod = mpPayment.payment_method_id === 'pix' ? 'pix' : 'card';

          const { error: upErr } = await supabase
            .from('bookings')
            .update({
              status: 'confirmed',
              payment_status: newPaymentStatus,
              payment_method: detectedMethod,
              amount_paid: paidBRL,
              amount_due: dueBRL,
            })
            .eq('id', booking.id);

          if (upErr) {
            await supabase
              .from('bookings')
              .update({
                status: 'confirmed',
                payment_status: booking.payment_mode === 'deposit' ? 'partial_paid' : 'full_paid',
                payment_method: detectedMethod,
                amount_paid: paidBRL,
                amount_due: dueBRL,
              })
              .eq('id', booking.id);
          }

          const mpPayIdStr = String(mpPayment.id);
          const { data: existingPayment } = await supabase
            .from('payments')
            .select('id')
            .or(`mp_payment_id.eq.${mpPayIdStr},stripe_payment_intent_id.eq.${mpPayIdStr},booking_id.eq.${booking.id}`)
            .limit(1)
            .maybeSingle();

          const feeAmount =
            mpPayment.fee_details?.find?.((f: any) => f.type === 'application_fee')?.amount ?? 0;

          if (existingPayment?.id) {
            await supabase
              .from('payments')
              .update({
                status: 'succeeded',
                payment_method: detectedMethod,
                amount: paidBRL,
                mp_payment_id: mpPayIdStr,
                stripe_payment_intent_id: mpPayIdStr,
                mp_collector_id: collectorIdForBooking,
                platform_fee: Number(feeAmount || 0),
                net_amount: Math.max(0, paidBRL - Number(feeAmount || 0)),
              })
              .eq('id', existingPayment.id);
          } else {
            await supabase.from('payments').insert({
              tenant_id: booking.tenant_id,
              booking_id: booking.id,
              stripe_payment_intent_id: mpPayIdStr,
              mp_payment_id: mpPayIdStr,
              mp_collector_id: collectorIdForBooking,
              amount: paidBRL,
              platform_fee: Number(feeAmount || 0),
              net_amount: Math.max(0, paidBRL - Number(feeAmount || 0)),
              payment_method: detectedMethod,
              status: 'succeeded',
            });
          }

          await dispatchBookingPushEvent(supabase, booking.id, 'booking_new').catch(() => {});
        }
      }
    } else {
      // ─── CASO B: Assinatura Mensal do Salão (Salão → Plataforma Raffros) ──
      let tenantId = mpPayment.metadata?.tenant_id || null;
      let planId = mpPayment.metadata?.plan_id || null;

      if (typeof mpPayment.external_reference === 'string' && mpPayment.external_reference.startsWith('sub::')) {
        const parts = mpPayment.external_reference.split('::');
        if (parts[1]) tenantId = parts[1];
        if (parts[2]) planId = parts[2];
      }

      if (tenantId) {
        eventTenantId = tenantId;
      }

      if (tenantId && planId && mpPayment.status === 'approved') {
        const { data: prevSubData } = await supabase
          .from('subscriptions')
          .select('id, subscription_contracts(*)')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        const prevContract = Array.isArray(prevSubData?.subscription_contracts)
          ? prevSubData?.subscription_contracts[0]
          : prevSubData?.subscription_contracts;

        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const mpSubMarker = `mp_pay_${mpPayment.id}`;
        const mpCustomerMarker = mpPayment.payer?.id ? `mp_cust_${mpPayment.payer.id}` : null;

        await supabase.from('subscriptions').upsert({
          tenant_id: tenantId,
          plan_id: planId,
          stripe_subscription_id: mpSubMarker,
          stripe_customer_id: mpCustomerMarker,
          status: 'active',
          trial_ends_at: null,
          current_period_end: periodEnd,
          grace_period_ends_at: null,
          suspension_reason: null,
          canceled_at: null,
          latest_invoice_status: 'paid',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

        const paidCents = mpPayment.transaction_amount
          ? Math.round(Number(mpPayment.transaction_amount) * 100)
          : null;
        await preserveCustomContractAndPricing(supabase, tenantId, planId, prevContract, paidCents);

        await supabase.from('tenants').update({
          status: 'active',
          account_state: 'active',
          trial_ends_at: null,
          past_due_since: null,
          has_used_trial: true,
        }).eq('id', tenantId);
      }
    }

    await supabase.from('billing_events').insert({
      stripe_event_id: eventKey,
      type: `mp.${eventType || 'payment'}.${mpPayment.status}`,
      tenant_id: eventTenantId,
      payload: mpPayment,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[mp-webhook] Erro ao processar notificação:', err?.message);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
