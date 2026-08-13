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

    UPDATE tenants 
    SET deleted_at = now() 
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
