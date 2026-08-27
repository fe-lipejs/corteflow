import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeSecret || !endpointSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return new Response('Server misconfiguration', { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret, undefined, cryptoProvider);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

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
    console.log(`Processing webhook event: ${event.type}`);

    // Helper: Find tenant_id from subscription
    const getTenantFromSub = async (subId: string) => {
      const { data } = await supabase
        .from('subscriptions')
        .select('tenant_id')
        .eq('stripe_subscription_id', subId)
        .maybeSingle();
      return data?.tenant_id || null;
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const planId = session.metadata?.plan_id;
        eventTenantId = tenantId || null;

        if (tenantId && session.subscription) {
          // Update legacy subscriptions table (to not break old UI)
          const { error: subErr } = await supabase.from('subscriptions').upsert({
            tenant_id: tenantId,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            plan_id: planId,
            status: 'trialing'
          }, { onConflict: 'tenant_id' });

          if (subErr) console.error(subErr);

          // V3 State Machine Update
          await supabase.from('tenants').update({
            account_state: 'trialing_with_card',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }).eq('id', tenantId);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub.id);
        if (eventTenantId) {
          // Log explicitly for trial ending
          console.log(`Trial ending soon for tenant: ${eventTenantId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub.id);
        
        if (eventTenantId) {
          // Keep legacy subscriptions table updated
          const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          await supabase.from('subscriptions').update({
            status: sub.status,
            trial_ends_at: trialEndsAt,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
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
        eventTenantId = await getTenantFromSub(sub.id);

        if (eventTenantId) {
          await supabase.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
          // V3 State Machine Update
          await supabase.from('tenants').update({ account_state: 'canceled' }).eq('id', eventTenantId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (stripeSubId) {
          eventTenantId = await getTenantFromSub(stripeSubId);
          if (eventTenantId) {
            await supabase.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', stripeSubId);
            // V3 State Machine Update
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
            await supabase.from('subscriptions').update({ status: 'active' }).eq('stripe_subscription_id', stripeSubId);
            // V3 State Machine Update
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

  // 2. Audit Log (Idempotency Save V3)
  await supabase.from('billing_events').insert({
    stripe_event_id: event.id,
    type: event.type,
    tenant_id: eventTenantId,
    payload: event as any
  });

  if (processingError) {
    return new Response(`Error: ${processingError}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
