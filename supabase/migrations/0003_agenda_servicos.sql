-- ============================================================
-- Migration 0003: Agenda + Serviços + Produtos
-- ============================================================

-- ─── 1. EXTEND services table ───────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Outros',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS promo_price NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their services" ON services;
CREATE POLICY "Owners manage their services" ON services
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Public can read active services" ON services;
CREATE POLICY "Public can read active services" ON services
  FOR SELECT USING (active = true);

-- Auto-update trigger (reuses function from migration 0002)
DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 2. PRODUCTS table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Outros',
  price NUMERIC NOT NULL DEFAULT 0,
  promo_price NUMERIC,
  code TEXT,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 0,
  brand TEXT,
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their products" ON products;
CREATE POLICY "Owners manage their products" ON products
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 3. EXTEND bookings table ────────────────────────────────
-- Rename status constraint to add new states
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending','confirmed','arrived','in_progress','completed','canceled','no_show'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pro_color TEXT DEFAULT '#C9963B',
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_professional ON bookings(professional_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON bookings(tenant_id, scheduled_at);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their bookings" ON bookings;
CREATE POLICY "Owners manage their bookings" ON bookings
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 4. BOOKING HISTORY ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking ON booking_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_history_tenant ON booking_history(tenant_id);

ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage booking history" ON booking_history;
CREATE POLICY "Owners manage booking history" ON booking_history
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- ─── 5. BOOKING NOTES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_notes_booking ON booking_notes(booking_id);

ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage booking notes" ON booking_notes;
CREATE POLICY "Owners manage booking notes" ON booking_notes
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- ─── 6. Storage buckets ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owners upload service photos" ON storage.objects;
CREATE POLICY "Owners upload service photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'service-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Public view service photos" ON storage.objects;
CREATE POLICY "Public view service photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'service-photos');
DROP POLICY IF EXISTS "Owners delete service photos" ON storage.objects;
CREATE POLICY "Owners delete service photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'service-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Owners update service photos" ON storage.objects;
CREATE POLICY "Owners update service photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'service-photos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners upload product photos" ON storage.objects;
CREATE POLICY "Owners upload product photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-photos' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Public view product photos" ON storage.objects;
CREATE POLICY "Public view product photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-photos');
DROP POLICY IF EXISTS "Owners delete product photos" ON storage.objects;
CREATE POLICY "Owners delete product photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-photos' AND auth.uid() IS NOT NULL);
