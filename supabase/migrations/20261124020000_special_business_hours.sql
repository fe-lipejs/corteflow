-- ============================================================================
-- Migration: Horários Especiais por Período (Raffros)
-- Complementa business_hours com períodos sazonais/exceções por intervalo de datas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.special_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  same_hours_for_all BOOLEAN NOT NULL DEFAULT true,
  days_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT special_business_hours_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_special_business_hours_tenant_dates
  ON public.special_business_hours (tenant_id, start_date, end_date);

ALTER TABLE public.special_business_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read special_business_hours" ON public.special_business_hours;
CREATE POLICY "Public can read special_business_hours"
  ON public.special_business_hours
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Tenant isolation for special_business_hours" ON public.special_business_hours;
CREATE POLICY "Tenant isolation for special_business_hours"
  ON public.special_business_hours
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = special_business_hours.tenant_id AND t.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = special_business_hours.tenant_id AND t.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

GRANT SELECT ON public.special_business_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.special_business_hours TO authenticated;
