-- Migration 0038: Backend Security & Limits (Enforcing SaaS constraints)

-- Função utilitária para pegar o limite de um tenant
CREATE OR REPLACE FUNCTION get_tenant_limit(p_tenant_id UUID, p_limit_key TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_limit INTEGER;
    v_sub_status TEXT;
    v_contract_limits JSONB;
    v_max_prof INTEGER;
    v_default_limits JSONB;
BEGIN
    -- 1. Tenta achar a assinatura ativa (contract)
    SELECT s.status, sc.limits, sc.max_professionals 
    INTO v_sub_status, v_contract_limits, v_max_prof
    FROM subscriptions s
    LEFT JOIN subscription_contracts sc ON sc.subscription_id = s.id
    WHERE s.tenant_id = p_tenant_id 
      AND s.status IN ('active', 'trialing', 'trial', 'past_due', 'canceled')
    ORDER BY CASE WHEN s.status = 'active' THEN 1 ELSE 2 END
    LIMIT 1;

    -- Se tem contrato ativo
    IF FOUND AND v_sub_status != 'canceled' THEN
        v_limit := (v_contract_limits->>p_limit_key)::INTEGER;
        IF v_limit IS NULL THEN
           -- fallback para max_professionals se a chave for profissionais
           IF p_limit_key = 'profissionais' THEN
               v_limit := v_max_prof;
           END IF;
        END IF;
    ELSE
        -- Fallback pro plano default
        SELECT limits, max_professionals INTO v_default_limits, v_max_prof FROM plans WHERE is_default = true LIMIT 1;
        v_limit := (v_default_limits->>p_limit_key)::INTEGER;
        IF v_limit IS NULL THEN
           IF p_limit_key = 'profissionais' THEN
               v_limit := v_max_prof;
           END IF;
        END IF;
    END IF;

    -- Se não achou, retorna 0 para bloquear por segurança (mas profissionais fallback 1 para free)
    IF v_limit IS NULL THEN
        IF p_limit_key = 'profissionais' THEN RETURN 1; END IF;
        RETURN 0;
    END IF;
    
    RETURN v_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger para bloquear profissionais acima do limite
CREATE OR REPLACE FUNCTION check_professional_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT count(*) INTO v_current_count FROM professionals WHERE tenant_id = NEW.tenant_id;
    v_limit := get_tenant_limit(NEW.tenant_id, 'profissionais');

    -- Se -1 (unlimited) passa reto
    IF v_limit != -1 AND v_current_count >= v_limit THEN
        RAISE EXCEPTION 'Limite de profissionais atingido para o plano atual (MÁX: %).', v_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_professional_limit ON professionals;
CREATE TRIGGER trg_check_professional_limit
BEFORE INSERT ON professionals
FOR EACH ROW
EXECUTE FUNCTION check_professional_limit();


-- Trigger para bloquear produtos
CREATE OR REPLACE FUNCTION check_product_feature()
RETURNS TRIGGER AS $$
DECLARE
    v_sub_status TEXT;
    v_contract_features JSONB;
    v_allow_prod BOOLEAN;
    v_default_features JSONB;
    v_has_feature BOOLEAN := false;
BEGIN
    SELECT s.status, sc.features, sc.allow_products 
    INTO v_sub_status, v_contract_features, v_allow_prod
    FROM subscriptions s
    LEFT JOIN subscription_contracts sc ON sc.subscription_id = s.id
    WHERE s.tenant_id = NEW.tenant_id 
      AND s.status IN ('active', 'trialing', 'trial', 'past_due', 'canceled')
    ORDER BY CASE WHEN s.status = 'active' THEN 1 ELSE 2 END
    LIMIT 1;

    IF FOUND AND v_sub_status != 'canceled' THEN
        v_has_feature := COALESCE((v_contract_features->>'produtos')::BOOLEAN, v_allow_prod, false);
    ELSE
        SELECT features, allow_products INTO v_default_features, v_allow_prod FROM plans WHERE is_default = true LIMIT 1;
        v_has_feature := COALESCE((v_default_features->>'produtos')::BOOLEAN, v_allow_prod, false);
    END IF;

    IF NOT v_has_feature THEN
        RAISE EXCEPTION 'O plano atual não permite gerenciar produtos.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_feature ON products;
CREATE TRIGGER trg_check_product_feature
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION check_product_feature();
