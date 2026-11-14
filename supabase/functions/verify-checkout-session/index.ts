import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
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

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId é obrigatório");

    // Retrieve session from Stripe with expanded subscription
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    if (!session) throw new Error("Sessão Stripe não encontrada");

    const tenantId = session.metadata?.tenant_id;
    const planId = session.metadata?.plan_id;

    if (!tenantId || !planId) {
      throw new Error("Metadados de tenant_id ou plan_id ausentes na sessão do Stripe");
    }

    // Verify user belongs to this tenant or is super_admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin' && profile?.tenant_id !== tenantId) {
      throw new Error("Acesso negado: você não é dono deste salão");
    }

    const stripeSub = session.subscription as Stripe.Subscription | null;
    const subId = typeof stripeSub === 'string' ? stripeSub : stripeSub?.id;
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id;

    let trialEndsAt: string | null = null;
    let currentPeriodEnd: string | null = null;

    if (stripeSub && typeof stripeSub !== 'string') {
      if (stripeSub.trial_end) {
        trialEndsAt = new Date(stripeSub.trial_end * 1000).toISOString();
      }
      if (stripeSub.current_period_end) {
        currentPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
      }
    }

    // Se o salão tinha uma assinatura anterior diferente no Stripe, cancela a anterior para evitar cobrança dupla
    const { data: previousSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, stripe_subscription_id, subscription_contracts(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const previousContract = Array.isArray(previousSub?.subscription_contracts)
      ? previousSub?.subscription_contracts[0]
      : previousSub?.subscription_contracts;

    if (previousSub?.stripe_subscription_id && subId && previousSub.stripe_subscription_id !== subId) {
      try {
        await stripe.subscriptions.cancel(previousSub.stripe_subscription_id);
        console.log(`Assinatura anterior ${previousSub.stripe_subscription_id} cancelada com sucesso no Stripe.`);
      } catch (cancelErr) {
        console.warn(`Aviso ao cancelar assinatura anterior no Stripe:`, cancelErr);
      }
    }

    const isTrialing = stripeSub && typeof stripeSub !== 'string' && stripeSub.status === 'trialing' && !!stripeSub.trial_end;
    const correctSubStatus = isTrialing ? 'trialing' : 'active';
    const correctTenantStatus = isTrialing ? 'trial' : 'active';
    const correctAccountState = isTrialing ? 'trialing_with_card' : 'active';

    // Upsert subscription directly with service role
    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
      tenant_id: tenantId,
      plan_id: planId,
      stripe_subscription_id: subId,
      stripe_customer_id: customerId,
      status: correctSubStatus,
      trial_ends_at: trialEndsAt,
      current_period_end: currentPeriodEnd,
      grace_period_ends_at: null,
      suspension_reason: null,
      canceled_at: null,
      latest_invoice_status: 'paid',
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });

    if (upsertError) throw upsertError;

    // Preservar permissões/limites personalizados e preço promocional (custom_pricing)
    const stripeUnitAmountCents =
      (stripeSub && typeof stripeSub !== 'string' && stripeSub.items?.data?.[0]?.price?.unit_amount) ||
      session.amount_total ||
      null;
    await preserveCustomContractAndPricing(supabaseAdmin, tenantId, planId, previousContract, stripeUnitAmountCents);

    // Ensure tenant is in correct state (trial or active) based on Stripe subscription
    await supabaseAdmin.from('tenants').update({
      status: correctTenantStatus,
      account_state: correctAccountState,
      trial_ends_at: trialEndsAt,
      past_due_since: null,
      has_used_trial: true,
    }).eq('id', tenantId);

    return new Response(JSON.stringify({ 
      success: true, 
      tenantId, 
      planId,
      status: correctSubStatus 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('verify-checkout-session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
