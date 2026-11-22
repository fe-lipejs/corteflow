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

    // Verify JWT
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

    // Parse optional body for target_tenant_id
    let targetTenantId: string | null = null;
    try {
      const body = await req.json();
      if (body?.target_tenant_id) {
        targetTenantId = body.target_tenant_id;
      }
    } catch {
      // Body might be empty
    }

    // Find caller profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === 'super_admin';

    // Check if caller is owner of the tenant
    const { data: tenantCheck } = await supabase
      .from('tenants')
      .select('id, owner_user_id')
      .or(`owner_user_id.eq.${user.id},id.eq.${profile?.tenant_id || '00000000-0000-0000-0000-000000000000'}`)
      .maybeSingle();

    const tenantId = (isSuperAdmin && targetTenantId)
      ? targetTenantId
      : (profile?.tenant_id || tenantCheck?.id);

    let targetOwnerUserId: string | null = isSuperAdmin && targetTenantId ? null : user.id;

    if (tenantId) {
      if (isSuperAdmin && targetTenantId) {
        const { data: targetTenantRow } = await supabase
          .from('tenants')
          .select('owner_user_id')
          .eq('id', tenantId)
          .maybeSingle();
        targetOwnerUserId = targetTenantRow?.owner_user_id || null;
      }

      // 1. CANCELAR ASSINATURAS RECORRENTES (PREAPPROVAL) DO MERCADO PAGO SE EXISTIREM
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id, status')
        .eq('tenant_id', tenantId);

      if (subs && subs.length > 0) {
        const mpContext = await getMercadoPagoContext(supabase).catch(() => null);
        for (const s of subs) {
          if (s.stripe_subscription_id && s.stripe_subscription_id.startsWith('mp_pre_') && mpContext?.accessToken) {
            try {
              const preapprovalId = s.stripe_subscription_id.replace('mp_pre_', '');
              await mpRequest(`/preapproval/${preapprovalId}`, mpContext.accessToken, {
                method: 'PUT',
                body: { status: 'cancelled' },
              });
              console.log(`Assinatura Mercado Pago ${preapprovalId} cancelada com sucesso.`);
            } catch (mpErr) {
              console.warn("Aviso ao cancelar preapproval no Mercado Pago:", mpErr);
            }
          }
        }
      }

      // 2. EXCLUSÃO TOTAL DOS DADOS DO SALÃO NO BANCO
      await supabase.from('stripe_connect_accounts').delete().eq('tenant_id', tenantId);
      await supabase.from('subscriptions').delete().eq('tenant_id', tenantId);
      await supabase.from('tenant_settings').delete().eq('tenant_id', tenantId);
      await supabase.from('business_hours').delete().eq('tenant_id', tenantId);
      await supabase.from('blocked_times').delete().eq('tenant_id', tenantId);
      await supabase.from('financial_transactions').delete().eq('tenant_id', tenantId);
      await supabase.from('bookings').delete().eq('tenant_id', tenantId);
      await supabase.from('customers').delete().eq('tenant_id', tenantId);
      await supabase.from('products').delete().eq('tenant_id', tenantId);
      await supabase.from('services').delete().eq('tenant_id', tenantId);
      await supabase.from('professionals').delete().eq('tenant_id', tenantId);
      await supabase.from('notification_settings').delete().eq('tenant_id', tenantId);
      await supabase.from('custom_pricing').delete().eq('tenant_id', tenantId);
      await supabase.from('tenants').delete().eq('id', tenantId);
    }

    // 3. EXCLUIR PERFIL E USUÁRIO DO AUTH (NUNCA EXCLUIR O PRÓPRIO SUPER ADMIN)
    if (targetOwnerUserId && (!isSuperAdmin || targetOwnerUserId !== user.id)) {
      await supabase.from('profiles').delete().eq('id', targetOwnerUserId);
      try {
        await supabase.auth.admin.deleteUser(targetOwnerUserId);
      } catch (authDelErr) {
        console.warn("Aviso ao deletar usuário do auth.admin:", authDelErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Conta, assinaturas do Mercado Pago e usuário excluídos permanentemente."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Delete Account Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
