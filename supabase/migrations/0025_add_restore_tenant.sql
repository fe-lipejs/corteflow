-- Migration 0025: Add restore_tenant function and cancel on stripe helper

CREATE OR REPLACE FUNCTION restore_tenant(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Empresa não encontrada.';
    END IF;

    UPDATE tenants 
    SET deleted_at = NULL,
        status = 'active'
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
