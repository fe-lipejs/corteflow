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

    // 1. Fetch booking with tenant and payments
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, tenant_settings(*), payments(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    const settings = booking.tenant_settings[0];

    // 2. Validate cancellation rules (if client)
    if (actorType === 'client') {
      if (!settings.allow_cancel) {
        throw new Error('O salão não permite cancelamentos pelo portal.');
      }
    }

    const succeededPayment = booking.payments?.find((p: any) => p.status === 'succeeded');
    
    // 3. Process Financials if there's a payment
    if (succeededPayment) {
      // Calculate refund amount based on intelligent cancellation rules
      const scheduledDate = new Date(booking.scheduled_at);
      const freeDeadlineDate = new Date(scheduledDate);
      freeDeadlineDate.setHours(freeDeadlineDate.getHours() - (settings.cancel_free_hours_before || 2));
      
      const now = new Date();
      let refundAmount = succeededPayment.amount;

      // Se cancelou depois do prazo de gratuidade, aplica a multa
      if (now > freeDeadlineDate) {
        const feePercent = settings.cancel_fee_percent || 0;
        refundAmount = Math.round((succeededPayment.amount * (100 - feePercent)) / 100);
      }

      // Só processa estorno no Stripe se tiver algo a devolver
      if (refundAmount > 0) {
        // Process Stripe Refund
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

        // Insert into refunds table
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
        // Retido 100% como taxa de cancelamento
        await supabase.from('payments').update({ status: 'captured_as_fee' }).eq('id', succeededPayment.id);
        await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
      }
    }

    // 4. Update Booking status via DB
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
