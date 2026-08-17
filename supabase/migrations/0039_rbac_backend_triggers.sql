-- Migration 0039: RBAC Backend Protection Triggers

-- 1. Helper Function to check if a tenant has a specific permission
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

    -- Se for nulo ou array vazio, assumimos true temporariamente por retrocompatibilidade (igual na UI)
    IF v_permissions IS NULL THEN RETURN TRUE; END IF;
    IF jsonb_array_length(v_permissions) = 0 THEN RETURN TRUE; END IF;

    -- Verificar se o array JSONB contém a permissão solicitada
    RETURN v_permissions @> to_jsonb(p_permission_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Triggers para a Tabela Professionals (Equipe)
CREATE OR REPLACE FUNCTION protect_professionals_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT has_tenant_permission(NEW.tenant_id, 'equipe.criar') THEN
        RAISE EXCEPTION 'Acesso negado: Requer permissão equipe.criar';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rbac_check_professionals_create ON professionals;
CREATE TRIGGER rbac_check_professionals_create
BEFORE INSERT ON professionals
FOR EACH ROW EXECUTE FUNCTION protect_professionals_insert();


CREATE OR REPLACE FUNCTION protect_professionals_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT has_tenant_permission(NEW.tenant_id, 'equipe.editar_perfil') THEN
        RAISE EXCEPTION 'Acesso negado: Requer permissão equipe.editar_perfil';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rbac_check_professionals_update ON professionals;
CREATE TRIGGER rbac_check_professionals_update
BEFORE UPDATE ON professionals
FOR EACH ROW EXECUTE FUNCTION protect_professionals_update();
