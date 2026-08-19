import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates a random secure password
function generateTempPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure at least one special char, one number, one uppercase
  password += "A1!";
  return password;
}

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
    const { professional_id, email, permissions } = body;

    if (!professional_id || !email) {
      return new Response(JSON.stringify({ error: "Missing professional_id or email" }), {
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
      return new Response(JSON.stringify({ error: "Only owners can create professional access" }), {
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

    if (professional.auth_user_id) {
      return new Response(JSON.stringify({ error: "Professional already has access" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tempPassword = generateTempPassword();

    // Create auth user
    const { data: newAuthUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        is_professional: true
      }
    });

    if (createUserError) {
      return new Response(JSON.stringify({ error: createUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile for professional
    await supabaseAdmin.from('profiles').insert({
      id: newAuthUser.user.id,
      tenant_id: professional.tenant_id,
      role: 'professional',
      full_name: 'Profissional', // Will be updated by them or taken from professional record
      onboarding_completed: true
    });

    // Link professional record
    const { error: updateProfError } = await supabaseAdmin.from('professionals').update({
      auth_user_id: newAuthUser.user.id,
      active: true,
      force_password_change: true,
      permissions: permissions || {
        view_own_schedule: true,
        edit_own_schedule: false,
        view_financial: false,
        create_financial_entry: false,
        view_commission: true,
        view_clients: false,
        edit_own_availability: false
      }
    }).eq('id', professional_id);

    if (updateProfError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(JSON.stringify({ error: "Failed to link professional" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      tempPassword: tempPassword,
      authUserId: newAuthUser.user.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Create Professional Access Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
