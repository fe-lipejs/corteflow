-- ============================================================
-- Migration 0060: Fix RBAC Backend Fallback Security Flaw
-- Remove a falha de segurança que concedia acesso total a 
-- tenants com array de permissões vazio.
-- ============================================================

CREATE OR REPLACE FUNCTION has_tenant_permission(p_tenant_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_permissions JSONB;
BEGIN
    -- Obter as permissões do contrato ativo
    SELECT sc.permissions INTO v_permissions
    FROM subscription_contracts sc
    JOIN subscriptions s ON s.id = sc.subscription_id
    WHERE s.tenant_id = p_tenant_id AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Se não achou contrato, pegar do plano gratuito/default
    IF NOT FOUND THEN
        SELECT permissions INTO v_permissions FROM plans WHERE is_default = true LIMIT 1;
    END IF;

    -- Proteção estrita: Se v_permissions for nulo (legacy não migrado), bloqueia.
    -- O backfill da migração 0037 já garantiu que todos tenham '[]' ou '[...]'.
    -- Se for um array vazio '[]', significa que o admin revogou tudo. Portanto, bloqueia!
    IF v_permissions IS NULL THEN RETURN FALSE; END IF;
    
    -- Se o array contiver '*', ele tem acesso total
    IF v_permissions @> '"*"'::jsonb THEN RETURN TRUE; END IF;

    -- Verificar se o array JSONB contém a permissão solicitada exata
    RETURN v_permissions @> to_jsonb(p_permission_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
