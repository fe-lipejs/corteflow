-- =============================================================================
-- Migration: 20261122034500_security_and_financial_hardening.sql
-- Auditoria e Blindagem Financeira & Multi-Tenant (Mercado Pago + Agendamentos)
-- =============================================================================

BEGIN;

-- 1. BLINDAGEM DE CREDENCIAIS OAUTH DO MERCADO PAGO (stripe_connect_accounts)
-- Em PostgreSQL, é necessário primeiro revogar o SELECT em nível de tabela e conceder SELECT
-- exclusivamente nas colunas públicas/seguras (sem mp_access_token e sem mp_refresh_token).
REVOKE SELECT ON TABLE public.stripe_connect_accounts FROM anon, authenticated;

GRANT SELECT (
  id,
  tenant_id,
  stripe_account_id,
  charges_enabled,
  payouts_enabled
) ON public.stripe_connect_accounts TO anon;

GRANT SELECT (
  id,
  tenant_id,
  stripe_account_id,
  charges_enabled,
  payouts_enabled,
  mp_user_id,
  mp_public_key,
  mp_token_expires_at,
  mp_email,
  mp_nickname
) ON public.stripe_connect_accounts TO authenticated;

-- Restringe a política pública de stripe_connect_accounts apenas a contas ativas
DROP POLICY IF EXISTS "Public can read stripe connect status" ON public.stripe_connect_accounts;
CREATE POLICY "Public can read stripe connect status" ON public.stripe_connect_accounts
  FOR SELECT
  TO anon, authenticated
  USING (
    charges_enabled = true
    OR tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR public.is_super_admin()
  );

-- 2. PROTEÇÃO DE DADOS BANCÁRIOS DE PROFISSIONAIS CONTRA LEITURA ANÔNIMA
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'professionals' AND column_name = 'bank_info'
  ) THEN
    EXECUTE 'REVOKE SELECT (bank_info) ON public.professionals FROM anon';
  END IF;
END $$;

-- 3. FECHAMENTO DE VAZAMENTOS PÚBLICOS EM TABELAS FINANCEIRAS E DE AGENDAMENTO
-- Visitantes anônimos não podem listar ou inserir diretamente em bookings, payments, refunds, etc.
-- Toda criação pública passa pela Edge Function create-public-booking (service_role)
-- e toda leitura pública usa RPCs SECURITY DEFINER restritas.
DROP POLICY IF EXISTS "Public can view booking by access code" ON public.bookings;
DROP POLICY IF EXISTS "Public can read bookings for slot availability" ON public.bookings;
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;

DROP POLICY IF EXISTS "Public can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public select customer by exact phone" ON public.customers;

DROP POLICY IF EXISTS "Public read for own payments" ON public.payments;
DROP POLICY IF EXISTS "Public read for own payment_history" ON public.payment_history;
DROP POLICY IF EXISTS "Public read for own refunds" ON public.refunds;
DROP POLICY IF EXISTS "Public read for own credits" ON public.customer_credits;

-- 4. REFORÇO DA TRIGGER secure_booking_price (Defesa em profundidade)
CREATE OR REPLACE FUNCTION public.secure_booking_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_service_price NUMERIC;
BEGIN
    IF auth.role() = 'anon' THEN
        SELECT price INTO v_service_price FROM public.services WHERE id = NEW.service_id;
        NEW.amount_total := COALESCE(v_service_price, 0) + COALESCE(NEW.travel_fee, 0);

        IF TG_OP = 'INSERT' THEN
            NEW.amount_paid := 0;
            NEW.status := 'pending';
            NEW.payment_status := 'pending';
        END IF;

        NEW.amount_due := NEW.amount_total - NEW.amount_paid;
    END IF;

    RETURN NEW;
END;
$$;

-- 5. RPC SEGURA PARA CONFIRMAÇÃO DE AGENDAMENTO PÚBLICO (SuccessBooking e ClientPortal)
-- Exige obrigatoriamente o p_tenant_id E pelo menos um identificador exato (order_number, booking_id ou payment_id).
CREATE OR REPLACE FUNCTION public.get_public_booking_confirmation(
  p_tenant_id uuid,
  p_order_number text DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL,
  p_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF (p_order_number IS NULL OR BTRIM(p_order_number) = '')
     AND p_booking_id IS NULL
     AND (p_payment_id IS NULL OR BTRIM(p_payment_id) = '') THEN
    RETURN NULL;
  END IF;

  -- 1. Busca por order_number dentro do tenant
  IF p_order_number IS NOT NULL AND BTRIM(p_order_number) <> '' THEN
    SELECT b.id INTO v_booking_id
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND UPPER(b.order_number) = UPPER(BTRIM(p_order_number))
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;

  -- 2. Fallback por booking_id dentro do tenant
  IF v_booking_id IS NULL AND p_booking_id IS NOT NULL THEN
    SELECT b.id INTO v_booking_id
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.id = p_booking_id
    LIMIT 1;
  END IF;

  -- 3. Fallback por payment_id dentro do tenant
  IF v_booking_id IS NULL AND p_payment_id IS NOT NULL AND BTRIM(p_payment_id) <> '' THEN
    SELECT p.booking_id INTO v_booking_id
    FROM public.payments p
    WHERE p.tenant_id = p_tenant_id
      AND (
        p.mp_payment_id = BTRIM(p_payment_id)
        OR p.stripe_payment_intent_id = BTRIM(p_payment_id)
        OR p.mp_preference_id = BTRIM(p_payment_id)
      )
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF v_booking_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', b.id,
    'tenant_id', b.tenant_id,
    'customer_id', b.customer_id,
    'professional_id', b.professional_id,
    'service_id', b.service_id,
    'order_number', b.order_number,
    'scheduled_at', b.scheduled_at,
    'status', b.status,
    'payment_mode', b.payment_mode,
    'payment_status', b.payment_status,
    'payment_method', b.payment_method,
    'amount_paid', b.amount_paid,
    'amount_total', b.amount_total,
    'amount_due', b.amount_due,
    'access_code', b.access_code,
    'services', (
      SELECT jsonb_build_object('name', s.name, 'price', s.price)
      FROM public.services s
      WHERE s.id = b.service_id
    ),
    'professionals', (
      SELECT jsonb_build_object('name', pr.name)
      FROM public.professionals pr
      WHERE pr.id = b.professional_id
    ),
    'customers', (
      SELECT jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email)
      FROM public.customers c
      WHERE c.id = b.customer_id
    )
  )
  INTO v_result
  FROM public.bookings b
  WHERE b.id = v_booking_id
    AND b.tenant_id = p_tenant_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking_confirmation(uuid, text, uuid, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
