-- Migration 0036: Subscription Contracts & Revisions (Flexible SaaS Architecture)

-- 1. Remover a trava agressiva antiga de imutabilidade da tabela plans.
-- A partir de agora, a imutabilidade é garantida pelos contratos, não por bloqueios na edição da vitrine.
DROP TRIGGER IF EXISTS trg_check_plan_immutability ON plans;
DROP FUNCTION IF EXISTS check_plan_immutability();

-- 2. Criar a tabela subscription_contracts
CREATE TABLE IF NOT EXISTS subscription_contracts (
    subscription_id UUID PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id), -- O plano base (apenas para referência de origem)
    price_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    max_professionals INTEGER NOT NULL DEFAULT 1,
    allow_products BOOLEAN NOT NULL DEFAULT false,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para subscription_contracts
ALTER TABLE subscription_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read all contracts" 
ON subscription_contracts FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Users read own contracts" 
ON subscription_contracts FOR SELECT 
USING (
    subscription_id IN (
        SELECT id FROM subscriptions WHERE tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 3. Criar a tabela subscription_revisions (Histórico e Agendamentos)
CREATE TABLE IF NOT EXISTS subscription_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- price_increase, price_decrease, limit_upgrade, limit_downgrade
    previous_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    previous_limits JSONB, -- { max_professionals, allow_products, features }
    new_limits JSONB,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    applied_at TIMESTAMP WITH TIME ZONE,
    notification_status VARCHAR(50) DEFAULT 'pending', -- pending, notified, accepted, auto_applied
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS para subscription_revisions
ALTER TABLE subscription_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read all revisions" 
ON subscription_revisions FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Users read own revisions" 
ON subscription_revisions FOR SELECT 
USING (
    subscription_id IN (
        SELECT id FROM subscriptions WHERE tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 4. Função/Trigger para criar ou atualizar o contrato automaticamente quando a assinatura mudar de plano
CREATE OR REPLACE FUNCTION sync_subscription_contract()
RETURNS TRIGGER AS $$
DECLARE
    v_plan RECORD;
    v_price_amount DECIMAL(10, 2) := 0;
    v_currency VARCHAR(3) := 'BRL';
BEGIN
    -- Busca os dados atuais do plano que originou esta assinatura/upgrade
    SELECT * INTO v_plan FROM plans WHERE id = NEW.plan_id;
    
    IF FOUND THEN
        -- Busca o preço padrão BRL do plano, se existir
        SELECT amount INTO v_price_amount 
        FROM plan_prices 
        WHERE plan_id = NEW.plan_id AND currency = 'BRL' 
        LIMIT 1;

        -- Faz o UPSERT no contrato, copiando (congelando) os limites do momento
        INSERT INTO subscription_contracts (
            subscription_id, plan_id, price_amount, currency, max_professionals, allow_products, features
        ) VALUES (
            NEW.id, NEW.plan_id, COALESCE(v_price_amount, 0), 'BRL', v_plan.max_professionals, v_plan.allow_products, v_plan.features
        )
        ON CONFLICT (subscription_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            price_amount = EXCLUDED.price_amount,
            max_professionals = EXCLUDED.max_professionals,
            allow_products = EXCLUDED.allow_products,
            features = EXCLUDED.features,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_subscription_contract ON subscriptions;
CREATE TRIGGER trg_sync_subscription_contract
AFTER INSERT OR UPDATE OF plan_id ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_subscription_contract();

-- 5. Backfill: Gerar contratos para todas as assinaturas existentes que ainda não tenham um
DO $$
DECLARE
    sub RECORD;
BEGIN
    FOR sub IN SELECT * FROM subscriptions WHERE id NOT IN (SELECT subscription_id FROM subscription_contracts) LOOP
        -- O próprio fato de fazer um UPDATE (mesmo com o mesmo plan_id) vai disparar a trigger
        UPDATE subscriptions SET plan_id = plan_id WHERE id = sub.id;
    END LOOP;
END;
$$;
