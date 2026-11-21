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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, actorType = 'client', reason } = await req.json();

    if (!bookingId) {
      throw new Error('Missing bookingId');
    }

    // 1. Fetch booking (sem join com tenant_settings — não há FK direta)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'canceled') {
      return new Response(JSON.stringify({ success: true, alreadyCanceled: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Fetch tenant_settings
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('allow_cancel, cancel_free_hours_before, cancel_fee_percent')
      .eq('tenant_id', booking.tenant_id)
      .maybeSingle();

    const settings = settingsRow ?? {
      allow_cancel: true,
      cancel_free_hours_before: 2,
      cancel_fee_percent: 0,
    };

    // 3. Fetch payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId);

    // 4. Validate cancellation policy (client only)
    if (actorType === 'client' && !settings.allow_cancel) {
      throw new Error('O salão não permite cancelamentos pelo portal.');
    }

    const succeededPayment = (payments ?? []).find((p: any) => p.status === 'succeeded');

    // 5. Process Mercado Pago refund if there was a confirmed online payment
    if (succeededPayment) {
      const scheduledDate = new Date(booking.scheduled_at);
      const freeDeadlineDate = new Date(scheduledDate);
      freeDeadlineDate.setHours(
        freeDeadlineDate.getHours() - (settings.cancel_free_hours_before ?? 2)
      );

      const now = new Date();
      const paidAmount = Number(succeededPayment.amount || booking.amount_paid || 0);
      let refundAmount = Number(paidAmount.toFixed(2));

      if (now > freeDeadlineDate) {
        const feePercent = Number(settings.cancel_fee_percent || 0);
        refundAmount = Number(((paidAmount * (100 - feePercent)) / 100).toFixed(2));
      }

      if (refundAmount > 0 && paidAmount > 0) {
        const mpContext = await getMercadoPagoContext(supabase);
        const tenantMp = await getTenantMercadoPagoAccount(supabase, booking.tenant_id, mpContext);

        let mpPayId: string | null = null;
        if (succeededPayment.mp_payment_id && /^\d+$/.test(String(succeededPayment.mp_payment_id))) {
          mpPayId = String(succeededPayment.mp_payment_id);
        } else if (
          succeededPayment.stripe_payment_intent_id &&
          /^\d+$/.test(String(succeededPayment.stripe_payment_intent_id))
        ) {
          mpPayId = String(succeededPayment.stripe_payment_intent_id);
        }

        let activeToken =
          tenantMp?.isTestUser && mpContext.testAccessToken
            ? mpContext.testAccessToken
            : tenantMp?.accessToken || mpContext.accessToken;

        // Se só tínhamos preference_id salvo, localiza o payment_id numérico no Mercado Pago
        if (!mpPayId && activeToken) {
          try {
            const searchRes = await mpRequest<any>(
              `/v1/payments/search?external_reference=${encodeURIComponent(bookingId)}&status=approved&limit=5`,
              activeToken,
              { method: 'GET' }
            );
            const found = searchRes?.results?.find?.((p: any) => p.status === 'approved');
            if (found?.id) {
              mpPayId = String(found.id);
            }
          } catch (_) {}
        }

        if (!mpPayId || !activeToken) {
          throw new Error(
            'Não foi possível localizar o pagamento no Mercado Pago para efetuar o estorno automático.'
          );
        }

        const isFullRefund = refundAmount >= paidAmount - 0.01;
        const refundBody = isFullRefund ? {} : { amount: refundAmount };

        let mpRefund: any = null;
        const executeRefund = async (token: string) =>
          await mpRequest<any>(`/v1/payments/${mpPayId}/refunds`, token, {
            method: 'POST',
            body: refundBody,
            idempotencyKey: `refund-${bookingId}-${mpPayId}`,
          });

        try {
          mpRefund = await executeRefund(activeToken);
        } catch (refundErr: any) {
          const msg = String(refundErr?.message || '');
          if (msg.includes('unauthorized') || msg.includes('401')) {
            const refreshedTok = await refreshTenantMercadoPagoToken(
              supabase,
              booking.tenant_id,
              mpContext
            );
            if (refreshedTok) {
              mpRefund = await executeRefund(refreshedTok);
            } else {
              throw refundErr;
            }
          } else if (
            tenantMp?.isTestUser &&
            mpContext.testAccessToken &&
            mpContext.testAccessToken !== activeToken
          ) {
            mpRefund = await executeRefund(mpContext.testAccessToken);
          } else if (msg.toLowerCase().includes('already') && msg.toLowerCase().includes('refund')) {
            mpRefund = { id: `already_refunded_${mpPayId}`, status: 'approved' };
          } else {
            throw refundErr;
          }
        }

        await supabase.from('refunds').insert({
          tenant_id: booking.tenant_id,
          payment_id: succeededPayment.id,
          stripe_refund_id: mpRefund?.id ? String(mpRefund.id) : `mp_ref_${mpPayId}`,
          amount: refundAmount,
          status: 'succeeded',
          reason: reason || 'Cancelamento',
        });

        await supabase.from('payments').update({ status: 'refunded' }).eq('id', succeededPayment.id);
        await supabase
          .from('bookings')
          .update({ payment_status: 'refunded', amount_due: 0 })
          .eq('id', bookingId);
      } else {
        // 100% retido como taxa de cancelamento
        await supabase
          .from('payments')
          .update({ status: 'captured_as_fee' })
          .eq('id', succeededPayment.id);
        await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
      }
    } else {
      // Marca eventuais pagamentos ainda pendentes como cancelados
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('booking_id', bookingId)
        .eq('status', 'pending');
    }

    // 6. Mark booking as canceled
    await supabase.from('bookings').update({ status: 'canceled' }).eq('id', bookingId);

    await supabase.from('booking_history').insert({
      tenant_id: booking.tenant_id,
      booking_id: bookingId,
      action: 'canceled',
      reason: reason || 'Cancelamento pelo portal',
      actor_type: actorType,
    });

    await dispatchBookingPushEvent(supabase, bookingId, 'booking_canceled').catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error processing cancellation (MP):', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
