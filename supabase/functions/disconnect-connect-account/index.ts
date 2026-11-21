import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // 1. Remover vínculo no Supabase
    await supabaseAdmin
      .from('stripe_connect_accounts')
      .delete()
      .eq('tenant_id', tenantId);

    // 2. Desativar modos de pagamento online no tenant_settings e garantir Pagar no Local ativo
    await supabaseAdmin
      .from('tenant_settings')
      .update({
        accept_online_payment: false,
        accept_local_payment: true,
        booking_payment_mode: 'local',
        payment_methods: {
          pay_local: true,
          partial_50: false,
          full_100: false,
        },
      } as any)
      .eq('tenant_id', tenantId);

    return new Response(JSON.stringify({
      success: true,
      message: "Conta Mercado Pago desvinculada com sucesso.",
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error("Disconnect Mercado Pago Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
