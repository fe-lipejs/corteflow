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

    const { stripe, mode, applicationFeePercent } = await getStripeContext(supabase);

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
      .select('stripe_account_id, charges_enabled')
      .eq('tenant_id', booking.tenant_id)
      .single();

    if (!stripeAccount?.stripe_account_id) {
      throw new Error("O salão ainda não conectou sua conta de pagamentos online. Por favor, escolha a opção de pagamento no local.");
    }

    // Validar se a conta Connect existe e está ativa no ambiente do Stripe atual (Test ou Live)
    try {
      const acc = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
      if (!acc.charges_enabled) {
        throw new Error("A conta de recebimento do salão ainda está em processo de verificação no Stripe. Por favor, pague no local.");
      }
    } catch (accErr: any) {
      console.warn(`[create-booking-checkout] Conta Connect '${stripeAccount.stripe_account_id}' inválida no ambiente ${mode.toUpperCase()}:`, accErr?.message);
      throw new Error("Os pagamentos online deste salão ainda não foram ativados no ambiente de cobrança atual. Por favor, escolha 'Pagar no local'.");
    }

    const amountTotal = Number(booking.amount_total);
    const amountToCharge = booking.payment_mode === 'deposit' ? Number(booking.amount_paid) : amountTotal;
    
    if (amountToCharge <= 0) {
      throw new Error("Valor a cobrar inválido");
    }

    const price = Math.round(amountToCharge * 100); // centavos
    if (price < 50) {
      throw new Error("O valor mínimo para pagamento com cartão é de R$ 0,50.");
    }

    const platformFeePercentage = (applicationFeePercent || 2) / 100;
    const applicationFee = Math.round(price * platformFeePercentage);

    const serviceName = (booking.services as any)?.name || 'Serviço';
    const salonName = (booking.tenants as any)?.name || 'Salão';
    let safeReturnUrl = returnUrl || '';
    if (!safeReturnUrl.startsWith('http://') && !safeReturnUrl.startsWith('https://')) {
      const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://navalha.app';
      const cleanOrigin = origin.replace(/\/$/, '');
      safeReturnUrl = `${cleanOrigin}${safeReturnUrl.startsWith('/') ? '' : '/'}${safeReturnUrl}`;
    }

    const buildSessionParams = (paymentMethods: string[]) => ({
      payment_method_types: paymentMethods as any,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${serviceName} - ${salonName}`,
              description: description,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment' as const,
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
      success_url: `${safeReturnUrl}?order=${booking.order_number}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeReturnUrl}?cancel=true`,
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
      },
    });

    // Tentar criar com Pix + Cartão; se o Stripe retornar que Pix não está ativo na conta, tenta apenas com Cartão
    let session: any;
    try {
      session = await stripe.checkout.sessions.create(buildSessionParams(['card', 'pix']));
    } catch (pixErr: any) {
      if (pixErr?.message?.toLowerCase().includes('pix')) {
        console.warn("[create-booking-checkout] Pix não habilitado na conta Stripe, usando apenas Cartão:", pixErr.message);
        session = await stripe.checkout.sessions.create(buildSessionParams(['card']));
      } else {
        throw pixErr;
      }
    }

    // Salvar registro de pagamento pendente no banco
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
    console.error("create-booking-checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
