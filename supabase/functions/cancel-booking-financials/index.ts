import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, actorType, reason } = await req.json();

    if (!bookingId) {
      throw new Error('Missing bookingId');
    }

    // 1. Fetch booking (no join to tenant_settings — no FK exists between bookings and tenant_settings)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // 2. Fetch tenant_settings separately using tenant_id from the booking
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('allow_cancel, cancel_free_hours_before, cancel_fee_percent')
      .eq('tenant_id', booking.tenant_id)
      .maybeSingle();

    // Safe defaults if no settings row exists yet
    const settings = settingsRow ?? {
      allow_cancel: true,
      cancel_free_hours_before: 2,
      cancel_fee_percent: 0,
    };

    // 3. Fetch payments separately
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId);

    // 4. Validate cancellation policy (client only)
    if (actorType === 'client') {
      if (!settings.allow_cancel) {
        throw new Error('O salão não permite cancelamentos pelo portal.');
      }
    }

    const succeededPayment = (payments ?? []).find((p: any) => p.status === 'succeeded');

    // 5. Process financials if there was a Stripe payment
    if (succeededPayment?.stripe_payment_intent_id) {
      const scheduledDate = new Date(booking.scheduled_at);
      const freeDeadlineDate = new Date(scheduledDate);
      freeDeadlineDate.setHours(freeDeadlineDate.getHours() - (settings.cancel_free_hours_before || 2));

      const now = new Date();
      let refundAmount = succeededPayment.amount;

      // Apply cancellation fee if past the free-cancel window
      if (now > freeDeadlineDate) {
        const feePercent = settings.cancel_fee_percent || 0;
        refundAmount = Math.round((succeededPayment.amount * (100 - feePercent)) / 100);
      }

      if (refundAmount > 0) {
        const pi = await stripe.paymentIntents.retrieve(succeededPayment.stripe_payment_intent_id);
        const chargeId = pi.latest_charge as string;

        if (!chargeId) {
          throw new Error('No charge found for this payment intent');
        }

        const refund = await stripe.refunds.create({
          charge: chargeId,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
        });

        await supabase.from('refunds').insert({
          tenant_id: booking.tenant_id,
          payment_id: succeededPayment.id,
          stripe_refund_id: refund.id,
          amount: refundAmount,
          status: 'succeeded',
          reason: reason || 'Cancelamento',
        });

        await supabase.from('payments').update({ status: 'refunded' }).eq('id', succeededPayment.id);
        await supabase.from('bookings').update({ payment_status: 'refunded' }).eq('id', bookingId);
      } else {
        // 100% retained as cancellation fee
        await supabase.from('payments').update({ status: 'captured_as_fee' }).eq('id', succeededPayment.id);
        await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
      }
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error processing cancellation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
