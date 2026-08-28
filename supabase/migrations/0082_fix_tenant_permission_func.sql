CREATE OR REPLACE FUNCTION has_tenant_permission(p_tenant_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_permissions JSONB;
BEGIN
    -- Obter as permissões lendo do PLANO ATUAL da assinatura para refletir mudanças em tempo real
    SELECT p.permissions INTO v_permissions
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id AND s.status IN ('active', 'trialing', 'past_due')
    LIMIT 1;

    -- Se não achou plano via subscription, pegar do plano gratuito/default
    IF NOT FOUND THEN
        SELECT permissions INTO v_permissions FROM plans WHERE is_default = true LIMIT 1;
    END IF;

    -- Se for nulo ou array vazio, assumimos true temporariamente por retrocompatibilidade (igual na UI)
    IF v_permissions IS NULL THEN RETURN TRUE; END IF;
    IF jsonb_array_length(v_permissions) = 0 THEN RETURN TRUE; END IF;

    -- Se tiver a permissão '*' (super admin ou full access)
    IF v_permissions @> '["*"]'::jsonb THEN RETURN TRUE; END IF;

    -- Verificar se o array JSONB contém a permissão solicitada
    RETURN v_permissions @> to_jsonb(p_permission_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
