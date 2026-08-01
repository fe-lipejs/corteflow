-- ============================================================
-- Migration: Equipe Module — Professionals Extended Schema
-- Run this in your Supabase SQL Editor (or apply via CLI)
-- ============================================================

-- 1. Extend professionals table with new columns
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agenda_color TEXT DEFAULT '#C9963B',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacation', 'leave', 'inactive')),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migrate old "active" boolean to new status column
UPDATE professionals SET status = CASE WHEN active = true THEN 'active' ELSE 'inactive' END WHERE status IS NULL;

-- Drop old column that is replaced by status
ALTER TABLE professionals DROP COLUMN IF EXISTS active;

-- Indexes for tenant lookups
CREATE INDEX IF NOT EXISTS idx_professionals_tenant_id ON professionals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_professionals_status ON professionals(status);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS professionals_updated_at ON professionals;
CREATE TRIGGER professionals_updated_at
  BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS on professionals
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can manage their professionals" ON professionals;
CREATE POLICY "Owners can manage their professionals" ON professionals
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Public read for booking page
DROP POLICY IF EXISTS "Public can read active professionals" ON professionals;
CREATE POLICY "Public can read active professionals" ON professionals
  FOR SELECT USING (status = 'active');

-- ============================================================
-- 2. Professional Working Hours (per-professional schedule)
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_working_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun, 1=Mon ... 6=Sat
  is_working BOOLEAN NOT NULL DEFAULT false,
  open_time TIME,
  close_time TIME,
  lunch_start TIME,
  lunch_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_pro_hours_professional ON professional_working_hours(professional_id);
CREATE INDEX IF NOT EXISTS idx_pro_hours_tenant ON professional_working_hours(tenant_id);

ALTER TABLE professional_working_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage professional hours" ON professional_working_hours;
CREATE POLICY "Owners can manage professional hours" ON professional_working_hours
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can read professional hours" ON professional_working_hours;
CREATE POLICY "Public can read professional hours" ON professional_working_hours
  FOR SELECT USING (true);

-- ============================================================
-- 3. Professional Services (N:N relationship)
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_services_professional ON professional_services(professional_id);
CREATE INDEX IF NOT EXISTS idx_pro_services_tenant ON professional_services(tenant_id);

ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage professional services" ON professional_services;
CREATE POLICY "Owners can manage professional services" ON professional_services
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can read professional services" ON professional_services;
CREATE POLICY "Public can read professional services" ON professional_services
  FOR SELECT USING (true);

-- ============================================================
-- 4. Professional Blocked Times
-- ============================================================
CREATE TABLE IF NOT EXISTS professional_blocked_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reason TEXT,
  block_type TEXT DEFAULT 'custom' CHECK (block_type IN ('vacation', 'day_off', 'leave', 'custom')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_blocked_professional ON professional_blocked_times(professional_id);
CREATE INDEX IF NOT EXISTS idx_pro_blocked_tenant ON professional_blocked_times(tenant_id);

ALTER TABLE professional_blocked_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage professional blocks" ON professional_blocked_times;
CREATE POLICY "Owners can manage professional blocks" ON professional_blocked_times
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- ============================================================
-- 5. Storage bucket for professional photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-photos', 'professional-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owners can upload professional photos" ON storage.objects;
CREATE POLICY "Owners can upload professional photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'professional-photos'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Anyone can view professional photos" ON storage.objects;
CREATE POLICY "Anyone can view professional photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'professional-photos');

DROP POLICY IF EXISTS "Owners can update professional photos" ON storage.objects;
CREATE POLICY "Owners can update professional photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'professional-photos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can delete professional photos" ON storage.objects;
CREATE POLICY "Owners can delete professional photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'professional-photos'
  AND auth.uid() IS NOT NULL
);
