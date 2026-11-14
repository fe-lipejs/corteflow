import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getStripeContext, preserveCustomContractAndPricing } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { stripe } = await getStripeContext(supabaseAdmin);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // 1. Check existing subscription record for customer ID
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('*, subscription_contracts(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const previousContract = Array.isArray(existingSub?.subscription_contracts)
      ? existingSub?.subscription_contracts[0]
      : existingSub?.subscription_contracts;

    let customerId = existingSub?.stripe_customer_id;

    // Se temos um customerId salvo, verificar se ele existe na conta ativa do Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err: any) {
        if (err?.code === 'resource_missing' || err?.statusCode === 404) {
          // O ID pertence a outro modo (ex: teste vs live) ou foi excluído
          customerId = null;
        }
      }
    }

    // 2. If no valid customer ID, search Stripe by user email
    if (!customerId && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      } catch (_) {}
    }

    if (!customerId) {
      return new Response(JSON.stringify({ 
        synced: false, 
        message: "Nenhuma conta de faturamento do Stripe foi encontrada para este e-mail." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Find active subscriptions on Stripe for this customer
    let subs: any;
    try {
      subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 5,
        expand: ['data.default_payment_method']
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ 
        synced: false, 
        message: "Erro ao consultar assinaturas no Stripe." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const activeStripeSub = subs?.data?.find((s: any) => s.status === 'active' || s.status === 'trialing') || subs?.data?.[0];

    if (!activeStripeSub) {
      return new Response(JSON.stringify({ 
        synced: false, 
        message: "Nenhuma assinatura ativa encontrada no Stripe." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 4. Resolve plan_id from metadata or matching plan
    let planId = activeStripeSub.metadata?.plan_id;
    if (!planId) {
      // Find plan with starter/pro matching or default to Starter
      const { data: starterPlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('key', 'starter')
        .maybeSingle();
      planId = starterPlan?.id;
    }

    if (!planId) {
      const { data: firstPlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();
      planId = firstPlan.id;
    }

    const trialEndsAt = activeStripeSub.trial_end ? new Date(activeStripeSub.trial_end * 1000).toISOString() : null;
    const currentPeriodEnd = new Date(activeStripeSub.current_period_end * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
      tenant_id: tenantId,
      plan_id: planId,
      stripe_subscription_id: activeStripeSub.id,
      stripe_customer_id: customerId,
      status: activeStripeSub.status,
      trial_ends_at: trialEndsAt,
      current_period_end: currentPeriodEnd,
      grace_period_ends_at: null,
      suspension_reason: null,
      canceled_at: activeStripeSub.canceled_at ? new Date(activeStripeSub.canceled_at * 1000).toISOString() : null,
      latest_invoice_status: 'paid',
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });

    if (upsertError) throw upsertError;

    const stripeUnitAmountCents = activeStripeSub?.items?.data?.[0]?.price?.unit_amount || null;
    await preserveCustomContractAndPricing(supabaseAdmin, tenantId, planId, previousContract, stripeUnitAmountCents);

    await supabaseAdmin.from('tenants').update({ status: 'active' }).eq('id', tenantId);

    return new Response(JSON.stringify({ 
      synced: true, 
      status: activeStripeSub.status,
      subscriptionId: activeStripeSub.id,
      planId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('sync-stripe-subscription error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
