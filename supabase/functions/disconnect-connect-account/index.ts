import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY não configurada.");
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

    // Buscar tenant do usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // Buscar registro connect da conta
    const { data: connectAcc } = await supabase
      .from('stripe_connect_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const accountId = connectAcc?.stripe_account_id;

    if (accountId) {
      try {
        // Excluir / desvincular conta Express diretamente na API do Stripe
        await stripe.accounts.del(accountId);
      } catch (stripeErr: any) {
        console.warn("Aviso ao desvincular no Stripe (tentando deauthorize):", stripeErr);
        try {
          const clientId = Deno.env.get('STRIPE_CONNECT_CLIENT_ID');
          if (clientId) {
            await stripe.oauth.deauthorize({
              client_id: clientId,
              stripe_user_id: accountId,
            });
          }
        } catch (deauthErr) {
          console.warn("Deauthorize error (ignorado se já excluída):", deauthErr);
        }
      }
    }

    // 1. Remover vínculo no Supabase
    await supabase
      .from('stripe_connect_accounts')
      .delete()
      .eq('tenant_id', tenantId);

    // 2. Desativar modos de pagamento online no tenant_settings e garantir Pagar no Local ativo
    await supabase
      .from('tenant_settings')
      .update({
        online_payment_enabled: false,
        payment_methods: {
          pay_local: true,
          partial_50: false,
          full_100: false,
        },
      } as any)
      .eq('tenant_id', tenantId);

    return new Response(JSON.stringify({
      success: true,
      message: "Conta Stripe desvinculada com sucesso tanto no Stripe quanto no sistema.",
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error("Disconnect Connect Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
