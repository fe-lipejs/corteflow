-- =============================================================================
-- Migration: 20261122140500_super_admin_tenant_info_rpc.sql
-- RPC exclusiva para Super Admin consultar informações completas do cliente/salão
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_info(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_profile RECORD;
  v_auth RECORD;
  v_settings RECORD;
  v_connect RECORD;
  v_sub RECORD;
  v_custom_price RECORD;
  v_bookings_count int := 0;
  v_customers_count int := 0;
  v_services_count int := 0;
  v_pros_count int := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Super Admin.';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, full_name, phone, phone_normalized, email, role, onboarding_completed
  INTO v_profile
  FROM public.profiles
  WHERE id = v_tenant.owner_user_id
     OR (tenant_id = p_tenant_id AND role IN ('owner', 'admin'))
  ORDER BY (id = v_tenant.owner_user_id) DESC
  LIMIT 1;

  SELECT email, email_confirmed_at, last_sign_in_at, created_at, raw_user_meta_data
  INTO v_auth
  FROM auth.users
  WHERE id = COALESCE(v_tenant.owner_user_id, v_profile.id);

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = p_tenant_id LIMIT 1;

  SELECT stripe_account_id, charges_enabled, payouts_enabled, mp_user_id, mp_email, mp_nickname
  INTO v_connect
  FROM public.stripe_connect_accounts
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  SELECT s.status, s.current_period_end, s.trial_ends_at, s.stripe_subscription_id, s.stripe_customer_id,
         p.name AS plan_name, sc.price_amount AS contract_price, sc.max_professionals AS contract_max_pros
  INTO v_sub
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.subscription_contracts sc ON sc.subscription_id = s.id
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT cp.amount_override, cp.note, p.name AS plan_name
  INTO v_custom_price
  FROM public.custom_pricing cp
  LEFT JOIN public.plans p ON p.id = cp.plan_id
  WHERE cp.tenant_id = p_tenant_id
  LIMIT 1;

  SELECT COUNT(*) INTO v_bookings_count FROM public.bookings WHERE tenant_id = p_tenant_id;
  SELECT COUNT(*) INTO v_customers_count FROM public.customers WHERE tenant_id = p_tenant_id;
  SELECT COUNT(*) INTO v_services_count FROM public.services WHERE tenant_id = p_tenant_id AND COALESCE(active, true) = true;
  SELECT COUNT(*) INTO v_pros_count FROM public.professionals WHERE tenant_id = p_tenant_id AND COALESCE(active, true) = true;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'business_type', v_tenant.business_type,
      'status', v_tenant.status,
      'account_state', v_tenant.account_state,
      'language', v_tenant.language,
      'created_at', v_tenant.created_at,
      'trial_ends_at', v_tenant.trial_ends_at,
      'deleted_at', v_tenant.deleted_at
    ),
    'owner', jsonb_build_object(
      'user_id', COALESCE(v_tenant.owner_user_id, v_profile.id),
      'full_name', COALESCE(v_profile.full_name, v_auth.raw_user_meta_data->>'full_name'),
      'auth_email', COALESCE(v_auth.email, v_profile.email),
      'phone', COALESCE(NULLIF(BTRIM(v_profile.phone), ''), NULLIF(BTRIM(v_auth.raw_user_meta_data->>'phone'), '')),
      'role', v_profile.role,
      'email_confirmed_at', v_auth.email_confirmed_at,
      'last_sign_in_at', v_auth.last_sign_in_at,
      'onboarding_completed', v_profile.onboarding_completed
    ),
    'settings', jsonb_build_object(
      'fantasy_name', v_settings.fantasy_name,
      'email', v_settings.email,
      'phone', v_settings.phone,
      'whatsapp_number', v_settings.whatsapp_number,
      'instagram', v_settings.instagram,
      'facebook', v_settings.facebook,
      'website', v_settings.website,
      'slogan', v_settings.slogan,
      'description', COALESCE(NULLIF(BTRIM(v_settings.description), ''), NULLIF(BTRIM(v_settings.short_description), '')),
      'address', v_settings.address,
      'street_number', v_settings.street_number,
      'complement', v_settings.complement,
      'neighborhood', v_settings.neighborhood,
      'city', v_settings.city,
      'state', v_settings.state,
      'zip_code', v_settings.zip_code,
      'country', v_settings.country,
      'full_address', v_settings.full_address,
      'map_link', v_settings.map_link,
      'booking_payment_mode', v_settings.booking_payment_mode,
      'deposit_percentage', v_settings.deposit_percentage,
      'payment_methods', v_settings.payment_methods
    ),
    'mercado_pago', jsonb_build_object(
      'charges_enabled', COALESCE(v_connect.charges_enabled, false),
      'payouts_enabled', COALESCE(v_connect.payouts_enabled, false),
      'stripe_account_id', v_connect.stripe_account_id,
      'mp_user_id', v_connect.mp_user_id,
      'mp_email', v_connect.mp_email,
      'mp_nickname', v_connect.mp_nickname
    ),
    'subscription', jsonb_build_object(
      'status', v_sub.status,
      'plan_name', v_sub.plan_name,
      'current_period_end', v_sub.current_period_end,
      'trial_ends_at', v_sub.trial_ends_at,
      'contract_price', v_sub.contract_price,
      'contract_max_pros', v_sub.contract_max_pros,
      'stripe_subscription_id', v_sub.stripe_subscription_id,
      'stripe_customer_id', v_sub.stripe_customer_id,
      'custom_price_amount', v_custom_price.amount_override,
      'custom_price_note', v_custom_price.note
    ),
    'stats', jsonb_build_object(
      'bookings_count', v_bookings_count,
      'customers_count', v_customers_count,
      'services_count', v_services_count,
      'pros_count', v_pros_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_tenant_info(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
