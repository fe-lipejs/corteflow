-- ============================================================
-- Migration 0073: Add home fee type and per km to professionals
-- ============================================================

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS home_fee_type TEXT DEFAULT 'fixed' CHECK (home_fee_type IN ('fixed', 'per_km')),
  ADD COLUMN IF NOT EXISTS home_fee_per_km NUMERIC DEFAULT 0;

COMMENT ON COLUMN professionals.home_fee_type IS
  'fixed = taxa fixa (usa home_fee), per_km = taxa por km (usa home_fee_per_km)';
COMMENT ON COLUMN professionals.home_fee_per_km IS
  'Valor cobrado por quilmetro (caso home_fee_type seja per_km)';

-- Remove from database types if we want to be clean, but not strictly necessary here since types are generated.
