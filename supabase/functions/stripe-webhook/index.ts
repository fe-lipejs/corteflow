import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getMercadoPagoContext,
  getTenantMercadoPagoAccount,
  refreshTenantMercadoPagoToken,
  mpRequest,
  preserveCustomContractAndPricing,
} from '../_shared/stripe.ts';
import { dispatchBookingPushEvent } from '../_shared/webpush.ts';

async function verifyMercadoPagoSignature(
  req: Request,
  webhookSecret: string,
  dataIdFromBodyOrQuery: string
): Promise<boolean> {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  // Se o Webhook v2 enviar x-signature e houver webhookSecret cadastrado, valida HMAC-SHA256
  if (!webhookSecret || !xSignature) return true;

  const parts = xSignature.split(',');
  let ts = '';
  let v1 = '';
  for (const part of parts) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k === 'ts' && v) ts = v;
    if (k === 'v1' && v) v1 = v;
  }
  if (!ts || !v1) return false;

  const normalizedId = /^[a-z0-9]+$/i.test(dataIdFromBodyOrQuery)
    ? dataIdFromBodyOrQuery.toLowerCase()
    : dataIdFromBodyOrQuery;

  const manifest = `id:${normalizedId};request-id:${xRequestId || ''};ts:${ts};`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === v1.toLowerCase();
}

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
    const resourceId = String(payload?.data?.id || idFromQuery || payload?.id || '').trim();

    console.log(`[mp-webhook] Recebido type=${eventType} id=${resourceId} tenantQuery=${tenantIdFromQuery || '-'}`);

    if (!resourceId || (eventType && !['payment', 'payment.created', 'payment.updated'].includes(eventType))) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpContext = await getMercadoPagoContext(supabase);

    const signatureValid = await verifyMercadoPagoSignature(
      req,
      mpContext.webhookSecret,
      idFromQuery || String(payload?.data?.id || resourceId)
    );
    if (!signatureValid) {
      console.warn(`[mp-webhook] Assinatura x-signature inválida para id=${resourceId}.`);
      return new Response(JSON.stringify({ error: 'Invalid Mercado Pago signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let mpPayment: any = null;
    let collectorIdForBooking: string | null = null;
    let tenantMpForBooking: Awaited<ReturnType<typeof getTenantMercadoPagoAccount>> = null;

    // 1. Pagamento de agendamento direto para o salão
    if (tenantIdFromQuery) {
      tenantMpForBooking = await getTenantMercadoPagoAccount(supabase, tenantIdFromQuery, mpContext);
      if (tenantMpForBooking) {
        collectorIdForBooking = tenantMpForBooking.mpUserId;
        try {
          mpPayment = await mpRequest<any>(`/v1/payments/${resourceId}`, tenantMpForBooking.accessToken, {
            method: 'GET',
          });
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid')) {
            const refreshedTok = await refreshTenantMercadoPagoToken(supabase, tenantIdFromQuery, mpContext);
            if (refreshedTok) {
              mpPayment = await mpRequest<any>(`/v1/payments/${resourceId}`, refreshedTok, {
                method: 'GET',
              }).catch(() => null);
            }
          }
        }
      }
    }

    // 2. Fallback para pagamento da Plataforma (Assinatura) ou conta teste do salão
    if (!mpPayment) {
      const platformTok =
        tenantMpForBooking?.isTestUser && mpContext.testAccessToken
          ? mpContext.testAccessToken
          : mpContext.accessToken;
      if (platformTok) {
        mpPayment = await mpRequest<any>(`/v1/payments/${resourceId}`, platformTok, {
          method: 'GET',
        }).catch(() => null);
      }
    }

    if (!mpPayment) {
      console.warn(`[mp-webhook] Pagamento ${resourceId} não pôde ser consultado no Mercado Pago.`);
      return new Response(JSON.stringify({ received: true, not_found: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Proteção de Produção Live: nunca aceita evento sandbox/teste se a plataforma está em LIVE
    // (exceto se o salão do agendamento estiver explicitamente marcado como conta TESTUSER)
    if (mpContext.mode === 'live' && mpPayment.live_mode === false && !tenantMpForBooking?.isTestUser) {
      console.warn(`[mp-webhook] Bloqueado evento sandbox (live_mode=false) no modo LIVE para payment ${resourceId}.`);
      return new Response(JSON.stringify({ received: true, ignored_sandbox_in_live: true }), {
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
      if (bookingId) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('id, tenant_id, status, payment_mode, amount_total, amount_paid')
          .eq('id', bookingId)
          .maybeSingle();

        if (booking) {
          eventTenantId = booking.tenant_id;
          const mpPayIdStr = String(mpPayment.id);

          if (mpPayment.status === 'approved') {
            const expectedAmount =
              booking.payment_mode === 'deposit'
                ? Number(booking.amount_paid || 0)
                : Number(booking.amount_total || 0);
            const paidBRL = Number(mpPayment.transaction_amount || 0);

            if (expectedAmount > 0 && paidBRL + 0.05 < expectedAmount) {
              console.warn(
                `[mp-webhook] Pagamento ${mpPayIdStr} com valor menor que o esperado (pago=${paidBRL}, esperado=${expectedAmount}). Bloqueado.`
              );
            } else {
              const wasAlreadyConfirmed = booking.status === 'confirmed';
              const finalPaid = paidBRL > 0 ? paidBRL : expectedAmount;
              const dueBRL = Math.max(0, Number(booking.amount_total || 0) - finalPaid);
              const newPaymentStatus = booking.payment_mode === 'deposit' ? 'partial_paid' : 'paid';
              const detectedMethod = mpPayment.payment_method_id === 'pix' ? 'pix' : 'card';

              const { error: upErr } = await supabase
                .from('bookings')
                .update({
                  status: 'confirmed',
                  payment_status: newPaymentStatus,
                  payment_method: detectedMethod,
                  amount_paid: finalPaid,
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
                    amount_paid: finalPaid,
                    amount_due: dueBRL,
                  })
                  .eq('id', booking.id);
              }

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
                    amount: finalPaid,
                    mp_payment_id: mpPayIdStr,
                    stripe_payment_intent_id: mpPayIdStr,
                    mp_collector_id: collectorIdForBooking,
                    platform_fee: Number(feeAmount || 0),
                    net_amount: Math.max(0, finalPaid - Number(feeAmount || 0)),
                  })
                  .eq('id', existingPayment.id);
              } else {
                await supabase.from('payments').insert({
                  tenant_id: booking.tenant_id,
                  booking_id: booking.id,
                  stripe_payment_intent_id: mpPayIdStr,
                  mp_payment_id: mpPayIdStr,
                  mp_collector_id: collectorIdForBooking,
                  amount: finalPaid,
                  platform_fee: Number(feeAmount || 0),
                  net_amount: Math.max(0, finalPaid - Number(feeAmount || 0)),
                  payment_method: detectedMethod,
                  status: 'succeeded',
                });
              }

              if (!wasAlreadyConfirmed) {
                await dispatchBookingPushEvent(supabase, booking.id, 'booking_new').catch(() => {});
              }
            }
          } else if (mpPayment.status === 'refunded' || mpPayment.status === 'charged_back') {
            const isChargeback = mpPayment.status === 'charged_back';
            await supabase
              .from('payments')
              .update({ status: isChargeback ? 'disputed' : 'refunded' })
              .or(`mp_payment_id.eq.${mpPayIdStr},stripe_payment_intent_id.eq.${mpPayIdStr},booking_id.eq.${booking.id}`);

            await supabase
              .from('bookings')
              .update({
                payment_status: 'refunded',
                ...(isChargeback ? { status: 'canceled' } : {}),
              })
              .eq('id', booking.id);
          } else if (mpPayment.status === 'cancelled' || mpPayment.status === 'rejected') {
            await supabase
              .from('payments')
              .update({ status: 'failed' })
              .eq('booking_id', booking.id)
              .eq('status', 'pending');
          }
        }
      }
    } else {
      // ─── CASO B: Assinatura Mensal do Salão (Salão → Plataforma Raffros) ──
      let tenantId = mpPayment.metadata?.tenant_id || null;
      let planId = mpPayment.metadata?.plan_id || null;
      let expectedBRL = 0;

      if (typeof mpPayment.external_reference === 'string' && mpPayment.external_reference.startsWith('sub::')) {
        const parts = mpPayment.external_reference.split('::');
        if (parts[1]) tenantId = parts[1];
        if (parts[2]) planId = parts[2];
        if (parts[3] && Number(parts[3]) > 0) expectedBRL = Number(parts[3]);
      }

      if (tenantId) {
        eventTenantId = tenantId;
      }

      if (tenantId && planId && mpPayment.status === 'approved') {
        const paidBRL = Number(mpPayment.transaction_amount || 0);
        if (expectedBRL > 0 && paidBRL + 0.05 < expectedBRL) {
          console.warn(
            `[mp-webhook] Assinatura ${mpPayment.id} com valor abaixo do esperado (pago=${paidBRL}, esperado=${expectedBRL}). Ignorado.`
          );
        } else {
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

          const paidCents = paidBRL > 0 ? Math.round(paidBRL * 100) : null;
          await preserveCustomContractAndPricing(supabase, tenantId, planId, prevContract, paidCents);

          await supabase.from('tenants').update({
            status: 'active',
            account_state: 'active',
            trial_ends_at: null,
            past_due_since: null,
            has_used_trial: true,
          }).eq('id', tenantId);
        }
      } else if (tenantId && (mpPayment.status === 'refunded' || mpPayment.status === 'charged_back')) {
        const isChargeback = mpPayment.status === 'charged_back';
        await supabase
          .from('subscriptions')
          .update({
            status: isChargeback ? 'past_due' : 'canceled',
            suspension_reason: isChargeback
              ? 'Contestação / chargeback no Mercado Pago'
              : 'Pagamento estornado no Mercado Pago',
            latest_invoice_status: mpPayment.status,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);

        await supabase
          .from('tenants')
          .update({
            status: 'suspended',
            account_state: 'past_due',
            past_due_since: new Date().toISOString(),
          })
          .eq('id', tenantId);
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
