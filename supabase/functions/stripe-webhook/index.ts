import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  const body = await req.text();
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string;

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret, undefined, cryptoProvider);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.tenant_id && session.metadata?.plan_id) {
          // Atualiza ou insere assinatura do salão
          await supabase.from('subscriptions').upsert({
            tenant_id: session.metadata.tenant_id,
            plan_id: session.metadata.plan_id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: 'active',
          });
        } else if (session.metadata?.booking_id) {
          // Pagamento de um cliente do salão (Stripe Connect)
          await supabase.from('bookings').update({
            status: 'confirmed',
          }).eq('id', session.metadata.booking_id);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase.from('subscriptions').update({
          status: 'canceled',
        }).eq('stripe_subscription_id', subscription.id);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase.from('subscriptions').update({
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', subscription.id);
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const tenant_id = pi.metadata.tenant_id;
        const booking_id = pi.metadata.booking_id;
        
        // Se houver booking_id, atualiza o status de pagamento
        if (tenant_id && booking_id) {
           await supabase.from('payments').update({
             status: 'succeeded',
             payment_method: pi.payment_method?.toString() || 'unknown'
           }).eq('stripe_payment_intent_id', pi.id);
           
           // Fetch payment to get details for history
           const { data: payment } = await supabase.from('payments').select('id, amount, status').eq('stripe_payment_intent_id', pi.id).single();
           
           if (payment) {
             await supabase.from('payment_history').insert({
               tenant_id,
               payment_id: payment.id,
               action: 'payment_succeeded',
               status: 'succeeded',
               details: { stripe_payment_intent_id: pi.id }
             });

             // Update booking status
             await supabase.from('bookings').update({
               payment_status: 'paid'
             }).eq('id', booking_id);
           }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const tenant_id = pi.metadata.tenant_id;
        
        if (tenant_id) {
           await supabase.from('payments').update({
             status: 'failed'
           }).eq('stripe_payment_intent_id', pi.id);
           
           const { data: payment } = await supabase.from('payments').select('id, amount, booking_id').eq('stripe_payment_intent_id', pi.id).single();
           
           if (payment) {
             await supabase.from('payment_history').insert({
               tenant_id,
               payment_id: payment.id,
               action: 'payment_failed',
               status: 'failed',
               details: { error: pi.last_payment_error }
             });
             
             await supabase.from('bookings').update({
               payment_status: 'failed'
             }).eq('id', payment.booking_id);
           }
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        
        if (piId) {
           const { data: payment } = await supabase.from('payments').select('*').eq('stripe_payment_intent_id', piId).single();
           if (payment) {
              await supabase.from('payments').update({
                status: 'refunded'
              }).eq('id', payment.id);
              
              await supabase.from('refunds').insert({
                tenant_id: payment.tenant_id,
                payment_id: payment.id,
                amount: charge.amount_refunded / 100, // em reais
                stripe_refund_id: charge.refunds?.data[0]?.id || charge.id,
                status: 'succeeded'
              });
              
              await supabase.from('payment_history').insert({
                tenant_id: payment.tenant_id,
                payment_id: payment.id,
                action: 'payment_refunded',
                status: 'refunded',
                details: { amount_refunded: charge.amount_refunded }
              });
              
              await supabase.from('bookings').update({
                payment_status: 'refunded'
              }).eq('id', payment.booking_id);
           }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error(`Error processing webhook: ${err.message}`);
    return new Response(`Error processing webhook: ${err.message}`, { status: 500 });
  }
});
