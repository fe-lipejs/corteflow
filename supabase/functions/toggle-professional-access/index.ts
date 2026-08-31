import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    
    // Validate who is calling the function
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { professional_id, action } = body; // action: 'enable' | 'disable'

    if (!professional_id || !action) {
      return new Response(JSON.stringify({ error: "Missing professional_id or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify professional first
    const { data: professional } = await supabaseAdmin
      .from('professionals')
      .select('tenant_id, auth_user_id')
      .eq('id', professional_id)
      .maybeSingle();

    if (!professional) {
      return new Response(JSON.stringify({ error: "Professional not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner of the professional's tenant
    const { data: callerMembership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .match({ user_id: user.id, tenant_id: professional.tenant_id, status: 'active' })
      .maybeSingle();

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (callerMembership?.role !== 'owner' && callerProfile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: "Only owners can toggle access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!professional.auth_user_id) {
      return new Response(JSON.stringify({ error: "Professional does not have access enabled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isActive = action === 'enable';

    // Update professionals.active
    await supabaseAdmin.from('professionals').update({
      active: isActive
    }).eq('id', professional_id);

    // Update auth user ban duration
    const banDuration = isActive ? 'none' : '876600h'; // 100 years if disabled
    
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
      professional.auth_user_id,
      { ban_duration: banDuration }
    );

    if (updateUserError) {
      return new Response(JSON.stringify({ error: updateUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      active: isActive
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Toggle Professional Access Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
