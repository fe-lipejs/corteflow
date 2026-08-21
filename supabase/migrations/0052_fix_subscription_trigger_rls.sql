-- Migration 0052: Fix RLS issue on subscriptions during onboarding
-- Define a função de auto-assinatura como SECURITY DEFINER para bypassar o RLS
-- já que no momento da criação do tenant o profile do usuário ainda não tem o tenant_id associado.

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
