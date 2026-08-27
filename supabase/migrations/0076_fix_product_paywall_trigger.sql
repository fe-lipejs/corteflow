
-- ==============================================================================
-- Migration 0076: Fix Product Paywall Trigger
-- Implementa validação no backend para impedir que tenants sem a feature
-- allow_products insiram produtos diretamente via API, burlando o paywall.
-- ==============================================================================

CREATE OR REPLACE FUNCTION check_product_paywall()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id uuid;
  v_allow_products boolean;
BEGIN
  -- Obtém o plano ativo do tenant
  SELECT plan_id INTO v_plan_id
  FROM subscriptions
  WHERE tenant_id = NEW.tenant_id
    AND status IN ('active', 'trialing', 'trial')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    -- Verifica se o plano permite produtos
    SELECT allow_products INTO v_allow_products
    FROM plans
    WHERE id = v_plan_id;

    IF v_allow_products IS FALSE THEN
      RAISE EXCEPTION 'PLANO_NAO_PERMITE_PRODUTOS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_product_paywall ON products;
CREATE TRIGGER trg_check_product_paywall
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_product_paywall();
