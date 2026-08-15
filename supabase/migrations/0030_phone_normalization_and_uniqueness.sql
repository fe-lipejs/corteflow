-- ====================================================================
-- MIGRAÇÃO 0030: Single Source of Truth para Normalização e Unicidade de Telefones
-- ====================================================================

-- 1. Função oficial de normalização e validação de telefone brasileiro no Postgres
CREATE OR REPLACE FUNCTION public.normalize_brazilian_phone(p_raw TEXT)
RETURNS TEXT AS $$
DECLARE
  v_trimmed TEXT;
  v_digits TEXT;
  v_ddd TEXT;
  v_valid_ddds TEXT[] := ARRAY[
    '11','12','13','14','15','16','17','18','19',
    '21','22','24',
    '27','28',
    '31','32','33','34','35','37','38',
    '41','42','43','44','45','46',
    '47','48','49',
    '51','53','54','55',
    '61','62','63','64','65','66','67','68','69',
    '71','73','74','75','77',
    '79',
    '81','82','83','84','85','86','87','88','89',
    '91','92','93','94','95','96','97','98','99'
  ];
BEGIN
  IF p_raw IS NULL OR trim(p_raw) = '' THEN
    RETURN NULL;
  END IF;

  v_trimmed := trim(p_raw);

  -- Rejeita prefixos inválidos com múltiplos zeros ('00', '000')
  IF v_trimmed ~ '^(\+?00+)' THEN
    RETURN NULL;
  END IF;

  -- Extrai apenas os dígitos
  v_digits := regexp_replace(v_trimmed, '\D', '', 'g');

  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  -- Remove DDI 55 se tiver 13 ou mais dígitos
  IF length(v_digits) >= 13 AND v_digits LIKE '55%' THEN
    v_digits := substr(v_digits, 3);
  END IF;

  -- Remove prefixo nacional '0' antes do DDD se tiver 12 dígitos
  IF length(v_digits) = 12 AND v_digits LIKE '0%' THEN
    v_digits := substr(v_digits, 2);
  END IF;

  -- Deve ter exatamente 11 dígitos (DDD + 9 dígitos de celular)
  IF length(v_digits) != 11 THEN
    RETURN NULL;
  END IF;

  -- Valida DDD oficial
  v_ddd := substr(v_digits, 1, 2);
  IF NOT (v_ddd = ANY(v_valid_ddds)) THEN
    RETURN NULL;
  END IF;

  -- Valida 9º dígito (primeiro dígito do celular deve ser 9)
  IF substr(v_digits, 3, 1) != '9' THEN
    RETURN NULL;
  END IF;

  RETURN v_digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.normalize_brazilian_phone(TEXT) TO anon, authenticated, service_role;

-- 2. Adiciona a coluna phone_normalized na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_normalized TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Migra dados existentes aplicando a normalização segura
UPDATE public.profiles
SET 
  phone_normalized = public.normalize_brazilian_phone(COALESCE(phone, '')),
  email = lower(trim(COALESCE(email, '')));

-- Sincroniza telefones de auth.users caso profiles ainda não tenha
DO $$
BEGIN
  UPDATE public.profiles p
  SET 
    email = lower(trim(COALESCE(u.email, ''))),
    phone = COALESCE(p.phone, u.raw_user_meta_data->>'phone'),
    phone_normalized = public.normalize_brazilian_phone(COALESCE(p.phone, u.raw_user_meta_data->>'phone', ''))
  FROM auth.users u
  WHERE p.id = u.id AND (p.phone_normalized IS NULL OR p.phone_normalized = '');
END $$;

-- 4. Índice único estrito sobre phone_normalized (Imutabilidade e proteção contra concorrência)
DROP INDEX IF EXISTS idx_profiles_phone_unique;
DROP INDEX IF EXISTS idx_profiles_phone_normalized_unique;

CREATE UNIQUE INDEX idx_profiles_phone_normalized_unique 
ON public.profiles(phone_normalized) 
WHERE phone_normalized IS NOT NULL AND phone_normalized != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON public.profiles(email) 
WHERE email IS NOT NULL AND email != '';

-- 5. Trigger para garantir que qualquer INSERT ou UPDATE em profiles preencha phone_normalized
CREATE OR REPLACE FUNCTION public.trg_enforce_profile_phone_normalization()
RETURNS trigger AS $$
BEGIN
  new.email := lower(trim(COALESCE(new.email, '')));
  new.phone_normalized := public.normalize_brazilian_phone(new.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_phone_normalize ON public.profiles;
CREATE TRIGGER trg_profiles_phone_normalize
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_profile_phone_normalization();

-- 6. Trigger handle_new_user atualizado com normalização
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_raw_phone TEXT;
  v_clean_phone TEXT;
  v_clean_email TEXT;
BEGIN
  v_raw_phone := COALESCE(new.raw_user_meta_data->>'phone', '');
  v_clean_phone := public.normalize_brazilian_phone(v_raw_phone);
  v_clean_email := lower(trim(COALESCE(new.email, '')));

  INSERT INTO public.profiles (
    id, 
    full_name, 
    role, 
    phone, 
    phone_normalized, 
    email, 
    onboarding_completed
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    'admin',
    v_raw_phone,
    v_clean_phone,
    v_clean_email,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    phone_normalized = COALESCE(EXCLUDED.phone_normalized, profiles.phone_normalized),
    email = COALESCE(EXCLUDED.email, profiles.email);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC definitiva para verificar disponibilidade de e-mail e telefone no cadastro
CREATE OR REPLACE FUNCTION public.check_registration_availability(p_email TEXT, p_phone TEXT)
RETURNS jsonb AS $$
DECLARE
  v_clean_email TEXT;
  v_normalized_phone TEXT;
  v_email_exists BOOLEAN := false;
  v_phone_exists BOOLEAN := false;
  v_phone_invalid BOOLEAN := false;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));

  -- Validação e normalização do telefone
  IF p_phone IS NOT NULL AND trim(p_phone) != '' THEN
    v_normalized_phone := public.normalize_brazilian_phone(p_phone);
    IF v_normalized_phone IS NULL THEN
      v_phone_invalid := true;
    END IF;
  END IF;

  -- 1. Checa e-mail em auth.users e profiles
  IF v_clean_email != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email
      UNION
      SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email
    ) INTO v_email_exists;
  END IF;

  -- 2. Checa telefone normalizado em todas as contas do sistema
  IF v_normalized_phone IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE phone_normalized = v_normalized_phone
      UNION
      SELECT 1 FROM auth.users WHERE public.normalize_brazilian_phone(raw_user_meta_data->>'phone') = v_normalized_phone
      UNION
      SELECT 1 FROM public.tenant_settings WHERE public.normalize_brazilian_phone(phone) = v_normalized_phone OR public.normalize_brazilian_phone(whatsapp_number) = v_normalized_phone
      UNION
      SELECT 1 FROM public.professionals WHERE public.normalize_brazilian_phone(working_hours->>'phone') = v_normalized_phone
    ) INTO v_phone_exists;
  END IF;

  RETURN jsonb_build_object(
    'email_exists', v_email_exists,
    'phone_exists', v_phone_exists,
    'phone_invalid', v_phone_invalid,
    'normalized_phone', v_normalized_phone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_registration_availability(TEXT, TEXT) TO anon, authenticated, service_role;

-- 8. RPC para verificar disponibilidade de telefone ao alterar no Admin / Onboarding
CREATE OR REPLACE FUNCTION public.check_phone_availability(p_phone TEXT, p_exclude_user_id UUID DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_normalized_phone TEXT;
  v_phone_exists BOOLEAN := false;
  v_phone_invalid BOOLEAN := false;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object(
      'available', true,
      'normalized_phone', NULL,
      'error', NULL
    );
  END IF;

  v_normalized_phone := public.normalize_brazilian_phone(p_phone);

  IF v_normalized_phone IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'phone_invalid', true,
      'normalized_phone', NULL,
      'error', 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.'
    );
  END IF;

  -- Verifica se existe em profiles de outro usuário
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE phone_normalized = v_normalized_phone 
      AND (p_exclude_user_id IS NULL OR id != p_exclude_user_id)
    UNION
    SELECT 1 FROM auth.users 
    WHERE public.normalize_brazilian_phone(raw_user_meta_data->>'phone') = v_normalized_phone 
      AND (p_exclude_user_id IS NULL OR id != p_exclude_user_id)
  ) INTO v_phone_exists;

  IF v_phone_exists THEN
    RETURN jsonb_build_object(
      'available', false,
      'phone_invalid', false,
      'normalized_phone', v_normalized_phone,
      'error', 'Este número de telefone já está cadastrado em outra conta.'
    );
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'phone_invalid', false,
    'normalized_phone', v_normalized_phone,
    'error', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_phone_availability(TEXT, UUID) TO anon, authenticated, service_role;

-- 9. RPC para recuperação de senha por telefone ou e-mail com normalização
CREATE OR REPLACE FUNCTION public.get_email_by_phone_or_email(p_identifier TEXT)
RETURNS TEXT AS $$
DECLARE
  v_input TEXT;
  v_normalized_phone TEXT;
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

  -- Caso 2: Usuário digitou um telefone
  v_normalized_phone := public.normalize_brazilian_phone(v_input);

  IF v_normalized_phone IS NOT NULL THEN
    -- Busca por profiles com phone_normalized
    SELECT COALESCE(u.email, p.email) INTO v_found_email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.phone_normalized = v_normalized_phone
    LIMIT 1;

    -- Busca por metadata do auth.users
    IF v_found_email IS NULL THEN
      SELECT email INTO v_found_email
      FROM auth.users
      WHERE public.normalize_brazilian_phone(raw_user_meta_data->>'phone') = v_normalized_phone
      LIMIT 1;
    END IF;

    -- Busca por tenant_settings
    IF v_found_email IS NULL THEN
      SELECT u.email INTO v_found_email
      FROM public.tenant_settings ts
      JOIN public.tenants t ON t.id = ts.tenant_id
      JOIN auth.users u ON u.id = t.owner_user_id
      WHERE public.normalize_brazilian_phone(ts.phone) = v_normalized_phone
         OR public.normalize_brazilian_phone(ts.whatsapp_number) = v_normalized_phone
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_found_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_email_by_phone_or_email(TEXT) TO anon, authenticated, service_role;
