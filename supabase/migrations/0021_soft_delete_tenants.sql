-- Migration 0021: Soft Delete Tenants

-- 1. Add deleted_at column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update Public Policy
DROP POLICY IF EXISTS "Public can read active tenants" ON tenants;
CREATE POLICY "Public can read active tenants" ON tenants
  FOR SELECT USING (
    (status NOT IN ('blocked', 'suspended') OR status IS NULL) 
    AND deleted_at IS NULL
  );

-- 3. Update Owners Policy
DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
CREATE POLICY "Users can view their tenant" ON tenants
    FOR SELECT USING (
        (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND deleted_at IS NULL) OR is_super_admin()
    );

DROP POLICY IF EXISTS "Users can update their tenant" ON tenants;
CREATE POLICY "Users can update their tenant" ON tenants
    FOR UPDATE USING (
        (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')) AND deleted_at IS NULL) OR is_super_admin()
    );

-- 4. Change delete_tenant_safely to perform a Soft Delete instead of Hard Delete
CREATE OR REPLACE FUNCTION delete_tenant_safely(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    sub_status TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Empresa não encontrada.';
    END IF;

    SELECT status INTO sub_status
    FROM subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;

    IF sub_status IN ('active', 'past_due', 'unpaid') THEN
        RAISE EXCEPTION 'Não é possível apagar esta empresa pois ela possui uma assinatura % no Stripe. Cancele a assinatura primeiro.', sub_status;
    END IF;

    -- SOFT DELETE
    UPDATE tenants SET deleted_at = now() WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
