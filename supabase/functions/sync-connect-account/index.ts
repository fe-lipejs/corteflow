import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getStripeContext } from '../_shared/stripe.ts';

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

    // Buscar tenant do usuário
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    // Buscar registro connect
    const { data: connectAcc } = await supabaseAdmin
      .from('stripe_connect_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!connectAcc?.stripe_account_id) {
      return new Response(JSON.stringify({
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Consultar estado real no Stripe (com proteção caso a conta seja do outro modo Test/Live)
    let account: any = null;
    try {
      account = await stripe.accounts.retrieve(connectAcc.stripe_account_id);
    } catch (err: any) {
      console.warn(`[sync-connect-account] Conta Connect '${connectAcc.stripe_account_id}' não existe no Stripe ${mode.toUpperCase()}:`, err.message);
      
      // Se a conta não existe neste ambiente, reseta no banco para permitir conectar no novo ambiente
      await supabaseAdmin
        .from('stripe_connect_accounts')
        .delete()
        .eq('tenant_id', tenantId);

      return new Response(JSON.stringify({
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
        mode_mismatch: true,
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const wasAlreadyEnabled = connectAcc.charges_enabled === true;
    const nowEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;

    // Atualizar no banco
    await supabaseAdmin.from('stripe_connect_accounts').update({
      charges_enabled: nowEnabled,
      payouts_enabled: payoutsEnabled,
    }).eq('tenant_id', tenantId);

    let justActivated = false;

    // Se foi habilitado agora (ou se é a primeira vez ativo)
    if (nowEnabled && !wasAlreadyEnabled) {
      justActivated = true;

      // Auto-ativar métodos online no tenant_settings mantendo local ativo
      const { data: currentSettings } = await supabaseAdmin
        .from('tenant_settings')
        .select('payment_methods')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const currentPm = (currentSettings?.payment_methods as any) || {};

      await supabaseAdmin.from('tenant_settings').update({
        payment_methods: {
          pay_local: currentPm.pay_local !== false,
          partial_50: true,
          full_100: true,
        },
        accept_online_payment: true,
        accept_local_payment: currentPm.pay_local !== false,
        booking_payment_mode: currentPm.pay_local === false ? 'deposit' : 'client_choice',
      }).eq('tenant_id', tenantId);
    }

    return new Response(JSON.stringify({
      has_account: true,
      stripe_account_id: account.id,
      charges_enabled: nowEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: account.details_submitted,
      just_activated: justActivated,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err: any) {
    console.error("Sync Connect Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
