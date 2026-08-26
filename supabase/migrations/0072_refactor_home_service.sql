-- ============================================================
-- Migration 0072: Refactor Home Service to Professional Level
-- Remove global home service settings from tenant_settings
-- (The professional-level settings were already added in 0046)
-- ============================================================

ALTER TABLE tenant_settings
  DROP COLUMN IF EXISTS offers_home_service,
  DROP COLUMN IF EXISTS home_service_radius_km,
  DROP COLUMN IF EXISTS home_fee_type,
  DROP COLUMN IF EXISTS home_fee_amount,
  DROP COLUMN IF EXISTS home_fee_per_km;

-- Ensure professionals table has the correct columns (safety check)
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS offers_home_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_home_distance_km NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_fee NUMERIC DEFAULT 0;
