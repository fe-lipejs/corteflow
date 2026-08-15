-- 0029_registration_and_recovery_enhancements.sql
-- Adiciona suporte a identificação segura por e-mail ou telefone, prevenção de duplicidades no banco e recuperação aprimorada

-- 1. Colunas de e-mail e telefone na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sincroniza dados existentes de auth.users para profiles
DO $$
BEGIN
  UPDATE public.profiles p
  SET 
    email = lower(COALESCE(u.email, '')),
    phone = NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '')
  FROM auth.users u
  WHERE p.id = u.id;
END $$;

-- 3. Índices únicos para garantir integridade a nível de banco
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON public.profiles(phone) 
WHERE phone IS NOT NULL AND phone != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON public.profiles(email) 
WHERE email IS NOT NULL AND email != '';

-- 4. Atualiza trigger handle_new_user com normalização de e-mail e telefone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_clean_phone TEXT;
  v_clean_email TEXT;
BEGIN
  v_clean_phone := NULLIF(regexp_replace(COALESCE(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '');
  v_clean_email := NULLIF(lower(trim(COALESCE(new.email, ''))), '');

  INSERT INTO public.profiles (id, full_name, role, phone, email, onboarding_completed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    'admin',
    v_clean_phone,
    v_clean_email,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC para verificar disponibilidade de e-mail e telefone antes do cadastro
CREATE OR REPLACE FUNCTION public.check_registration_availability(p_email TEXT, p_phone TEXT)
RETURNS jsonb AS $$
DECLARE
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_email_exists BOOLEAN := false;
  v_phone_exists BOOLEAN := false;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  -- Checa e-mail em auth.users e profiles
  IF v_clean_email != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email
      UNION
      SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email
    ) INTO v_email_exists;
  END IF;

  -- Checa telefone em profiles, auth.users meta e tenant_settings
  IF v_clean_phone != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE phone = v_clean_phone
      UNION
      SELECT 1 FROM auth.users WHERE regexp_replace(COALESCE(raw_user_meta_data->>'phone', ''), '\D', '', 'g') = v_clean_phone
      UNION
      SELECT 1 FROM public.tenant_settings WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_clean_phone OR regexp_replace(COALESCE(whatsapp_number, ''), '\D', '', 'g') = v_clean_phone
    ) INTO v_phone_exists;
  END IF;

  RETURN jsonb_build_object(
    'email_exists', v_email_exists,
    'phone_exists', v_phone_exists
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_registration_availability(TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. RPC para localizar e-mail associado a um telefone ou e-mail na recuperação de senha
CREATE OR REPLACE FUNCTION public.get_email_by_phone_or_email(p_identifier TEXT)
RETURNS TEXT AS $$
DECLARE
  v_input TEXT;
  v_clean_phone TEXT;
  v_found_email TEXT := NULL;
BEGIN
  v_input := trim(COALESCE(p_identifier, ''));

  IF v_input = '' THEN
    RETURN NULL;
  END IF;

  -- Caso 1: Usuário digitou um e-mail
  IF v_input LIKE '%@%' THEN
    SELECT email INTO v_found_email
    FROM auth.users
    WHERE lower(email) = lower(v_input)
    LIMIT 1;

    IF v_found_email IS NULL THEN
      SELECT email INTO v_found_email
      FROM public.profiles
      WHERE lower(email) = lower(v_input)
      LIMIT 1;
    END IF;

    RETURN v_found_email;
  END IF;

  -- Caso 2: Usuário digitou um número de telefone
  v_clean_phone := regexp_replace(v_input, '\D', '', 'g');

  IF length(v_clean_phone) >= 8 THEN
    -- Busca por profiles
    SELECT COALESCE(u.email, p.email) INTO v_found_email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.phone = v_clean_phone
    LIMIT 1;

    -- Busca por metadata do auth.users se não encontrou em profiles
    IF v_found_email IS NULL THEN
      SELECT email INTO v_found_email
      FROM auth.users
      WHERE regexp_replace(COALESCE(raw_user_meta_data->>'phone', ''), '\D', '', 'g') = v_clean_phone
      LIMIT 1;
    END IF;

    -- Busca por tenant_settings
    IF v_found_email IS NULL THEN
      SELECT u.email INTO v_found_email
      FROM public.tenant_settings ts
      JOIN public.tenants t ON t.id = ts.tenant_id
      JOIN auth.users u ON u.id = t.owner_user_id
      WHERE regexp_replace(COALESCE(ts.phone, ''), '\D', '', 'g') = v_clean_phone
         OR regexp_replace(COALESCE(ts.whatsapp_number, ''), '\D', '', 'g') = v_clean_phone
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_found_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_email_by_phone_or_email(TEXT) TO anon, authenticated, service_role;
