import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY não configurada no backend. Você fez o deploy das secrets no Supabase?");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { planId, returnUrl } = await req.json();

    // Buscar plano
    const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
    if (!plan) throw new Error("Plano não encontrado");

    // Buscar tenant associado ao usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // 1. Verificar se existe preço personalizado (Custom Pricing)
    const { data: customPrice } = await supabase
      .from('custom_pricing')
      .select('amount_override')
      .eq('tenant_id', tenantId)
      .eq('plan_id', plan.id)
      .maybeSingle();

    // 2. Buscar preço padrão do plano
    const { data: planPrice } = await supabase
      .from('plan_prices')
      .select('amount, currency')
      .eq('plan_id', plan.id)
      .limit(1)
      .maybeSingle();
    
    // 3. Definir valor final (Custom Price > Plan Price > Fallback)
    const amountFloat = customPrice?.amount_override ?? planPrice?.amount ?? 0;
    const unitAmount = Math.round(amountFloat * 100);
    const currency = (planPrice?.currency ?? 'BRL').toLowerCase();

    if (unitAmount <= 0) {
      throw new Error("O valor do plano não pode ser zero ou negativo para assinaturas no Stripe.");
    }

    // 4. Verificar se o salão já utilizou o benefício do teste grátis (Single-use trial rule)
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('has_used_trial')
      .eq('id', tenantId)
      .single();

    const hasUsedTrial = tenantData?.has_used_trial === true;

    // Se ainda não usou e o plano possui dias de teste, oferece o trial. Caso já tenha usado, COBRA IMEDIATAMENTE.
    const trialDays = (!hasUsedTrial && plan.trial_days && plan.trial_days > 0) ? plan.trial_days : 0;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
    };

    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    // Criar a sessão no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Plano ${plan.name} - Navalha SaaS`,
              description: plan.description,
            },
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: subscriptionData,
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}`,
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
    });

    // Se consumiu trial pela primeira vez, marcar permanentemente no banco
    if (trialDays > 0 && !hasUsedTrial) {
      await supabase.from('tenants').update({ has_used_trial: true }).eq('id', tenantId);
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
