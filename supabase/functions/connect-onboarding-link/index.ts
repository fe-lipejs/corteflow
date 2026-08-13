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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Buscar tenant associado ao usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // Verificar se já existe uma conta Stripe Connect
    let { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let accountId = connectAccount?.stripe_account_id;

    if (!accountId) {
      // Criar nova conta Express no Stripe
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Salvar no Supabase
      const { error: insertError } = await supabase.from('stripe_connect_accounts').upsert({
        tenant_id: tenantId,
        stripe_account_id: accountId,
        charges_enabled: false,
        payouts_enabled: false,
      }, { onConflict: 'tenant_id' });

      if (insertError) throw new Error(`Erro ao salvar conta: ${insertError.message}`);
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:5173';
    
    // Gerar link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/app/configuracoes?tab=stripe`,
      return_url: `${origin}/app/configuracoes?tab=stripe`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err: any) {
    console.error("Stripe Onboarding Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
