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

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${req.headers.get('origin') ?? 'https://app.raffros.com'}/app/assinatura`;

    // 1. Buscar perfil e tenant do usuário
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    let tenantId = profile?.tenant_id;
    if (!tenantId) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      tenantId = tenant?.id;
    }

    if (!tenantId) {
      throw new Error("Estabelecimento não encontrado para este usuário");
    }

    // 2. Buscar customer_id na tabela subscriptions
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    // 3. Se tiver customerId gravado, valida se ele existe no ambiente atual do Stripe
    let customerValid = false;
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if (c && !('deleted' in c && c.deleted)) {
          customerValid = true;
        }
      } catch (err: any) {
        console.warn(`[create-portal-session] Customer '${customerId}' não existe no ambiente ${mode.toUpperCase()}:`, err.message);
        customerId = null;
      }
    }

    // 4. Se não for válido ou não tiver no banco, busca no Stripe pelo email do usuário no ambiente ativo
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        customerValid = true;
        await supabaseAdmin
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('tenant_id', tenantId);
      }
    }

    if (!customerId) {
      throw new Error(
        `Nenhum histórico de cliente Stripe encontrado no ambiente ${mode.toUpperCase()}. Para gerenciar pagamentos, realize uma assinatura no plano desejado.`
      );
    }

    // 5. Criar sessão no Stripe Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
