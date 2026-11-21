-- =============================================================================
-- Migration: Mercado Pago Integration (Assinaturas SaaS + Repasse aos Salões)
-- Adiciona colunas mp_* em platform_settings e stripe_connect_accounts,
-- mantendo compatibilidade com as colunas legadas existentes, e atualiza a RPC
-- pública get_public_stripe_config().
-- =============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS mp_mode text DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS mp_test_public_key text,
  ADD COLUMN IF NOT EXISTS mp_test_access_token text,
  ADD COLUMN IF NOT EXISTS mp_live_public_key text,
  ADD COLUMN IF NOT EXISTS mp_live_access_token text,
  ADD COLUMN IF NOT EXISTS mp_client_id text,
  ADD COLUMN IF NOT EXISTS mp_client_secret text,
  ADD COLUMN IF NOT EXISTS mp_webhook_secret text,
  ADD COLUMN IF NOT EXISTS mp_application_fee_percent numeric DEFAULT 0;

ALTER TABLE public.stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS mp_user_id text,
  ADD COLUMN IF NOT EXISTS mp_access_token text,
  ADD COLUMN IF NOT EXISTS mp_refresh_token text,
  ADD COLUMN IF NOT EXISTS mp_public_key text,
  ADD COLUMN IF NOT EXISTS mp_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_email text,
  ADD COLUMN IF NOT EXISTS mp_nickname text;

-- Garante que a tabela payments aceite IDs numéricos/texto do Mercado Pago (payment_id / preference_id)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_collector_id text;

CREATE INDEX IF NOT EXISTS idx_payments_mp_payment_id ON public.payments(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_mp_user_id ON public.stripe_connect_accounts(mp_user_id);

-- Atualiza RPC pública para retornar a Public Key do Mercado Pago ativa e flag de OAuth
CREATE OR REPLACE FUNCTION public.get_public_stripe_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_mp_live_pk text;
  v_mp_test_pk text;
  v_legacy_live_pk text;
  v_legacy_test_pk text;
  v_client_id text;
  v_pk text;
BEGIN
  SELECT
    COALESCE(NULLIF(BTRIM(mp_mode), ''), NULLIF(BTRIM(stripe_mode), ''), 'live'),
    mp_live_public_key,
    mp_test_public_key,
    stripe_live_public_key,
    stripe_test_public_key,
    mp_client_id
  INTO
    v_mode,
    v_mp_live_pk,
    v_mp_test_pk,
    v_legacy_live_pk,
    v_legacy_test_pk,
    v_client_id
  FROM public.platform_settings
  WHERE id = 'singleton'
  LIMIT 1;

  v_mode := COALESCE(v_mode, 'live');

  IF v_mode = 'live' THEN
    v_pk := COALESCE(NULLIF(BTRIM(v_mp_live_pk), ''), NULLIF(BTRIM(v_legacy_live_pk), ''));
  ELSE
    v_pk := COALESCE(NULLIF(BTRIM(v_mp_test_pk), ''), NULLIF(BTRIM(v_legacy_test_pk), ''));
  END IF;

  RETURN jsonb_build_object(
    'provider', 'mercado_pago',
    'mode', v_mode,
    'public_key', v_pk,
    'has_oauth', (v_client_id IS NOT NULL AND BTRIM(v_client_id) <> '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stripe_config() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
