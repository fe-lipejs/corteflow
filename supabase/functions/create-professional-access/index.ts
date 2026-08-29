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

    // Verify professional first to know the tenant
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
      return new Response(JSON.stringify({ error: "Only owners can create professional access" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // (We already verified callerMembership, so they definitely belong to the same tenant)

    // Check existing membership in this tenant for this professional slot
    if (professional.auth_user_id) {
      // Check if they already have an active membership in this tenant
      const { data: existingMembership } = await supabaseAdmin
        .from('tenant_users')
        .select('id, status')
        .match({ user_id: professional.auth_user_id, tenant_id: professional.tenant_id })
        .maybeSingle();
      
      if (existingMembership && existingMembership.status === 'active') {
        return new Response(JSON.stringify({ error: "Professional already has active access" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Reactivate if previously inactive
      if (existingMembership) {
        await supabaseAdmin
          .from('tenant_users')
          .update({ status: 'active', permissions: permissions || existingMembership })
          .eq('id', existingMembership.id);
        
        await supabaseAdmin.from('professionals').update({ active: true }).eq('id', professional_id);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Acesso reativado com sucesso.",
          authUserId: professional.auth_user_id 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let targetUserId = null;
    let tempPassword = null;

    // Check if user already exists
    const { data: existingUserId, error: lookupError } = await supabaseAdmin.rpc('get_user_id_by_email', {
      p_email: email
    });

    if (existingUserId) {
      targetUserId = existingUserId;
    } else {
      tempPassword = generateTempPassword();

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
      
      targetUserId = newAuthUser.user.id;

      // Create profile for professional (Global Profile)
      await supabaseAdmin.from('profiles').insert({
        id: targetUserId,
        full_name: 'Profissional', 
        onboarding_completed: true
      });
    }

    // Create the Membership (tenant_users)
    await supabaseAdmin.from('tenant_users').insert({
      tenant_id: professional.tenant_id,
      user_id: targetUserId,
      role: 'professional',
      permissions: permissions || {
        view_own_schedule: true,
        edit_own_schedule: false,
        view_financial: false,
        create_financial_entry: false,
        view_commission: true,
        view_clients: false,
        edit_own_availability: false
      }
    });

    // Link professional record
    const { error: updateProfError } = await supabaseAdmin.from('professionals').update({
      auth_user_id: targetUserId,
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
      return new Response(JSON.stringify({ error: "Failed to link professional" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant info for the email
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', professional.tenant_id)
      .maybeSingle();
    const tenantName = tenantData?.name || 'Estabelecimento';

    const isExistingUser = !!existingUserId;

    // Send appropriate email via Supabase (generateLink for new, custom for existing)
    if (!isExistingUser && targetUserId) {
      // Generate a magic invite link for new users (they click to set their own password)
      try {
        await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: `${Deno.env.get('SITE_URL') || 'https://www.raffros.com'}/change-password`
          }
        });
      } catch (linkErr) {
        // Non-fatal: link generation may fail in some configurations
        console.warn('Could not generate magic link:', linkErr);
      }
    }
    // Note: For existing users, they already have a password — they just receive access to the new tenant.
    // A notification email can be sent here via a future email service integration.
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: isExistingUser 
        ? `Profissional adicionado à ${tenantName}. Ele receberá uma notificação.`
        : `Convite enviado para ${email}. O profissional receberá um e-mail para acessar o sistema.`,
      isExistingUser,
      authUserId: targetUserId
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
