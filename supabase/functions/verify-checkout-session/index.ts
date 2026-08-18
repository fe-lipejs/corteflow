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
      throw new Error("STRIPE_SECRET_KEY não configurada no backend.");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      .select('stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (previousSub?.stripe_subscription_id && subId && previousSub.stripe_subscription_id !== subId) {
      try {
        await stripe.subscriptions.cancel(previousSub.stripe_subscription_id);
        console.log(`Assinatura anterior ${previousSub.stripe_subscription_id} cancelada com sucesso no Stripe.`);
      } catch (cancelErr) {
        console.warn(`Aviso ao cancelar assinatura anterior no Stripe:`, cancelErr);
      }
    }

    // Upsert subscription directly with service role
    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
      tenant_id: tenantId,
      plan_id: planId,
      stripe_subscription_id: subId,
      stripe_customer_id: customerId,
      status: 'active',
      trial_ends_at: trialEndsAt,
      current_period_end: currentPeriodEnd,
      grace_period_ends_at: null,
      suspension_reason: null,
      canceled_at: null,
      latest_invoice_status: 'paid',
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });

    if (upsertError) throw upsertError;

    // Ensure tenant is active
    await supabaseAdmin.from('tenants').update({ status: 'active' }).eq('id', tenantId);

    return new Response(JSON.stringify({ 
      success: true, 
      tenantId, 
      planId,
      status: 'active' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('verify-checkout-session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
