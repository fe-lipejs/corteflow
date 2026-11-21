import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getMercadoPagoContext, mpRequest } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .maybeSingle();

    const { data: tenantCheck } = await supabase
      .from('tenants')
      .select('id, owner_user_id')
      .or(`owner_user_id.eq.${user.id},id.eq.${profile?.tenant_id || '00000000-0000-0000-0000-000000000000'}`)
      .maybeSingle();

    const isOwner = profile?.role === 'owner' || tenantCheck?.owner_user_id === user.id || Boolean(tenantCheck?.id);
    const isSuperAdmin = profile?.role === 'super_admin';

    if (!isSuperAdmin && !isOwner) {
      return new Response(JSON.stringify({ error: "Apenas o dono da conta pode cancelar a assinatura." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile?.tenant_id || tenantCheck?.id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub || sub.status === 'canceled') {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura ativa encontrada para este salão." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se houver uma assinatura recorrente (preapproval) do Mercado Pago, cancela na API
    if (sub.stripe_subscription_id && sub.stripe_subscription_id.startsWith('mp_pre_')) {
      try {
        const mpContext = await getMercadoPagoContext(supabase);
        if (mpContext.accessToken) {
          const preapprovalId = sub.stripe_subscription_id.replace('mp_pre_', '');
          await mpRequest(`/preapproval/${preapprovalId}`, mpContext.accessToken, {
            method: 'PUT',
            body: { status: 'cancelled' },
          });
        }
      } catch (mpErr: any) {
        console.warn('[cancel-subscription] Aviso ao cancelar preapproval no Mercado Pago:', mpErr?.message);
      }
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    await supabase
      .from('tenants')
      .update({
        account_state: 'canceled',
      })
      .eq('id', tenantId);

    return new Response(JSON.stringify({
      success: true,
      message: "Assinatura cancelada com sucesso. Seu acesso continua disponível até o final do período atual."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Cancel subscription (MP) error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
