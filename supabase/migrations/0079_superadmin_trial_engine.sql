-- Migration 0079: Super Admin Configurable Trial Engine & Strict State Machine
-- Permite que o Super Admin controle 100% das regras de Trial através de /platform/plans

-- 1. Garante colunas de controle de Trial na tabela plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_trial_plan BOOLEAN DEFAULT false;

-- Garante colunas antifraude e ciclo de vida na tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 2. Trigger para garantir que APENAS UM plano ativo seja o Plano de Trial
CREATE OR REPLACE FUNCTION public.ensure_single_trial_plan()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_trial_plan = true THEN
        UPDATE public.plans 
        SET is_trial_plan = false 
        WHERE id != NEW.id AND is_trial_plan = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_trial_plan ON public.plans;
CREATE TRIGGER trg_ensure_single_trial_plan
BEFORE INSERT OR UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_trial_plan();

-- 3. Atualiza o trigger de auto-inscrição de novos Tenants
-- Agora busca DINAMICAMENTE o plano configurado pelo Super Admin e NUNCA marca como 'active'
CREATE OR REPLACE FUNCTION public.auto_subscribe_new_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_trial_plan RECORD;
    v_trial_days INT;
    v_trial_ends TIMESTAMPTZ;
BEGIN
    -- 1. Busca o plano ativo configurado explicitamente como Trial pelo Super Admin
    SELECT id, trial_days, key, name 
    INTO v_trial_plan 
    FROM public.plans 
    WHERE is_trial_plan = true AND active = true 
    LIMIT 1;

    -- 2. Fallback caso nenhum plano tenha sido explicitamente marcado como trial
    IF v_trial_plan.id IS NULL THEN
        SELECT id, trial_days, key, name 
        INTO v_trial_plan 
        FROM public.plans 
        WHERE active = true AND trial_days > 0 
        ORDER BY sort_order ASC 
        LIMIT 1;
    END IF;

    -- 3. Fallback final caso nenhum tenha trial_days > 0
    IF v_trial_plan.id IS NULL THEN
        SELECT id, trial_days, key, name 
        INTO v_trial_plan 
        FROM public.plans 
        WHERE active = true 
        ORDER BY sort_order ASC 
        LIMIT 1;
    END IF;

    v_trial_days := COALESCE(v_trial_plan.trial_days, 7);
    v_trial_ends := now() + (v_trial_days || ' days')::interval;

    -- 4. Cria a assinatura em status 'trial' (NUNCA 'active'!)
    IF v_trial_plan.id IS NOT NULL THEN
        INSERT INTO public.subscriptions (
            tenant_id, 
            plan_id, 
            status, 
            trial_ends_at,
            current_period_end
        ) VALUES (
            NEW.id, 
            v_trial_plan.id, 
            'trial',
            v_trial_ends,
            NULL
        );

        -- 5. Atualiza o tenant para refletir o trial ativo e registrar histórico antifraude
        UPDATE public.tenants
        SET 
            status = 'trial',
            account_state = 'trialing_with_card',
            trial_started_at = now(),
            trial_ends_at = v_trial_ends,
            has_used_trial = true
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_subscribe_new_tenant ON public.tenants;
CREATE TRIGGER trg_auto_subscribe_new_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_subscribe_new_tenant();

-- 4. Inicializa o plano Solo como o plano de Trial padrão inicial
UPDATE public.plans 
SET is_trial_plan = true 
WHERE key = 'solo_tier' AND active = true;

-- Se o solo_tier não existir, pega o primeiro ativo com sort_order = 1
UPDATE public.plans 
SET is_trial_plan = true 
WHERE id = (
  SELECT id FROM public.plans 
  WHERE active = true 
  ORDER BY sort_order ASC 
  LIMIT 1
) AND NOT EXISTS (SELECT 1 FROM public.plans WHERE is_trial_plan = true);
