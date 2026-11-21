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
    if (!mpContext.accessToken) {
      throw new Error("Access Token do Mercado Pago não configurado.");
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const body = await req.json().catch(() => ({}));
    const paymentId = body.paymentId || body.collectionId || body.sessionId;
    const bodyPlanId = body.planId;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id && profile?.role !== 'super_admin') {
      throw new Error("Salão não encontrado para este usuário");
    }

    let mpPayment: any = null;

    if (paymentId && /^\d+$/.test(String(paymentId).trim())) {
      mpPayment = await mpRequest<any>(`/v1/payments/${String(paymentId).trim()}`, mpContext.accessToken, {
        method: 'GET',
      });
    } else if (profile?.tenant_id) {
      // Fallback: busca o pagamento mais recente deste tenant no Mercado Pago
      const searchRes = await mpRequest<any>(
        `/v1/payments/search?sort=date_created&criteria=desc&limit=25`,
        mpContext.accessToken,
        { method: 'GET' }
      );
      const list: any[] = searchRes?.results || [];
      mpPayment =
        list.find(
          (p) =>
            p.status === 'approved' &&
            (p.metadata?.tenant_id === profile.tenant_id ||
              (typeof p.external_reference === 'string' && p.external_reference.includes(`sub::${profile.tenant_id}::`)))
        ) ||
        list.find(
          (p) =>
            p.metadata?.tenant_id === profile.tenant_id ||
            (typeof p.external_reference === 'string' && p.external_reference.includes(`sub::${profile.tenant_id}::`))
        ) ||
        null;
    }

    if (!mpPayment) {
      return new Response(
        JSON.stringify({
          success: false,
          pending: true,
          message: "Pagamento ainda não localizado no Mercado Pago.",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extrair tenantId e planId do metadata ou external_reference ("sub::tenantId::planId::amount")
    let tenantId = mpPayment.metadata?.tenant_id || profile?.tenant_id;
    let planId = mpPayment.metadata?.plan_id || bodyPlanId;

    if (typeof mpPayment.external_reference === 'string' && mpPayment.external_reference.startsWith('sub::')) {
      const parts = mpPayment.external_reference.split('::');
      if (parts[1]) tenantId = parts[1];
      if (parts[2]) planId = parts[2];
    }

    if (!tenantId || !planId) {
      throw new Error("Metadados de salão ou plano ausentes no pagamento Mercado Pago.");
    }

    if (profile?.role !== 'super_admin' && profile?.tenant_id !== tenantId) {
      throw new Error("Acesso negado: você não é dono deste salão");
    }

    if (mpPayment.status !== 'approved') {
      return new Response(
        JSON.stringify({
          success: false,
          pending: true,
          status: mpPayment.status,
          message:
            mpPayment.status === 'in_process' || mpPayment.status === 'pending'
              ? "Pagamento em processamento no Mercado Pago. Assim que compensar, seu plano será liberado automaticamente."
              : `Pagamento não aprovado (status: ${mpPayment.status}).`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { data: previousSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, subscription_contracts(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const previousContract = Array.isArray(previousSub?.subscription_contracts)
      ? previousSub?.subscription_contracts[0]
      : previousSub?.subscription_contracts;

    const nowMs = Date.now();
    const currentPeriodEnd = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
    const mpSubMarker = `mp_pay_${mpPayment.id}`;
    const mpCustomerMarker = mpPayment.payer?.id ? `mp_cust_${mpPayment.payer.id}` : null;

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

    const paidCents = mpPayment.transaction_amount
      ? Math.round(Number(mpPayment.transaction_amount) * 100)
      : null;
    await preserveCustomContractAndPricing(supabaseAdmin, tenantId, planId, previousContract, paidCents);

    await supabaseAdmin.from('tenants').update({
      status: 'active',
      account_state: 'active',
      trial_ends_at: null,
      past_due_since: null,
      has_used_trial: true,
    }).eq('id', tenantId);

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        planId,
        status: 'active',
        paymentId: String(mpPayment.id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('verify-checkout-session (MP) error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
