-- Fix: RLS policy for tenants table to allow 'admin' and 'manager' roles (from 0011_update_roles.sql) which was overwritten by 0021_soft_delete_tenants.sql.

DROP POLICY IF EXISTS "Users can update their tenant" ON tenants;

CREATE POLICY "Users can update their tenant" ON tenants
    FOR UPDATE USING (
        (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'super_admin')) AND deleted_at IS NULL) OR is_super_admin()
    );
