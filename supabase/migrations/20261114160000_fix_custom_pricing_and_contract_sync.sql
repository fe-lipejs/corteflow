-- Migration: Fix Custom Pricing & Preserve Super Admin Custom Contract Overrides on Checkout
-- 1. Auto-heal existing custom_pricing records that were linked to the Trial plan instead of the target paid plan (Solo)
DO $$
DECLARE
    v_solo_plan_id UUID;
BEGIN
    SELECT id INTO v_solo_plan_id
    FROM public.plans
    WHERE active = true
      AND COALESCE(is_trial_plan, false) = false
      AND name <> 'Trial (Período de Teste)'
      AND key NOT IN ('expired_tier', 'fallback_tier')
      AND name NOT ILIKE '%fallback%'
      AND name NOT ILIKE '%cancelado%'
    ORDER BY sort_order ASC
    LIMIT 1;

    IF v_solo_plan_id IS NOT NULL THEN
        UPDATE public.custom_pricing cp
        SET plan_id = v_solo_plan_id
        FROM public.plans p
        WHERE cp.plan_id = p.id
          AND (COALESCE(p.is_trial_plan, false) = true OR p.name = 'Trial (Período de Teste)');
    END IF;
END $$;

-- 2. Sync subscription_contracts.price_amount for any tenant that currently has a custom_pricing override
UPDATE public.subscription_contracts sc
SET price_amount = cp.amount_override
FROM public.subscriptions s
JOIN public.custom_pricing cp ON cp.tenant_id = s.tenant_id
WHERE sc.subscription_id = s.id
  AND cp.amount_override > 0;

-- 3. Update sync_subscription_contract() trigger function so it respects custom_pricing AND preserves Super Admin custom overrides
CREATE OR REPLACE FUNCTION public.sync_subscription_contract()
RETURNS TRIGGER AS $$
DECLARE
    v_plan RECORD;
    v_existing RECORD;
    v_price_amount DECIMAL(10, 2) := 0;
    v_custom_price DECIMAL(10, 2);
BEGIN
    SELECT * INTO v_plan FROM public.plans WHERE id = NEW.plan_id;

    IF FOUND THEN
        -- Verifica primeiro se há preço personalizado (custom_pricing) para este tenant
        SELECT amount_override INTO v_custom_price
        FROM public.custom_pricing
        WHERE tenant_id = NEW.tenant_id
          AND amount_override > 0
        ORDER BY (plan_id = NEW.plan_id) DESC
        LIMIT 1;

        IF v_custom_price IS NOT NULL AND v_custom_price > 0 THEN
            v_price_amount := v_custom_price;
        ELSE
            SELECT amount INTO v_price_amount
            FROM public.plan_prices
            WHERE plan_id = NEW.plan_id AND currency = 'BRL'
            LIMIT 1;
        END IF;

        SELECT * INTO v_existing
        FROM public.subscription_contracts
        WHERE subscription_id = NEW.id;

        -- Se o contrato já existia e foi personalizado pelo Super Admin (_custom_override = true),
        -- preservamos os limites e recursos liberados pelo Super Admin!
        IF FOUND AND COALESCE((v_existing.features->>'_custom_override')::boolean, false) = true THEN
            UPDATE public.subscription_contracts
            SET
                plan_id = NEW.plan_id,
                price_amount = COALESCE(v_price_amount, v_existing.price_amount, 0),
                max_professionals = GREATEST(COALESCE(v_existing.max_professionals, 1), COALESCE(v_plan.max_professionals, 1)),
                allow_products = COALESCE(v_existing.allow_products, false) OR COALESCE(v_plan.allow_products, false),
                features = COALESCE(v_plan.features, '{}'::jsonb) || COALESCE(v_existing.features, '{}'::jsonb) || '{"_custom_override": true}'::jsonb,
                limits = COALESCE(v_plan.limits, '{}'::jsonb) || COALESCE(v_existing.limits, '{}'::jsonb),
                permissions = CASE
                    WHEN v_existing.permissions @> '["*"]'::jsonb OR COALESCE(v_plan.permissions, '[]'::jsonb) @> '["*"]'::jsonb
                    THEN '["*"]'::jsonb
                    ELSE COALESCE(v_existing.permissions, v_plan.permissions, '[]'::jsonb)
                END,
                updated_at = NOW()
            WHERE subscription_id = NEW.id;
        ELSE
            INSERT INTO public.subscription_contracts (
                subscription_id, plan_id, price_amount, currency, max_professionals, allow_products, features, permissions, limits
            ) VALUES (
                NEW.id,
                NEW.plan_id,
                COALESCE(v_price_amount, 0),
                'BRL',
                v_plan.max_professionals,
                v_plan.allow_products,
                v_plan.features,
                COALESCE(v_plan.permissions, '[]'::jsonb),
                COALESCE(v_plan.limits, '{}'::jsonb)
            )
            ON CONFLICT (subscription_id) DO UPDATE SET
                plan_id = EXCLUDED.plan_id,
                price_amount = EXCLUDED.price_amount,
                max_professionals = EXCLUDED.max_professionals,
                allow_products = EXCLUDED.allow_products,
                features = EXCLUDED.features,
                permissions = EXCLUDED.permissions,
                limits = EXCLUDED.limits,
                updated_at = NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update cascade_plan_updates() so global plan edits do NOT overwrite individual salon custom overrides
CREATE OR REPLACE FUNCTION public.cascade_plan_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.max_professionals IS DISTINCT FROM OLD.max_professionals OR
        NEW.features IS DISTINCT FROM OLD.features OR
        NEW.permissions IS DISTINCT FROM OLD.permissions OR
        NEW.limits IS DISTINCT FROM OLD.limits OR
        NEW.allow_products IS DISTINCT FROM OLD.allow_products) THEN

        UPDATE public.subscription_contracts
        SET
            max_professionals = NEW.max_professionals,
            allow_products = NEW.allow_products,
            features = NEW.features,
            permissions = NEW.permissions,
            limits = COALESCE(NEW.limits, '{}'::jsonb),
            updated_at = NOW()
        WHERE plan_id = NEW.id
          AND COALESCE((features->>'_custom_override')::boolean, false) = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Tighten RLS on custom_pricing: tenants can SELECT their own discounts, only Super Admin can write
DROP POLICY IF EXISTS "Tenant isolation for custom_pricing" ON public.custom_pricing;
DROP POLICY IF EXISTS "Tenants can view their custom pricing" ON public.custom_pricing;
DROP POLICY IF EXISTS "Super admin can manage custom pricing" ON public.custom_pricing;

CREATE POLICY "Tenants can view their custom pricing" ON public.custom_pricing
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_super_admin()
    );

CREATE POLICY "Super admin can manage custom pricing" ON public.custom_pricing
    FOR ALL USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

