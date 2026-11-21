import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getMercadoPagoContext, mpRequest } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const mpContext = await getMercadoPagoContext(supabaseAdmin);
    if (!mpContext.accessToken) {
      throw new Error(
        `Access Token do Mercado Pago (${mpContext.mode.toUpperCase()}) não configurado. Configure no Super Admin (/platform/settings).`
      );
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { planId, returnUrl, currency: requestedCurrency } = await req.json();

    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', planId).single();
    if (!plan) throw new Error("Plano não encontrado");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id, name, language, status, has_used_trial')
      .eq('id', tenantId)
      .single();

    const { data: historyData } = await supabaseAdmin
      .from('commercial_history')
      .select('id')
      .eq('normalized_email', user.email)
      .maybeSingle();

    if (historyData?.id) {
      await supabaseAdmin.from('billing_events').insert({
        history_id: historyData.id,
        tenant_id: tenantId,
        stripe_event_id: `chk_${crypto.randomUUID()}`,
        type: 'checkout_initiated',
        event_type: 'checkout_initiated',
        payload: { plan_id: plan.id, tenant_id: tenantId, provider: 'mercado_pago' },
        details: { plan_id: plan.id, tenant_id: tenantId, provider: 'mercado_pago' }
      }).catch(() => {});
    }

    const targetCurrency = (
      requestedCurrency ||
      (tenantData?.language === 'en' ? 'USD' : ['es', 'fr', 'de'].includes(tenantData?.language || '') ? 'EUR' : 'BRL')
    ).toUpperCase();

    // 1. Verificar se existe preço personalizado (Custom Pricing) para o salão
    const { data: tenantCustomPrices } = await supabaseAdmin
      .from('custom_pricing')
      .select('id, plan_id, amount_override')
      .eq('tenant_id', tenantId);

    let customPrice = tenantCustomPrices?.find(
      (cp: any) => cp.plan_id === plan.id && Number(cp.amount_override) > 0
    ) || null;

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

      if (orphanTrialCp && (paidPlans[0]?.id === plan.id || tenantCustomPrices.length === 1)) {
        customPrice = orphanTrialCp;
        await supabaseAdmin
          .from('custom_pricing')
          .update({ plan_id: plan.id })
          .eq('id', orphanTrialCp.id);
      }
    }

    // 2. Buscar preço do plano na tabela plan_prices (prioriza moeda do salão, com fallback em BRL)
    let { data: planPrice } = await supabaseAdmin
      .from('plan_prices')
      .select('amount, currency')
      .eq('plan_id', plan.id)
      .eq('currency', 'BRL')
      .maybeSingle();

    if (!planPrice) {
      const { data: fallbackPrice } = await supabaseAdmin
        .from('plan_prices')
        .select('amount, currency')
        .eq('plan_id', plan.id)
        .eq('currency', targetCurrency)
        .maybeSingle();
      planPrice = fallbackPrice;
    }

    if (!planPrice) {
      const { data: anyPrice } = await supabaseAdmin
        .from('plan_prices')
        .select('amount, currency')
        .eq('plan_id', plan.id)
        .limit(1)
        .maybeSingle();
      planPrice = anyPrice;
    }

    const finalAmountBRL = Number(
      (
        customPrice?.amount_override && Number(customPrice.amount_override) > 0
          ? Number(customPrice.amount_override)
          : Number(planPrice?.amount || plan.price || 0)
      ).toFixed(2)
    );

    if (finalAmountBRL <= 0) {
      throw new Error("Preço inválido para este plano.");
    }

    // Garantir descrição alinhada a Salões de Beleza e Esmalterias
    let cleanDescription = (plan.description || '').trim();
    if (!cleanDescription || cleanDescription.toLowerCase().includes('barbeiro')) {
      cleanDescription =
        plan.key === 'solo_tier' || plan.name?.toLowerCase() === 'solo'
          ? 'Ideal para profissionais independentes, salões de beleza e esmalterias. Agenda, clientes e financeiro.'
          : `Assinatura Plano ${plan.name} — Raffros`;
      await supabaseAdmin
        .from('plans')
        .update({ description: cleanDescription })
        .eq('id', plan.id);
    }

    const origin = (req.headers.get('origin') || 'https://raffros.com').replace(/\/+$/, '');
    const cleanReturnBase = (returnUrl || `${origin}/admin/assinatura`).split('?')[0];
    const successUrl = `${cleanReturnBase}?plan_id=${plan.id}&tenant_id=${tenantId}`;
    const failureUrl = `${cleanReturnBase}?mp_status=failure`;

    const externalReference = `sub::${tenantId}::${plan.id}::${finalAmountBRL.toFixed(2)}`;

    const prefBody: Record<string, any> = {
      items: [
        {
          id: plan.id,
          title: `Plano ${plan.name} — Raffros (30 dias)`,
          description: cleanDescription,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: finalAmountBRL,
        },
      ],
      ...(mpContext.mode === 'test' ? {} : { payer: { email: user.email } }),
      payment_methods: {
        // Exclui boleto e lotérica para evitar demora de compensação; mantém Pix + Cartão + Saldo MP
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
        ],
        excluded_payment_methods: [
          { id: 'bolbradesco' },
          { id: 'meliplace' },
          { id: 'pec' },
        ],
      },
      external_reference: externalReference,
      notification_url: `${supabaseUrl}/functions/v1/stripe-webhook`,
      back_urls: {
        success: successUrl,
        pending: successUrl,
        failure: failureUrl,
      },
      statement_descriptor: 'RAFFROS',
      metadata: {
        type: 'subscription',
        tenant_id: tenantId,
        plan_id: plan.id,
        amount: finalAmountBRL,
        user_id: user.id,
      },
    };

    if (successUrl.startsWith('https://') && !successUrl.includes('localhost') && !successUrl.includes('127.0.0.1')) {
      prefBody.auto_return = 'approved';
    }

    const pref = await mpRequest<any>('/checkout/preferences', mpContext.accessToken, {
      method: 'POST',
      body: prefBody,
    });

    const checkoutUrl = pref.init_point || pref.sandbox_init_point;

    return new Response(
      JSON.stringify({
        url: checkoutUrl,
        preferenceId: pref.id,
        provider: 'mercado_pago',
        mode: mpContext.mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("create-checkout-session (MP) error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
