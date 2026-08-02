-- 0011_update_roles.sql

-- Drop existing policies that use 'owner' explicitly
DROP POLICY IF EXISTS "Users can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant owners can insert categories" ON categories;
DROP POLICY IF EXISTS "Tenant owners can update their categories" ON categories;
DROP POLICY IF EXISTS "Tenant owners can delete their categories" ON categories;

-- Safely drop the auto-generated check constraint on role
DO $$ 
DECLARE
  conname text;
BEGIN
  FOR conname IN 
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' AND column_name = 'role'
  LOOP
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(conname);
  END LOOP;
END $$;

-- Update existing data
UPDATE profiles SET role = 'admin' WHERE role = 'owner';

-- Add new constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'manager', 'professional', 'client'));
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'client';

-- Recreate policies with 'admin' and 'manager'
CREATE POLICY "Users can update their tenant" ON tenants
    FOR UPDATE USING (
        id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'super_admin')) OR is_super_admin()
    );

CREATE POLICY "Tenant owners can insert categories" ON categories
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Tenant owners can update their categories" ON categories
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Tenant owners can delete their categories" ON categories
    FOR DELETE USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );
