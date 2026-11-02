import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext } from '../_shared/stripe.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let stripeContext;
  try {
    stripeContext = await getStripeContext(supabase);
  } catch (ctxErr: any) {
    console.error('[stripe-webhook] Erro ao obter contexto Stripe:', ctxErr.message);
    return new Response('Stripe configuration missing', { status: 500 });
  }

  const { stripe, mode, webhookSecret } = stripeContext;

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  const body = await req.text();

  if (!webhookSecret) {
    console.error(`[stripe-webhook] STRIPE_WEBHOOK_SECRET não configurado para o ambiente ${mode.toUpperCase()}`);
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err: any) {
    console.warn(`[stripe-webhook] Falha na assinatura com o secret principal (${mode}): ${err.message}`);
    
    // Tenta fallback com env padrão se diferente
    const fallbackSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (fallbackSecret && fallbackSecret !== webhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, fallbackSecret, undefined, cryptoProvider);
        console.log('[stripe-webhook] Assinatura validada com sucesso usando secret de fallback.');
      } catch (fallbackErr: any) {
        console.error(`Webhook signature verification failed: ${fallbackErr.message}`);
        return new Response(`Webhook Error: ${fallbackErr.message}`, { status: 400 });
      }
    } else {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  }

  // 1. Idempotency Check (V3 uses billing_events)
  const { data: existingEvent } = await supabase
    .from('billing_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`Event ${event.id} already processed. Skipping.`);
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200, headers: corsHeaders });
  }

  let eventTenantId: string | null = null;
  let processingError: string | null = null;

  try {
    console.log(`[stripe-webhook] Processing webhook event: ${event.type} in mode ${mode.toUpperCase()}`);

    // Helper: Find tenant_id from subscription with metadata fallback
    const getTenantFromSub = async (sub: any) => {
      const subId = typeof sub === 'string' ? sub : sub?.id;
      if (subId) {
        const { data } = await supabase
          .from('subscriptions')
          .select('tenant_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle();
        if (data?.tenant_id) return data.tenant_id;
      }
      if (typeof sub === 'object' && sub?.metadata?.tenant_id) {
        return sub.metadata.tenant_id;
      }
      return null;
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const planId = session.metadata?.plan_id;
        eventTenantId = tenantId || null;

        if (tenantId && session.subscription) {
          let stripeSub: any = null;
          try {
            stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
          } catch (retrieveErr: any) {
            console.warn(`[stripe-webhook] Não foi possível recuperar subscription ${session.subscription}:`, retrieveErr.message);
          }

          const isTrialing = stripeSub && stripeSub.status === 'trialing' && stripeSub.trial_end;
          const trialEndsAt = isTrialing ? new Date(stripeSub.trial_end! * 1000).toISOString() : null;
          const initialStatus = isTrialing ? 'trialing' : 'active';
          const initialAccountState = isTrialing ? 'trialing_with_card' : 'active';
          const periodEnd = stripeSub?.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null;

          // Update subscriptions table
          const { error: subErr } = await supabase.from('subscriptions').upsert({
            tenant_id: tenantId,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            plan_id: planId,
            status: initialStatus,
            trial_ends_at: trialEndsAt,
            current_period_end: periodEnd,
            canceled_at: null,
            latest_invoice_status: 'paid',
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id' });

          if (subErr) console.error(subErr);

          // State Machine Update
          await supabase.from('tenants').update({
            status: initialStatus === 'active' ? 'active' : 'trial',
            account_state: initialAccountState,
            trial_started_at: isTrialing ? new Date().toISOString() : undefined,
            trial_ends_at: trialEndsAt,
            has_used_trial: true
          }).eq('id', tenantId);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub);
        if (eventTenantId) {
          console.log(`Trial ending soon for tenant: ${eventTenantId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub);
        
        if (eventTenantId) {
          const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          await supabase.from('subscriptions').update({
            status: sub.status,
            trial_ends_at: trialEndsAt,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString()
          }).eq('stripe_subscription_id', sub.id);

          // V3 State Machine Update
          let newState = 'active';
          if (sub.status === 'trialing') newState = 'trialing_with_card';
          if (sub.status === 'past_due') newState = 'past_due';
          if (sub.status === 'canceled') newState = 'canceled';
          
          await supabase.from('tenants').update({
            account_state: newState,
            trial_ends_at: trialEndsAt
          }).eq('id', eventTenantId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub);

        if (eventTenantId) {
          await supabase.from('subscriptions').update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('stripe_subscription_id', sub.id);

          await supabase.from('tenants').update({ account_state: 'canceled' }).eq('id', eventTenantId);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id;
        const tenantId = pi.metadata?.tenant_id;
        eventTenantId = tenantId || null;

        if (bookingId) {
          await supabase.from('payments').update({ status: 'succeeded' }).eq('stripe_payment_intent_id', pi.id);
          
          const { data: booking } = await supabase.from('bookings').select('payment_mode').eq('id', bookingId).maybeSingle();
          if (booking) {
            const newPaymentStatus = booking.payment_mode === 'deposit' ? 'partial_paid' : 'full_paid';
            const amountReceivedBRL = pi.amount_received / 100;
            await supabase.from('bookings').update({
              payment_status: newPaymentStatus,
              amount_paid: amountReceivedBRL,
            }).eq('id', bookingId);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (stripeSubId) {
          eventTenantId = await getTenantFromSub(stripeSubId);
          if (eventTenantId) {
            await supabase.from('subscriptions').update({
              status: 'past_due',
              latest_invoice_status: 'failed',
              updated_at: new Date().toISOString()
            }).eq('stripe_subscription_id', stripeSubId);

            await supabase.from('tenants').update({ 
              account_state: 'past_due',
              past_due_since: new Date().toISOString()
            }).eq('id', eventTenantId);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (stripeSubId) {
          eventTenantId = await getTenantFromSub(stripeSubId);
          if (eventTenantId) {
            await supabase.from('subscriptions').update({
              status: 'active',
              latest_invoice_status: 'paid',
              updated_at: new Date().toISOString()
            }).eq('stripe_subscription_id', stripeSubId);

            await supabase.from('tenants').update({ 
              account_state: 'active',
              past_due_since: null
            }).eq('id', eventTenantId);
          }
        }
        break;
      }
    }

  } catch (err: any) {
    processingError = err.message;
    console.error(`Error processing webhook event ${event.type}: ${err.message}`);
  }

  if (processingError) {
    return new Response(`Error: ${processingError}`, { status: 500 });
  }

  // Audit Log (Idempotency Save V3)
  await supabase.from('billing_events').insert({
    stripe_event_id: event.id,
    type: event.type,
    tenant_id: eventTenantId,
    payload: event as any
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
