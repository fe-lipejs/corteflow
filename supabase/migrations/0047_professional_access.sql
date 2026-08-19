-- ============================================================
-- Migration 0047: Professional Access & Permissions
-- ============================================================

-- 1. Modify professionals table
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
    "view_own_schedule": true,
    "edit_own_schedule": false,
    "view_financial": false,
    "create_financial_entry": false,
    "view_commission": true,
    "view_clients": false,
    "edit_own_availability": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_info JSONB;

-- 2. Modify bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;

-- 3. Modify financial_transactions table
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_professionals_auth_user_id ON professionals(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_professional_id ON financial_transactions(professional_id);

-- ============================================================
-- RLS POLICIES UPDATE
-- ============================================================

-- A. Professionals Policy
-- Owners can see all professionals in their tenant.
-- Professionals can only see their own record.

DROP POLICY IF EXISTS "Owners read all tenant professionals" ON professionals;
CREATE POLICY "Owners read all tenant professionals" ON professionals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'owner' 
      AND tenant_id = professionals.tenant_id
    )
  );

DROP POLICY IF EXISTS "Professionals read own record" ON professionals;
CREATE POLICY "Professionals read own record" ON professionals
  FOR SELECT
  USING (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Super admins read all professionals" ON professionals;
CREATE POLICY "Super admins read all professionals" ON professionals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- B. Bookings Policy
-- Owners can see all bookings.
-- Professionals can only see their own bookings.

DROP POLICY IF EXISTS "Owners read all tenant bookings" ON bookings;
CREATE POLICY "Owners read all tenant bookings" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'owner' 
      AND tenant_id = bookings.tenant_id
    )
  );

DROP POLICY IF EXISTS "Professionals read own bookings" ON bookings;
CREATE POLICY "Professionals read own bookings" ON bookings
  FOR SELECT
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admins read all bookings" ON bookings;
CREATE POLICY "Super admins read all bookings" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Professional can update own bookings
DROP POLICY IF EXISTS "Professionals update own bookings" ON bookings;
CREATE POLICY "Professionals update own bookings" ON bookings
  FOR UPDATE
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE auth_user_id = auth.uid()
    )
  );

-- C. Financial Transactions Policy

DROP POLICY IF EXISTS "Owners read all tenant financials" ON financial_transactions;
CREATE POLICY "Owners read all tenant financials" ON financial_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'owner' 
      AND tenant_id = financial_transactions.tenant_id
    )
  );

DROP POLICY IF EXISTS "Professionals read own financials" ON financial_transactions;
CREATE POLICY "Professionals read own financials" ON financial_transactions
  FOR SELECT
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admins read all financials" ON financial_transactions;
CREATE POLICY "Super admins read all financials" ON financial_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Professional can insert own financials if permission allows
DROP POLICY IF EXISTS "Professionals insert own financials" ON financial_transactions;
CREATE POLICY "Professionals insert own financials" ON financial_transactions
  FOR INSERT
  WITH CHECK (
    professional_id IN (
      SELECT id FROM professionals 
      WHERE auth_user_id = auth.uid()
      AND (permissions->>'create_financial_entry')::boolean = true
    )
  );
