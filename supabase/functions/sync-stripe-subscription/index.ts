import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getMercadoPagoContext,
  mpRequest,
  preserveCustomContractAndPricing,
} from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const mpContext = await getMercadoPagoContext(supabaseAdmin);

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

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('*, subscription_contracts(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const previousContract = Array.isArray(existingSub?.subscription_contracts)
      ? existingSub?.subscription_contracts[0]
      : existingSub?.subscription_contracts;

    // Se ainda não há Access Token do Mercado Pago configurado na plataforma, não quebra a UI
    if (!mpContext.accessToken) {
      return new Response(JSON.stringify({
        synced: false,
        message: "Mercado Pago ainda não configurado nas configurações globais da plataforma."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Buscar pagamentos recentes aprovados no Mercado Pago para este tenant
    let results: any[] = [];
    try {
      const searchRes = await mpRequest<any>(
        `/v1/payments/search?status=approved&sort=date_created&criteria=desc&limit=100`,
        mpContext.accessToken,
        { method: 'GET' }
      );
      results = Array.isArray(searchRes?.results) ? searchRes.results : [];
    } catch (mpErr: any) {
      console.warn('[sync-stripe-subscription] Aviso ao consultar Mercado Pago:', mpErr?.message);
      return new Response(JSON.stringify({
        synced: false,
        message: "Não foi possível consultar o Mercado Pago no momento."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const matchedPayment = results.find((p) => {
      if (p.status !== 'approved') return false;
      if (mpContext.mode === 'live' && p.live_mode === false) return false;
      const isThisTenant =
        p.metadata?.tenant_id === tenantId ||
        (typeof p.external_reference === 'string' && p.external_reference.includes(`sub::${tenantId}::`));
      if (!isThisTenant) return false;
      const approvedAt = new Date(p.date_approved || p.date_created).getTime();
      // Só considera válido o pagamento cujo ciclo de 30 dias ainda não venceu!
      if (Number.isNaN(approvedAt) || approvedAt + thirtyDaysMs <= nowMs) return false;
      if (typeof p.external_reference === 'string' && p.external_reference.startsWith('sub::')) {
        const parts = p.external_reference.split('::');
        const expectedBRL = Number(parts[3] || 0);
        if (expectedBRL > 0 && Number(p.transaction_amount || 0) + 0.05 < expectedBRL) return false;
      }
      // Não reativa se o dono cancelou explicitamente depois desse pagamento
      if (existingSub?.status === 'canceled' && existingSub?.canceled_at) {
        if (new Date(existingSub.canceled_at).getTime() > approvedAt) return false;
      }
      return true;
    });

    if (!matchedPayment) {
      return new Response(JSON.stringify({
        synced: false,
        message: "Nenhum pagamento recente aprovado encontrado no Mercado Pago para este salão."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let planId = matchedPayment.metadata?.plan_id || existingSub?.plan_id;
    if (typeof matchedPayment.external_reference === 'string' && matchedPayment.external_reference.startsWith('sub::')) {
      const parts = matchedPayment.external_reference.split('::');
      if (parts[2]) planId = parts[2];
    }

    if (!planId) {
      const { data: firstPlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('active', true)
        .eq('is_trial_plan', false)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      planId = firstPlan?.id;
    }

    if (!planId) {
      return new Response(JSON.stringify({
        synced: false,
        message: "Plano associado ao pagamento não encontrado."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const approvedBaseMs = new Date(matchedPayment.date_approved || matchedPayment.date_created).getTime();
    const currentPeriodEnd = new Date(approvedBaseMs + 30 * 24 * 60 * 60 * 1000).toISOString();
    const mpSubMarker = `mp_pay_${matchedPayment.id}`;
    const mpCustomerMarker = matchedPayment.payer?.id ? `mp_cust_${matchedPayment.payer.id}` : existingSub?.stripe_customer_id || null;

    const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert({
      tenant_id: tenantId,
      plan_id: planId,
      stripe_subscription_id: mpSubMarker,
      stripe_customer_id: mpCustomerMarker,
      status: 'active',
      trial_ends_at: null,
      current_period_end: currentPeriodEnd,
      grace_period_ends_at: null,
      suspension_reason: null,
      canceled_at: null,
      latest_invoice_status: 'paid',
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });

    if (upsertError) throw upsertError;

    const paidCents = matchedPayment.transaction_amount
      ? Math.round(Number(matchedPayment.transaction_amount) * 100)
      : null;
    await preserveCustomContractAndPricing(supabaseAdmin, tenantId, planId, previousContract, paidCents);

    await supabaseAdmin.from('tenants').update({
      status: 'active',
      account_state: 'active',
      trial_ends_at: null,
      past_due_since: null,
      has_used_trial: true,
    }).eq('id', tenantId);

    return new Response(JSON.stringify({
      synced: true,
      status: 'active',
      subscriptionId: mpSubMarker,
      planId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('sync-stripe-subscription (MP) error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
