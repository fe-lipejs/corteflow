-- ============================================================
-- Migration 0068: Multi-tenant Architecture & Context Switching
-- ============================================================

-- 1. Modify Profiles (Global Context & Super Admin)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Migrate super_admin role to the flag
UPDATE profiles SET is_super_admin = true WHERE role = 'super_admin';

-- Make tenant_id and role nullable (they will now act as the "Active Context")
ALTER TABLE profiles ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;

-- 2. Create tenant_users table (Memberships)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'manager', 'professional')) NOT NULL,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Turn on RLS for tenant_users
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Policy: User can read their own memberships
CREATE POLICY "Users can read own memberships" ON tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- Super admin can read all memberships
CREATE POLICY "Super admin can read memberships" ON tenant_users
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

-- Owners can read memberships of their active tenant context
CREATE POLICY "Owners can manage tenant_users" ON tenant_users
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );


-- 3. Data Migration from profiles -> tenant_users
INSERT INTO tenant_users (tenant_id, user_id, role, permissions)
SELECT tenant_id, id, 
  CASE 
    WHEN role = 'super_admin' THEN 'owner' -- Super admins don't really need a tenant role, but fallback to owner if they had a tenant
    ELSE role 
  END as role, 
  CASE 
    WHEN role = 'owner' THEN '{"all": true}'::jsonb 
    ELSE '{"view_own_schedule": true}'::jsonb 
  END as permissions
FROM profiles
WHERE tenant_id IS NOT NULL 
AND role IN ('owner', 'professional', 'super_admin')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 4. Create the Context Switching RPC (Stored Procedure)
CREATE OR REPLACE FUNCTION switch_tenant(p_tenant_id UUID) 
RETURNS void AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Super Admins can switch anywhere
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    UPDATE profiles SET tenant_id = p_tenant_id, role = 'super_admin' WHERE id = auth.uid();
    RETURN;
  END IF;

  -- Verify if user has an active membership for the requested tenant
  SELECT role INTO v_role 
  FROM tenant_users 
  WHERE user_id = auth.uid() 
  AND tenant_id = p_tenant_id 
  AND status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized for this tenant or membership is inactive';
  END IF;

  -- Update the global context in profiles
  UPDATE profiles 
  SET tenant_id = p_tenant_id, role = v_role 
  WHERE id = auth.uid();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
