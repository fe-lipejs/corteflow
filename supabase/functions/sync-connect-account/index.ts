import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getMercadoPagoContext, getTenantMercadoPagoAccount, mpRequest } from '../_shared/stripe.ts';

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

    const mpContext = await getMercadoPagoContext(supabaseAdmin);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    const { data: connectAcc } = await supabaseAdmin
      .from('stripe_connect_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!connectAcc || !connectAcc.mp_access_token) {
      return new Response(JSON.stringify({
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const tenantMp = await getTenantMercadoPagoAccount(supabaseAdmin, tenantId, mpContext);
    if (!tenantMp) {
      return new Response(JSON.stringify({
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Valida se o token do salão segue ativo no Mercado Pago
    let mpUser: any = null;
    try {
      mpUser = await mpRequest('/users/me', tenantMp.accessToken, { method: 'GET' });
    } catch (err: any) {
      console.warn('[sync-connect-account] Token Mercado Pago inválido ou revogado:', err?.message);
      return new Response(JSON.stringify({
        has_account: true,
        charges_enabled: false,
        payouts_enabled: false,
        token_invalid: true,
        error_detail: err?.message,
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const wasAlreadyEnabled = connectAcc.charges_enabled === true;
    const nickname =
      mpUser?.nickname ||
      [mpUser?.first_name, mpUser?.last_name].filter(Boolean).join(' ') ||
      connectAcc.mp_nickname ||
      null;
    const email = mpUser?.email || connectAcc.mp_email || null;

    await supabaseAdmin
      .from('stripe_connect_accounts')
      .update({
        charges_enabled: true,
        payouts_enabled: true,
        mp_user_id: String(mpUser?.id || connectAcc.mp_user_id || ''),
        mp_email: email,
        mp_nickname: nickname,
      } as any)
      .eq('tenant_id', tenantId);

    let justActivated = false;
    if (!wasAlreadyEnabled) {
      justActivated = true;
      const { data: currentSettings } = await supabaseAdmin
        .from('tenant_settings')
        .select('payment_methods')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const currentPm = (currentSettings?.payment_methods as any) || {};
      await supabaseAdmin
        .from('tenant_settings')
        .update({
          payment_methods: {
            pay_local: currentPm.pay_local !== false,
            partial_50: true,
            full_100: true,
          },
          accept_online_payment: true,
          accept_local_payment: currentPm.pay_local !== false,
        } as any)
        .eq('tenant_id', tenantId);
    }

    return new Response(JSON.stringify({
      has_account: true,
      charges_enabled: true,
      payouts_enabled: true,
      just_activated: justActivated,
      stripe_account_id: connectAcc.stripe_account_id || `mp_${mpUser?.id}`,
      mp_user_id: String(mpUser?.id || connectAcc.mp_user_id || ''),
      mp_email: email,
      mp_nickname: nickname,
      is_oauth: Boolean(connectAcc.mp_refresh_token),
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error("Sync Mercado Pago Connect Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
