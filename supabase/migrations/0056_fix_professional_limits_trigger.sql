-- Description: Fixes the database trigger to only enforce subscription limits when a professional is newly activated

CREATE OR REPLACE FUNCTION check_professional_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INTEGER;
  v_max_professionals INTEGER;
BEGIN
  -- We only enforce limits on ACTIVE professionals when they are newly inserted or activated
  IF NEW.active = true AND (TG_OP = 'INSERT' OR OLD.active = false) THEN
    -- Count currently active professionals for this tenant (excluding the one being updated)
    SELECT count(*) INTO v_active_count 
    FROM professionals 
    WHERE tenant_id = NEW.tenant_id 
      AND active = true 
      AND id != NEW.id;

    -- Look up the maximum allowed professionals from the tenant's current active plan
    SELECT COALESCE(p.max_professionals, 1) INTO v_max_professionals
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing', 'trial')
    LEFT JOIN plans p ON p.id = s.plan_id
    WHERE t.id = NEW.tenant_id
    ORDER BY s.current_period_end DESC NULLS LAST
    LIMIT 1;

    -- Fallback to 1 if not found
    IF v_max_professionals IS NULL THEN
      v_max_professionals := 1;
    END IF;

    -- If adding this new active professional exceeds the limit, block it
    IF v_active_count >= v_max_professionals THEN
      RAISE EXCEPTION 'LIMITE_PROFISSIONAIS_ATINGIDO';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
