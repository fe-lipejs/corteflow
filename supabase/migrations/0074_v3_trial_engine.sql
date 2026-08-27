-- Migration 0074: V3 Trial Engine & State Machine

-- 1. Create billing_events table for idempotency
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL
);

-- 2. Add state machine columns to tenants (representing the 'accounts' table from the prompt)
-- We don't use CHECK constraints directly on the enum if we want flexibility, but let's add it for strictness
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS account_state TEXT DEFAULT 'onboarding_no_card',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

-- Migrate existing tenants to active to avoid breaking current users
UPDATE public.tenants SET account_state = 'active' WHERE account_state = 'onboarding_no_card';

-- Add check constraint safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_account_state') THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT check_account_state 
      CHECK (account_state IN ('onboarding_no_card', 'trialing_with_card', 'active', 'past_due', 'locked', 'canceled'));
  END IF;
END $$;

-- 3. Create the is_account_writable function
CREATE OR REPLACE FUNCTION public.is_account_writable(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_state TEXT;
BEGIN
  -- Super admin bypass
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT account_state INTO v_state FROM public.tenants WHERE id = p_tenant_id;
  
  -- Hard paywall states
  IF v_state IN ('onboarding_no_card', 'locked', 'canceled') THEN
    RETURN FALSE;
  END IF;
  
  -- True if trialing_with_card, active, past_due (grace period)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply is_account_writable to key tables (Services, Professionals, Bookings, Financials)
-- The prompt requires: "Aplique nas policies de INSERT/UPDATE/DELETE destas tabelas"
-- We will override the existing policies to inject this validation.

-- 4.1. services
DROP POLICY IF EXISTS "Tenant isolation for services" ON public.services;
DROP POLICY IF EXISTS "Tenant isolation for services (READ)" ON public.services;
DROP POLICY IF EXISTS "Tenant isolation for services (WRITE)" ON public.services;

CREATE POLICY "Tenant isolation for services (READ)" ON public.services
    FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

CREATE POLICY "Tenant isolation for services (WRITE)" ON public.services
    FOR ALL
    USING (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    )
    WITH CHECK (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    );

-- 4.2. professionals
DROP POLICY IF EXISTS "Tenant isolation for professionals" ON public.professionals;
DROP POLICY IF EXISTS "Tenant isolation for professionals (READ)" ON public.professionals;
DROP POLICY IF EXISTS "Tenant isolation for professionals (WRITE)" ON public.professionals;

CREATE POLICY "Tenant isolation for professionals (READ)" ON public.professionals
    FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

CREATE POLICY "Tenant isolation for professionals (WRITE)" ON public.professionals
    FOR ALL
    USING (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    )
    WITH CHECK (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    );

-- 4.3. bookings
DROP POLICY IF EXISTS "Tenant isolation for bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tenant isolation for bookings (READ)" ON public.bookings;
DROP POLICY IF EXISTS "Tenant isolation for bookings (WRITE)" ON public.bookings;

CREATE POLICY "Tenant isolation for bookings (READ)" ON public.bookings
    FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

CREATE POLICY "Tenant isolation for bookings (WRITE)" ON public.bookings
    FOR ALL
    USING (
        (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin())
        AND is_account_writable(tenant_id)
    )
    WITH CHECK (
        (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin())
        AND is_account_writable(tenant_id)
    );

-- 4.4. financial_transactions
DROP POLICY IF EXISTS "Tenant isolation for financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Tenant isolation for financial_transactions (READ)" ON public.financial_transactions;
DROP POLICY IF EXISTS "Tenant isolation for financial_transactions (WRITE)" ON public.financial_transactions;

CREATE POLICY "Tenant isolation for financial_transactions (READ)" ON public.financial_transactions
    FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

CREATE POLICY "Tenant isolation for financial_transactions (WRITE)" ON public.financial_transactions
    FOR ALL
    USING (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    )
    WITH CHECK (
        (
            (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
            OR is_super_admin()
        )
        AND is_account_writable(tenant_id)
    );

-- NOTE: customers and tenant_settings DO NOT have is_account_writable injected.
-- This ensures they can still INSERT/UPDATE customers (personalize CRM) and customize portal even if onboarding_no_card.
