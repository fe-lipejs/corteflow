-- Migration 0035: SaaS Plan Immutability & Auto-Subscription

-- 1. Trigger para bloquear atualizações em planos com assinaturas ativas
-- A imutabilidade da oferta garante que clientes antigos não sofram alterações retroativas 
-- caso o Super Admin modifique limites estruturais de um plano.

CREATE OR REPLACE FUNCTION check_plan_immutability()
RETURNS TRIGGER AS $$
DECLARE
    sub_count INT;
BEGIN
    -- Se é uma atualização e certos campos críticos estão mudando
    IF (NEW.max_professionals IS DISTINCT FROM OLD.max_professionals OR
        NEW.features IS DISTINCT FROM OLD.features OR
        NEW.allow_products IS DISTINCT FROM OLD.allow_products OR
        NEW.trial_days IS DISTINCT FROM OLD.trial_days) THEN
        
        -- Conta quantas assinaturas apontam para este plano
        SELECT count(*) INTO sub_count FROM subscriptions WHERE plan_id = OLD.id;
        
        -- Se houver pelo menos 1 assinatura, aborta
        IF sub_count > 0 THEN
            RAISE EXCEPTION 'Imutabilidade de Oferta: Este plano possui % assinaturas. Você não pode alterar limites estruturais para não afetar clientes existentes. Em vez disso, crie uma Nova Versão (Duplicar) e marque este plano como Inativo.', sub_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_plan_immutability ON plans;
CREATE TRIGGER trg_check_plan_immutability
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION check_plan_immutability();


-- 2. Trigger para garantir que apenas UM plano seja is_default
CREATE OR REPLACE FUNCTION ensure_single_default_plan()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE plans SET is_default = false WHERE id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_plan ON plans;
CREATE TRIGGER trg_ensure_single_default_plan
BEFORE INSERT OR UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_plan();


-- 3. Trigger de Inscrição Automática ao criar um Tenant
-- Isso garante que TODO usuário tenha uma assinatura desde o momento zero.

CREATE OR REPLACE FUNCTION auto_subscribe_new_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_default_plan_id UUID;
BEGIN
    -- Encontra o plano padrão ativo
    SELECT id INTO v_default_plan_id FROM plans WHERE is_default = true LIMIT 1;
    
    IF v_default_plan_id IS NOT NULL THEN
        INSERT INTO subscriptions (
            tenant_id, 
            plan_id, 
            status, 
            trial_ends_at
        ) VALUES (
            NEW.id, 
            v_default_plan_id, 
            'active',
            -- Se o plano tiver trial_days, podemos jogar para frente, senão ativa imediato
            COALESCE((SELECT now() + (trial_days || ' days')::interval FROM plans WHERE id = v_default_plan_id AND trial_days > 0), null)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_subscribe_new_tenant ON tenants;
CREATE TRIGGER trg_auto_subscribe_new_tenant
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION auto_subscribe_new_tenant();
