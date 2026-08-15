import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      throw new Error("Missing environment variables");
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

    // Find user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .maybeSingle();

    // Check if user is owner of the tenant
    const { data: tenantCheck } = await supabase
      .from('tenants')
      .select('id, owner_user_id')
      .or(`owner_user_id.eq.${user.id},id.eq.${profile?.tenant_id || '00000000-0000-0000-0000-000000000000'}`)
      .maybeSingle();

    const tenantId = (profile?.role === 'super_admin' && targetTenantId) 
      ? targetTenantId 
      : (profile?.tenant_id || tenantCheck?.id);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    if (tenantId) {
      // 1. CANCELAR TODAS AS ASSINATURAS DO STRIPE IMEDIATAMENTE
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id, status')
        .eq('tenant_id', tenantId);

      if (subs && subs.length > 0) {
        for (const s of subs) {
          if (s.stripe_subscription_id) {
            try {
              await stripe.subscriptions.cancel(s.stripe_subscription_id);
              console.log(`Assinatura Stripe ${s.stripe_subscription_id} cancelada com sucesso.`);
            } catch (stripeErr) {
              console.error("Erro ao cancelar assinatura no Stripe:", stripeErr);
            }
          }
        }
      }

      // 2. EXCLUIR CONTA STRIPE CONNECT SE EXISTIR
      const { data: connectAccount } = await supabase
        .from('stripe_connect_accounts')
        .select('stripe_account_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (connectAccount?.stripe_account_id) {
        try {
          await stripe.accounts.del(connectAccount.stripe_account_id);
        } catch (err) {
          console.warn("Aviso ao excluir conta connect:", err);
        }
      }

      // 3. EXCLUSÃO TOTAL DOS DADOS DO SALÃO NO BANCO
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

    // 4. EXCLUIR PERFIL E USUÁRIO DO AUTH (PARA NUNCA MAIS CONSEGUIR LOGAR)
    await supabase.from('profiles').delete().eq('id', user.id);
    
    // Deleta permanentemente o usuário do Auth do Supabase
    try {
      await supabase.auth.admin.deleteUser(user.id);
    } catch (authDelErr) {
      console.warn("Aviso ao deletar usuário do auth.admin:", authDelErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Conta, assinaturas Stripe e usuário excluídos permanentemente."
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
