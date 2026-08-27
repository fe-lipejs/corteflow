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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { planId, returnUrl, currency: requestedCurrency } = await req.json();

    // Buscar plano
    const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
    if (!plan) throw new Error("Plano não encontrado");

    // Buscar tenant associado ao usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // Buscar dados do tenant (idioma e histórico de trial)
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, language, status, has_used_trial')
      .eq('id', tenantId)
      .single();

    // Log Checkout Initiated event
    const { data: historyData } = await supabaseAdmin
      .from('commercial_history')
      .select('id, total_trials_used')
      .eq('normalized_email', user.email)
      .maybeSingle();

    if (historyData?.id) {
      await supabaseAdmin.from('billing_events').insert({
        history_id: historyData.id,
        event_type: 'checkout_initiated',
        details: { plan_id: plan.id, tenant_id: tenantId }
      });
    }

    const hasUsedTrialHistory = (historyData?.total_trials_used || 0) > 0;
    const isAntiFraudTriggered = tenantData?.has_used_trial || hasUsedTrialHistory;

    const targetCurrency = (requestedCurrency || (tenantData?.language === 'en' ? 'USD' : (['es', 'fr', 'de'].includes(tenantData?.language || '')) ? 'EUR' : 'BRL')).toUpperCase();

    // 1. Verificar se existe preço personalizado (Custom Pricing)
    const { data: customPrice } = await supabase
      .from('custom_pricing')
      .select('amount_override')
      .eq('tenant_id', tenantId)
      .eq('plan_id', plan.id)
      .maybeSingle();

    // 2. Buscar preço do plano para a moeda do tenant
    let { data: planPrice } = await supabase
      .from('plan_prices')
      .select('amount, currency, stripe_price_id')
      .eq('plan_id', plan.id)
      .eq('currency', targetCurrency)
      .maybeSingle();
    
    // Fallback para o primeiro preço cadastrado se não houver da moeda específica
    if (!planPrice) {
      const { data: fallbackPrice } = await supabase
        .from('plan_prices')
        .select('amount, currency, stripe_price_id')
        .eq('plan_id', plan.id)
        .limit(1)
        .maybeSingle();
      planPrice = fallbackPrice;
    }
    
    const currency = (planPrice?.currency ?? targetCurrency).toLowerCase();
    const lineItem: any = { quantity: 1 };

    if (customPrice?.amount_override) {
      const customUnitAmount = Math.round(customPrice.amount_override * 100);
      if (customUnitAmount <= 0) throw new Error("Valor inválido.");
      lineItem.price_data = {
        currency: currency,
        product_data: {
          name: `Plano ${plan.name} - Customizado`,
          description: plan.description,
        },
        unit_amount: customUnitAmount,
        recurring: { interval: 'month' },
      };
    } else {
      if (!planPrice?.stripe_price_id) {
        throw new Error(`ERRO: O plano selecionado não possui um 'stripe_price_id' configurado para a moeda ${currency.toUpperCase()}. O Administrador precisa cadastrar o ID do preço no painel Admin (/platform/plans).`);
      }
      lineItem.price = planPrice.stripe_price_id;
    }

    // 4. Verificar se já existe assinatura ou se já utilizou o benefício do teste grátis (Single-use trial rule)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const isPaidSub = existingSub && (existingSub.status === 'active' || existingSub.status === 'past_due' || existingSub.status === 'canceled');

    // Regra Antifraude (Local + Histórico): Se já usou trial (tenant atual ou email), ou já teve assinatura, trial é estritamente 0 (cobrança imediata)
    const trialDays = (!isAntiFraudTriggered && !isPaidSub && plan.trial_days && plan.trial_days > 0) ? plan.trial_days : 0;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
    };

    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    let customerId = existingSub?.stripe_customer_id;

    // NOVO: Recuperar conta órfã do Stripe pelo e-mail se não estiver vinculada
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin.from('subscriptions').update({ stripe_customer_id: customerId }).eq('tenant_id', tenantId);
      }
    }

    // Prevenir duplicação de assinatura no upgrade
    if (existingSub?.stripe_subscription_id && (existingSub.status === 'active' || existingSub.status === 'trialing')) {
      if (customerId) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        return new Response(JSON.stringify({ url: portalSession.url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      payment_method_collection: 'always',
      line_items: [lineItem],
      mode: 'subscription',
      currency: currency,
      subscription_data: subscriptionData,
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}`,
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
    };

    if (customerId) {
      checkoutParams.customer = customerId;
      checkoutParams.customer_update = { name: 'auto', address: 'auto' };
    } else {
      checkoutParams.customer_email = user.email;
    }

    // Criar a sessão no Stripe
    const session = await stripe.checkout.sessions.create(checkoutParams);

    // Se consumiu trial pela primeira vez, marcar permanentemente no banco
    if (trialDays > 0 && !isAntiFraudTriggered) {
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
