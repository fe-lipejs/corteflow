CREATE OR REPLACE FUNCTION public.get_public_stripe_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_live_pk text;
  v_test_pk text;
  v_pk text;
BEGIN
  SELECT stripe_mode, stripe_live_public_key, stripe_test_public_key
  INTO v_mode, v_live_pk, v_test_pk
  FROM public.platform_settings
  WHERE id = 'singleton'
  LIMIT 1;

  v_mode := COALESCE(v_mode, 'test');
  IF v_mode = 'live' THEN
    v_pk := NULLIF(BTRIM(v_live_pk), '');
  ELSE
    v_pk := NULLIF(BTRIM(v_test_pk), '');
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'publishable_key', v_pk
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stripe_config() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

