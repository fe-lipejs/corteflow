-- Migration 0040: Cascade Plan Updates to Active Contracts
-- Remove plan immutability trigger as it blocks evolving the SaaS offering.
-- Instead, we cascade feature and limit updates to all active subscriptions of that plan.

DROP TRIGGER IF EXISTS trg_check_plan_immutability ON plans;
DROP FUNCTION IF EXISTS check_plan_immutability();

CREATE OR REPLACE FUNCTION cascade_plan_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Only cascade if important structural fields changed
    IF (NEW.max_professionals IS DISTINCT FROM OLD.max_professionals OR
        NEW.features IS DISTINCT FROM OLD.features OR
        NEW.permissions IS DISTINCT FROM OLD.permissions OR
        NEW.limits IS DISTINCT FROM OLD.limits OR
        NEW.allow_products IS DISTINCT FROM OLD.allow_products) THEN
        
        UPDATE subscription_contracts
        SET 
            max_professionals = NEW.max_professionals,
            allow_products = NEW.allow_products,
            features = NEW.features,
            permissions = NEW.permissions,
            limits = COALESCE(NEW.limits, '{}'::jsonb),
            updated_at = NOW()
        WHERE plan_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_plan_updates ON plans;
CREATE TRIGGER trg_cascade_plan_updates
AFTER UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION cascade_plan_updates();

-- Forca a atualizacao imediata dos contratos existentes com base nos planos atuais
UPDATE subscription_contracts sc
SET 
    max_professionals = p.max_professionals,
    allow_products = p.allow_products,
    features = p.features,
    permissions = p.permissions,
    limits = COALESCE(p.limits, '{}'::jsonb)
FROM plans p
WHERE sc.plan_id = p.id;
