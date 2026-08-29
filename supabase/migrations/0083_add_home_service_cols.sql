ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS home_fee_type text DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS home_fee_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS home_fee_per_km numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS home_service_radius_km numeric(10,2) DEFAULT 10;
