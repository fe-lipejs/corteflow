import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stripe, applicationFeePercent } = await getStripeContext(supabase);

    const { bookingId, returnUrl } = await req.json();

    // Buscar booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, tenants(name), services(name, price)')
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error("Agendamento não encontrado");

    // Buscar tenant Stripe Connect Account
    const { data: stripeAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', booking.tenant_id)
      .single();

    if (!stripeAccount?.stripe_account_id) {
      throw new Error("Salão não possui conta Stripe conectada");
    }

    const amountTotal = booking.amount_total;
    const amountToCharge = booking.payment_mode === 'deposit' ? booking.amount_paid : amountTotal;
    
    if (amountToCharge <= 0) {
      throw new Error("Valor a cobrar inválido");
    }

    const price = Math.round(amountToCharge * 100); // centavos
    const platformFeePercentage = (applicationFeePercent || 2) / 100;
    const applicationFee = Math.round(price * platformFeePercentage); // fee da plataforma configurada no Super Admin

    // Criar a sessão no Stripe (Connect - Destination Charge)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${(booking.services as any).name} - ${(booking.tenants as any).name}`,
              description: booking.payment_mode === 'deposit' ? 'Pagamento de Sinal (Reserva)' : 'Pagamento Integral',
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
        metadata: {
          booking_id: booking.id,
          tenant_id: booking.tenant_id,
        }
      },
      success_url: `${returnUrl}?order=${booking.order_number}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?cancel=true`,
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
      },
    });

    // Save pending payment record in DB
    // We don't have the payment_intent id yet if it's a checkout session before completion in some cases,
    // but checkout.sessions.create in payment mode creates the PaymentIntent immediately.
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    
    if (piId) {
       await supabase.from('payments').insert({
         tenant_id: booking.tenant_id,
         booking_id: booking.id,
         stripe_payment_intent_id: piId,
         amount: amountToCharge,
         platform_fee: applicationFee / 100,
         net_amount: amountToCharge - (applicationFee / 100),
         status: 'pending'
       });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
