import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
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
    const connectSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    if (connectSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, connectSecret, undefined, cryptoProvider);
      } catch (err2: any) {
        console.error(`Webhook signature verification failed: ${err.message} / ${err2.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Idempotency Check
  const { data: existingEvent } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`Event ${event.id} already processed. Skipping.`);
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 });
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

        if (session.metadata?.tenant_id && session.metadata?.plan_id) {
          eventTenantId = session.metadata.tenant_id;
          const planId = session.metadata.plan_id;

          let trialEndsAt: string | null = null;
          let currentPeriodEnd: string | null = null;

          if (session.subscription) {
            const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
            if (stripeSub.trial_end) {
              trialEndsAt = new Date(stripeSub.trial_end * 1000).toISOString();
            }
            currentPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          }

          // Se o salão tinha uma assinatura anterior diferente no Stripe, cancela a anterior para evitar cobrança dupla
          const { data: previousSub } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('tenant_id', eventTenantId)
            .maybeSingle();

          if (previousSub?.stripe_subscription_id && session.subscription && previousSub.stripe_subscription_id !== session.subscription) {
            try {
              await stripe.subscriptions.cancel(previousSub.stripe_subscription_id);
              console.log(`[Webhook] Assinatura anterior ${previousSub.stripe_subscription_id} cancelada com sucesso no Stripe.`);
            } catch (cancelErr) {
              console.warn(`[Webhook] Aviso ao cancelar assinatura anterior no Stripe:`, cancelErr);
            }
          }

          const { error: upsertError } = await supabase.from('subscriptions').upsert({
            tenant_id: eventTenantId,
            plan_id: planId,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: 'active',
            trial_ends_at: trialEndsAt,
            current_period_end: currentPeriodEnd,
            grace_period_ends_at: null,
            suspension_reason: null,
            canceled_at: null,
            latest_invoice_status: 'paid'
          }, { onConflict: 'tenant_id' });

          if (upsertError) throw upsertError;

          await supabase.from('tenants').update({ status: 'active' }).eq('id', eventTenantId);
        } else if (session.metadata?.booking_id) {
          await supabase.from('bookings').update({
            status: 'confirmed',
            amount_paid: (session.amount_total ?? 0) / 100,
          }).eq('id', session.metadata.booking_id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub.id);
        
        if (eventTenantId) {
          const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          
          // Identify the plan_id from the stripe price if it changed (e.g. upgrade/downgrade)
          let updatedPlanId = undefined;
          const stripePriceId = sub.items?.data?.[0]?.price?.id;
          if (stripePriceId) {
            const { data: priceData } = await supabase
              .from('plan_prices')
              .select('plan_id')
              .eq('stripe_price_id', stripePriceId)
              .maybeSingle();
            if (priceData?.plan_id) {
              updatedPlanId = priceData.plan_id;
            }
          }

          const updatePayload: any = {
            status: sub.status,
            trial_ends_at: trialEndsAt,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          };

          if (updatedPlanId) {
            updatePayload.plan_id = updatedPlanId;
          }
          
          await supabase.from('subscriptions').update(updatePayload).eq('stripe_subscription_id', sub.id);

          // If it became active/trialing, clear suspension
          if (sub.status === 'active' || sub.status === 'trialing') {
            await supabase.from('tenants').update({ status: sub.status === 'trialing' ? 'trial' : 'active' }).eq('id', eventTenantId);
            await supabase.from('subscriptions').update({ grace_period_ends_at: null, suspension_reason: null }).eq('tenant_id', eventTenantId);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        eventTenantId = await getTenantFromSub(sub.id);

        if (eventTenantId) {
          const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString();
          
          await supabase.from('subscriptions').update({
            status: 'canceled',
            canceled_at: canceledAt,
            grace_period_ends_at: null,
            suspension_reason: 'Assinatura cancelada no Stripe.'
          }).eq('stripe_subscription_id', sub.id);

          await supabase.from('tenants').update({ status: 'canceled' }).eq('id', eventTenantId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        
        if (stripeSubId) {
          eventTenantId = await getTenantFromSub(stripeSubId);
          if (eventTenantId) {
            // Check current subscription
            const { data: currentSub } = await supabase.from('subscriptions').select('grace_period_ends_at').eq('tenant_id', eventTenantId).single();
            
            // Set 5-day grace period if not already set
            let gracePeriod = currentSub?.grace_period_ends_at;
            if (!gracePeriod) {
              const fiveDaysFromNow = new Date();
              fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
              gracePeriod = fiveDaysFromNow.toISOString();
            }

            await supabase.from('subscriptions').update({
              status: 'past_due',
              latest_invoice_status: 'failed',
              grace_period_ends_at: gracePeriod,
            }).eq('stripe_subscription_id', stripeSubId);
            
            // Note: Tenant status remains 'active', the frontend will check grace_period_ends_at
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
              grace_period_ends_at: null,
              suspension_reason: null
            }).eq('stripe_subscription_id', stripeSubId);

            // Restore tenant access if they were suspended (though handled by frontend primarily)
            // But just to be sure we clear 'suspended' status if it was set
            await supabase.from('tenants').update({ status: 'active' }).eq('id', eventTenantId);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabase.from('stripe_connect_accounts').update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        }).eq('stripe_account_id', account.id);

        // Se a conta Stripe agora está apta a cobrar (charges_enabled = true), liberar automaticamente pagamentos online no salão
        if (account.charges_enabled) {
          const { data: connectAcc } = await supabase
            .from('stripe_connect_accounts')
            .select('tenant_id')
            .eq('stripe_account_id', account.id)
            .maybeSingle();

          if (connectAcc?.tenant_id) {
            const { data: currentSettings } = await supabase
              .from('tenant_settings')
              .select('payment_methods')
              .eq('tenant_id', connectAcc.tenant_id)
              .maybeSingle();

            const currentPm = (currentSettings?.payment_methods as any) || {};
            await supabase.from('tenant_settings').update({
              payment_methods: {
                pay_local: currentPm.pay_local !== false,
                partial_50: true,
                full_100: true,
              },
              online_payment_enabled: true
            }).eq('tenant_id', connectAcc.tenant_id);
          }
        }
        break;
      }
    }

  } catch (err: any) {
    processingError = err.message;
    console.error(`Error processing webhook event ${event.type}: ${err.message}`);
  }

  // 2. Audit Log (Idempotency Save)
  await supabase.from('stripe_events').insert({
    stripe_event_id: event.id,
    type: event.type,
    tenant_id: eventTenantId,
    payload: event as any, // Cast to any because Supabase Json type
    error: processingError
  });

  if (processingError) {
    return new Response(`Error: ${processingError}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
