import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stripe, mode } = await getStripeContext(supabaseAdmin);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
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

    // 1. Verificar se existe preço personalizado (Custom Pricing) usando supabaseAdmin para não depender de RLS
    const { data: tenantCustomPrices } = await supabaseAdmin
      .from('custom_pricing')
      .select('id, plan_id, amount_override')
      .eq('tenant_id', tenantId);

    let customPrice = tenantCustomPrices?.find((cp: any) => cp.plan_id === plan.id && Number(cp.amount_override) > 0) || null;

    // Fallback: se o Super Admin cadastrou o desconto enquanto o salão estava no plano de Trial,
    // o plan_id salvo em custom_pricing pode ser o ID do plano de Trial.
    if (!customPrice && tenantCustomPrices && tenantCustomPrices.length > 0) {
      const { data: allPlans } = await supabaseAdmin
        .from('plans')
        .select('id, name, key, is_trial_plan, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      const paidPlans = (allPlans || []).filter(
        (p: any) =>
          p.name !== 'Trial (Período de Teste)' &&
          p.key !== 'expired_tier' &&
          p.key !== 'fallback_tier' &&
          !p.key?.includes('fallback') &&
          !p.name?.toLowerCase().includes('fallback') &&
          !p.name?.toLowerCase().includes('cancelado') &&
          !p.is_trial_plan
      );
      const paidPlanIds = new Set(paidPlans.map((p: any) => p.id));
      const orphanTrialCp = tenantCustomPrices.find(
        (cp: any) => Number(cp.amount_override) > 0 && !paidPlanIds.has(cp.plan_id)
      );

      // Se o plano escolhido for o plano de entrada (Solo) ou se houver apenas 1 exceção órfã de Trial
      if (orphanTrialCp && (paidPlans[0]?.id === plan.id || tenantCustomPrices.length === 1)) {
        customPrice = orphanTrialCp;
        // Auto-corrige o plan_id na tabela custom_pricing para apontar para o plano pago escolhido
        await supabaseAdmin
          .from('custom_pricing')
          .update({ plan_id: plan.id })
          .eq('id', orphanTrialCp.id);
      }
    }

    // 2. Buscar preço do plano para a moeda do tenant (com suporte a IDs de Teste e Live)
    let { data: planPrice } = await supabaseAdmin
      .from('plan_prices')
      .select('amount, currency, stripe_price_id, stripe_price_id_test, stripe_price_id_live')
      .eq('plan_id', plan.id)
      .eq('currency', targetCurrency)
      .maybeSingle();
    
    // Fallback para o primeiro preço cadastrado se não houver da moeda específica
    if (!planPrice) {
      const { data: fallbackPrice } = await supabaseAdmin
        .from('plan_prices')
        .select('amount, currency, stripe_price_id, stripe_price_id_test, stripe_price_id_live')
        .eq('plan_id', plan.id)
        .limit(1)
        .maybeSingle();
      planPrice = fallbackPrice;
    }
    
    const currency = (planPrice?.currency ?? targetCurrency).toLowerCase();
    const lineItem: any = { quantity: 1 };

    // Garantir descrição alinhada a Salões de Beleza, Esmalterias e Profissionais (nunca "barbeiro autônomo")
    let cleanDescription = (plan.description || '').trim();
    if (!cleanDescription || cleanDescription.toLowerCase().includes('barbeiro')) {
      cleanDescription =
        plan.key === 'solo_tier' || plan.name?.toLowerCase() === 'solo'
          ? 'Ideal para profissionais independentes, salões de beleza e esmalterias. Agenda, clientes e financeiro.'
          : `Assinatura Plano ${plan.name} — Raffros`;
      // Atualiza permanentemente no banco caso ainda estivesse com o texto antigo
      await supabaseAdmin
        .from('plans')
        .update({ description: cleanDescription })
        .eq('id', plan.id);
    }

    if (customPrice?.amount_override && Number(customPrice.amount_override) > 0) {
      const customUnitAmount = Math.round(Number(customPrice.amount_override) * 100);
      if (customUnitAmount <= 0) throw new Error("Valor inválido.");
      lineItem.price_data = {
        currency: currency,
        product_data: {
          name: `Plano ${plan.name}`,
          description: cleanDescription,
        },
        unit_amount: customUnitAmount,
        recurring: { interval: 'month' },
      };
    } else {
      // Determinar o stripe_price_id correto para o modo ativo (Live ou Test)
      const targetPriceId = mode === 'live'
        ? (planPrice?.stripe_price_id_live?.trim() || (!planPrice?.stripe_price_id_test ? planPrice?.stripe_price_id?.trim() : null))
        : (planPrice?.stripe_price_id_test?.trim() || planPrice?.stripe_price_id?.trim());

      let priceResolved = false;

      if (targetPriceId) {
        try {
          const retrievedPrice = await stripe.prices.retrieve(targetPriceId, { expand: ['product'] });
          if (retrievedPrice && retrievedPrice.active) {
            lineItem.price = targetPriceId;
            priceResolved = true;

            // Se o produto no Stripe tiver descrição antiga mencionando "barbeiro", atualiza no próprio Stripe
            const stripeProd = retrievedPrice.product as any;
            if (stripeProd && typeof stripeProd === 'object' && stripeProd.id && stripeProd.description?.toLowerCase().includes('barbeiro')) {
              await stripe.products.update(stripeProd.id, { description: cleanDescription }).catch(() => {});
            }
          }
        } catch (priceErr: any) {
          console.warn(`[Stripe] stripe_price_id '${targetPriceId}' não pôde ser recuperado no ambiente ${mode.toUpperCase()}:`, priceErr?.message);
        }
      }

      // Se não havia ID configurado ou o ID do Stripe não existia no ambiente atual, gera price_data dinamicamente
      if (!priceResolved) {
        lineItem.price_data = {
          currency: currency,
          product_data: {
            name: `Plano ${plan.name}`,
            description: cleanDescription,
          },
          unit_amount: Math.round(Number(planPrice?.amount || plan.price || 0) * 100),
          recurring: { interval: 'month' },
        };
      }
    }

    // 4. Verificar assinatura existente e validar customer_id no ambiente ativo
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const isPaidSub = existingSub && (existingSub.status === 'active' || existingSub.status === 'past_due' || existingSub.status === 'canceled');

    // Regra Antifraude: Se já usou trial (tenant atual ou histórico do email), ou já teve assinatura paga, trial é 0
    const trialDays = (!isAntiFraudTriggered && !isPaidSub && plan.trial_days && plan.trial_days > 0) ? plan.trial_days : 0;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
        ...(customPrice?.amount_override ? { custom_price_amount: String(customPrice.amount_override) } : {}),
      },
    };

    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    let customerId = existingSub?.stripe_customer_id;

    // Blindagem de Ambiente: Valida se o customerId realmente existe no Stripe atual (Test ou Live)
    if (customerId) {
      try {
        const cust = await stripe.customers.retrieve(customerId);
        if (!cust || ('deleted' in cust && cust.deleted)) {
          customerId = null;
        }
      } catch (_custErr) {
        console.warn(`[create-checkout-session] Customer '${customerId}' não existe no ambiente ${mode.toUpperCase()}. Buscando por e-mail...`);
        customerId = null;
      }
    }

    // Se o customerId não existe no ambiente ativo, busca pelo e-mail
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        await supabaseAdmin.from('subscriptions').update({ stripe_customer_id: customerId }).eq('tenant_id', tenantId);
      }
    }

    // Se já tiver assinatura ativa no Stripe, tenta redirecionar para o portal do cliente
    if (existingSub?.stripe_subscription_id && (existingSub.status === 'active' || existingSub.status === 'trialing') && customerId) {
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        return new Response(JSON.stringify({ url: portalSession.url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (portalErr: any) {
        console.warn("[create-checkout-session] Billing portal não disponível ou falhou, prosseguindo com Checkout normal:", portalErr?.message);
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
        ...(customPrice?.amount_override ? { custom_price_amount: String(customPrice.amount_override) } : {}),
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
    console.error("create-checkout-session error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
