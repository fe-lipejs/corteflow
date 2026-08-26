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
    const { professional_id, auth_user_id } = body;

    if (!professional_id || !auth_user_id) {
      return new Response(JSON.stringify({ error: "Missing professional_id or auth_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner of the professional's tenant
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'owner' && callerProfile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: "Only owners can delete professional access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify professional belongs to the caller's tenant
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

    if (callerProfile.role !== 'super_admin' && professional.tenant_id !== callerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: "Professional does not belong to your tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (professional.auth_user_id !== auth_user_id) {
      return new Response(JSON.stringify({ error: "Auth ID mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE the membership (tenant_users)
    await supabaseAdmin
      .from('tenant_users')
      .delete()
      .match({ user_id: auth_user_id, tenant_id: professional.tenant_id });

    // Check if the user has other memberships
    const { data: otherMemberships, error: memError } = await supabaseAdmin
      .from('tenant_users')
      .select('id')
      .eq('user_id', auth_user_id);

    // If no other memberships exist, we can hard delete the auth user
    if (!memError && (!otherMemberships || otherMemberships.length === 0)) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
      
      if (deleteUserError && !deleteUserError.message.includes('not found')) {
        return new Response(JSON.stringify({ error: deleteUserError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Also delete the global profile
      await supabaseAdmin.from('profiles').delete().eq('id', auth_user_id);
    }

    // Set professional record to inactive and unlink auth
    const { error: profError } = await supabaseAdmin
      .from('professionals')
      .update({ active: false, auth_user_id: null })
      .eq('id', professional_id);

    if (profError) {
      return new Response(JSON.stringify({ error: profError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Acesso removido com sucesso." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
