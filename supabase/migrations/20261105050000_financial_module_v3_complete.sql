-- ============================================================================
-- MIGRATION: 20261105050000_financial_module_v3_complete.sql
-- RAFFROS — Evolução Completa do Módulo Financeiro
-- Fluxo de Caixa, Gestão de Despesas (Fixas e Variáveis), Recorrências e Contas a Pagar
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CORREÇÃO CRÍTICA E EXPANSÃO DE financial_transactions
-- O trigger trg_financial_audit atualiza NEW.updated_at, que precisava existir.
-- ----------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ----------------------------------------------------------------------------
-- 2. EVOLUÇÃO DE recurring_expenses (GASTOS FIXOS / REGRAS DE RECORRÊNCIA)
-- Preserva todos os dados atuais e expande frequências e controles de vigência.
-- ----------------------------------------------------------------------------
ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_frequency_check;

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS due_day INTEGER,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_frequency_check
  CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly'));

ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_status_check;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_status_check
  CHECK (status IN ('active', 'paused', 'ended'));

ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_due_day_check;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_due_day_check
  CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

-- Backfill seguro para regras já cadastradas
UPDATE public.recurring_expenses
SET
  due_day = COALESCE(due_day, EXTRACT(DAY FROM COALESCE(next_due_date, start_date))::INTEGER),
  status = CASE WHEN active IS FALSE THEN 'paused' ELSE COALESCE(status, 'active') END
WHERE due_day IS NULL;

-- Atualizar política RLS de recurring_expenses (Leitura e Escrita multi-tenant segura)
DROP POLICY IF EXISTS "Tenant isolation for recurring_expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Tenant isolation for recurring_expenses (READ)" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Tenant isolation for recurring_expenses (WRITE)" ON public.recurring_expenses;

CREATE POLICY "Tenant isolation for recurring_expenses (READ)" ON public.recurring_expenses
  FOR SELECT
  USING (
    tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY "Tenant isolation for recurring_expenses (WRITE)" ON public.recurring_expenses
  FOR ALL
  USING (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  )
  WITH CHECK (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  );

-- ----------------------------------------------------------------------------
-- 3. NOVA TABELA: expense_payables (OBRIGAÇÕES FINANCEIRAS: FIXAS E VARIÁVEIS)
-- Reúne ocorrências independentes de Gastos Fixos e registros de Gastos Variáveis.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable')),
  recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  competence_date DATE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL CHECK (expected_amount > 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  purchase_date DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'partial', 'paid', 'canceled')),
  paid_at DATE,
  payment_method TEXT,
  notes TEXT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices de performance e idempotência estrita para recorrências
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_payables_unique_competence
  ON public.expense_payables (tenant_id, recurring_expense_id, competence_date)
  WHERE recurring_expense_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_payables_tenant_due
  ON public.expense_payables (tenant_id, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_payables_tenant_status
  ON public.expense_payables (tenant_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.expense_payables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for expense_payables (READ)" ON public.expense_payables;
DROP POLICY IF EXISTS "Tenant isolation for expense_payables (WRITE)" ON public.expense_payables;

CREATE POLICY "Tenant isolation for expense_payables (READ)" ON public.expense_payables
  FOR SELECT
  USING (
    tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY "Tenant isolation for expense_payables (WRITE)" ON public.expense_payables
  FOR ALL
  USING (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  )
  WITH CHECK (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  );

-- Vincular financial_transactions a expense_payables
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payable_id UUID REFERENCES public.expense_payables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_payable_id
  ON public.financial_transactions (payable_id)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. NOVA TABELA: expense_payments (HISTÓRICO DE PAGAMENTOS DE OBRIGAÇÕES)
-- Garante rastreabilidade 1:1 com financial_transactions e suporta parciais.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payable_id UUID NOT NULL REFERENCES public.expense_payables(id) ON DELETE CASCADE,
  financial_transaction_id UUID UNIQUE REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at DATE NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_payments_payable
  ON public.expense_payments (payable_id);

CREATE INDEX IF NOT EXISTS idx_expense_payments_tenant
  ON public.expense_payments (tenant_id, paid_at DESC);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for expense_payments (READ)" ON public.expense_payments;
DROP POLICY IF EXISTS "Tenant isolation for expense_payments (WRITE)" ON public.expense_payments;

CREATE POLICY "Tenant isolation for expense_payments (READ)" ON public.expense_payments
  FOR SELECT
  USING (
    tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY "Tenant isolation for expense_payments (WRITE)" ON public.expense_payments
  FOR ALL
  USING (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  )
  WITH CHECK (
    (
      tenant_id = (SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid())
      OR public.is_super_admin()
    )
    AND public.is_account_writable(tenant_id)
  );

-- ----------------------------------------------------------------------------
-- 5. FUNÇÃO AUXILIAR DE DATA SEGURA PARA MESES CURTOS (28/29/30/31 DIAS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.make_clamped_date(p_year INT, p_month INT, p_day INT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_first DATE;
  v_last_day INT;
BEGIN
  v_first := make_date(p_year, p_month, 1);
  v_last_day := EXTRACT(DAY FROM (v_first + INTERVAL '1 month - 1 day'))::INT;
  RETURN make_date(p_year, p_month, LEAST(GREATEST(p_day, 1), v_last_day));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. MOTOR IDEMPOTENTE DE GERAÇÃO DE COMPETÊNCIAS RECORRENTES
-- Não gera saídas no caixa antes da confirmação do pagamento; gera apenas
-- obrigações independentes em expense_payables.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_recurring_payables(
  p_tenant_id UUID,
  p_horizon_date DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant UUID;
  v_horizon DATE;
  v_rule RECORD;
  v_step INT;
  v_months_step INT;
  v_target_month DATE;
  v_due_date DATE;
  v_comp_date DATE;
  v_due_day INT;
  v_created_count INT := 0;
  v_inserted_id UUID;
  v_next_unpaid DATE;
BEGIN
  -- Validação de segurança multi-tenant quando chamado via API autenticada
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE id = auth.uid();
    IF v_caller_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado ao tenant informado.';
    END IF;
  END IF;

  -- Horizonte padrão: maior entre p_horizon_date e hoje + 45 dias (limitado a 24 meses à frente)
  v_horizon := LEAST(
    GREATEST(COALESCE(p_horizon_date, CURRENT_DATE + 45), CURRENT_DATE + 45),
    (CURRENT_DATE + INTERVAL '24 months')::DATE
  );

  FOR v_rule IN
    SELECT *
    FROM public.recurring_expenses
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NULL
      AND active IS TRUE
      AND status = 'active'
  LOOP
    v_step := 0;
    v_due_day := COALESCE(v_rule.due_day, EXTRACT(DAY FROM COALESCE(v_rule.next_due_date, v_rule.start_date))::INT);

    IF v_rule.frequency IN ('weekly', 'biweekly') THEN
      LOOP
        EXIT WHEN v_step > 200;
        v_due_date := v_rule.start_date + (v_step * CASE WHEN v_rule.frequency = 'weekly' THEN 7 ELSE 14 END);
        EXIT WHEN v_due_date > v_horizon;
        EXIT WHEN v_rule.end_date IS NOT NULL AND v_due_date > v_rule.end_date;

        v_comp_date := v_due_date;

        INSERT INTO public.expense_payables (
          tenant_id, expense_type, recurring_expense_id, competence_date,
          description, category, expected_amount, paid_amount,
          due_date, status, payment_method, notes, created_by
        ) VALUES (
          v_rule.tenant_id, 'fixed', v_rule.id, v_comp_date,
          v_rule.description, v_rule.category, v_rule.amount, 0,
          v_due_date, 'pending', v_rule.payment_method, v_rule.notes, v_rule.created_by
        )
        ON CONFLICT (tenant_id, recurring_expense_id, competence_date)
        WHERE recurring_expense_id IS NOT NULL AND deleted_at IS NULL
        DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
          v_created_count := v_created_count + 1;
          v_inserted_id := NULL;
        END IF;

        v_step := v_step + 1;
      END LOOP;
    ELSE
      v_months_step := CASE v_rule.frequency
        WHEN 'monthly' THEN 1
        WHEN 'quarterly' THEN 3
        WHEN 'semiannual' THEN 6
        WHEN 'yearly' THEN 12
        ELSE 1
      END;

      LOOP
        EXIT WHEN v_step > 120;
        v_target_month := (date_trunc('month', v_rule.start_date) + ((v_step * v_months_step) || ' months')::INTERVAL)::DATE;
        v_due_date := public.make_clamped_date(
          EXTRACT(YEAR FROM v_target_month)::INT,
          EXTRACT(MONTH FROM v_target_month)::INT,
          v_due_day
        );

        -- Se no passo 0 o dia de vencimento no mês inicial for anterior à start_date, avança para o próximo ciclo
        IF v_due_date < v_rule.start_date THEN
          v_step := v_step + 1;
          CONTINUE;
        END IF;

        EXIT WHEN v_due_date > v_horizon;
        EXIT WHEN v_rule.end_date IS NOT NULL AND v_due_date > v_rule.end_date;

        v_comp_date := make_date(
          EXTRACT(YEAR FROM v_target_month)::INT,
          EXTRACT(MONTH FROM v_target_month)::INT,
          1
        );

        INSERT INTO public.expense_payables (
          tenant_id, expense_type, recurring_expense_id, competence_date,
          description, category, expected_amount, paid_amount,
          due_date, status, payment_method, notes, created_by
        ) VALUES (
          v_rule.tenant_id, 'fixed', v_rule.id, v_comp_date,
          v_rule.description, v_rule.category, v_rule.amount, 0,
          v_due_date, 'pending', v_rule.payment_method, v_rule.notes, v_rule.created_by
        )
        ON CONFLICT (tenant_id, recurring_expense_id, competence_date)
        WHERE recurring_expense_id IS NOT NULL AND deleted_at IS NULL
        DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
          v_created_count := v_created_count + 1;
          v_inserted_id := NULL;
        END IF;

        v_step := v_step + 1;
      END LOOP;
    END IF;

    -- Atualiza next_due_date na regra para refletir o próximo vencimento em aberto
    SELECT MIN(due_date) INTO v_next_unpaid
    FROM public.expense_payables
    WHERE recurring_expense_id = v_rule.id
      AND deleted_at IS NULL
      AND status IN ('pending', 'scheduled', 'partial');

    IF v_next_unpaid IS NOT NULL AND v_next_unpaid IS DISTINCT FROM v_rule.next_due_date THEN
      UPDATE public.recurring_expenses
      SET next_due_date = v_next_unpaid, updated_at = NOW()
      WHERE id = v_rule.id;
    END IF;
  END LOOP;

  RETURN v_created_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. CONFIRMAÇÃO ATÔMICA DE PAGAMENTO DE OBRIGAÇÃO (pay_expense_payable)
-- Atualiza obrigação, grava histórico em expense_payments e gera UMA ÚNICA
-- saída correspondente no Fluxo de Caixa (financial_transactions).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_expense_payable(
  p_payable_id UUID,
  p_amount NUMERIC,
  p_paid_at DATE,
  p_payment_method TEXT,
  p_notes TEXT DEFAULT NULL,
  p_settle_full BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payable public.expense_payables%ROWTYPE;
  v_caller_tenant UUID;
  v_new_paid NUMERIC(12,2);
  v_new_status TEXT;
  v_tx_id UUID;
  v_payment_id UUID;
  v_method TEXT;
  v_tx_desc TEXT;
  v_next_unpaid DATE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor de pagamento maior que zero.';
  END IF;

  -- Lock da obrigação para evitar duplo clique / corrida concorrente
  SELECT * INTO v_payable
  FROM public.expense_payables
  WHERE id = p_payable_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obrigação financeira não encontrada.';
  END IF;

  -- Verificação de segurança multi-tenant e permissão de escrita
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE id = auth.uid();
    IF v_caller_tenant IS DISTINCT FROM v_payable.tenant_id THEN
      RAISE EXCEPTION 'Acesso negado.';
    END IF;
  END IF;

  IF NOT public.is_account_writable(v_payable.tenant_id) THEN
    RAISE EXCEPTION 'Conta em modo somente leitura. Verifique sua assinatura.';
  END IF;

  -- Idempotência: se já está integralmente paga, não duplica lançamento
  IF v_payable.status = 'paid' THEN
    RETURN jsonb_build_object(
      'already_paid', true,
      'payable_id', v_payable.id,
      'status', v_payable.status,
      'paid_amount', v_payable.paid_amount
    );
  END IF;

  v_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), v_payable.payment_method, 'PIX');
  v_new_paid := COALESCE(v_payable.paid_amount, 0) + ROUND(p_amount, 2);

  IF v_new_paid >= v_payable.expected_amount OR COALESCE(p_settle_full, TRUE) IS TRUE THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  v_tx_desc := CASE
    WHEN v_new_status = 'partial' THEN v_payable.description || ' (Parcial)'
    WHEN v_payable.paid_amount > 0 THEN v_payable.description || ' (Quitação Restante)'
    ELSE v_payable.description
  END;

  -- 1. Gerar saída única no Fluxo de Caixa
  INSERT INTO public.financial_transactions (
    tenant_id,
    type,
    amount,
    description,
    category,
    payment_method,
    professional_id,
    recurring_expense_id,
    payable_id,
    status,
    date,
    notes,
    created_by
  ) VALUES (
    v_payable.tenant_id,
    'expense',
    ROUND(p_amount, 2),
    v_tx_desc,
    v_payable.category,
    v_method,
    v_payable.professional_id,
    v_payable.recurring_expense_id,
    v_payable.id,
    'succeeded',
    ((COALESCE(p_paid_at, CURRENT_DATE))::TEXT || 'T12:00:00Z')::TIMESTAMPTZ,
    NULLIF(TRIM(p_notes), ''),
    auth.uid()
  )
  RETURNING id INTO v_tx_id;

  -- 2. Registrar no histórico de pagamentos da obrigação
  INSERT INTO public.expense_payments (
    tenant_id,
    payable_id,
    financial_transaction_id,
    amount,
    paid_at,
    payment_method,
    notes,
    created_by
  ) VALUES (
    v_payable.tenant_id,
    v_payable.id,
    v_tx_id,
    ROUND(p_amount, 2),
    COALESCE(p_paid_at, CURRENT_DATE),
    v_method,
    NULLIF(TRIM(p_notes), ''),
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- 3. Atualizar status e saldo da obrigação
  -- Caso seja quitação integral com valor ajustado (ex: conta de luz veio mais barata),
  -- ajustamos expected_amount ao total pago para não restar resíduo fantasma.
  UPDATE public.expense_payables
  SET
    paid_amount = v_new_paid,
    expected_amount = CASE
      WHEN v_new_status = 'paid' AND v_new_paid <> expected_amount THEN v_new_paid
      ELSE expected_amount
    END,
    status = v_new_status,
    paid_at = COALESCE(p_paid_at, CURRENT_DATE),
    payment_method = v_method,
    notes = COALESCE(NULLIF(TRIM(p_notes), ''), notes),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = v_payable.id;

  -- 4. Se for gasto fixo, atualizar next_due_date da regra recorrente
  IF v_payable.recurring_expense_id IS NOT NULL THEN
    SELECT MIN(due_date) INTO v_next_unpaid
    FROM public.expense_payables
    WHERE recurring_expense_id = v_payable.recurring_expense_id
      AND deleted_at IS NULL
      AND status IN ('pending', 'scheduled', 'partial');

    IF v_next_unpaid IS NOT NULL THEN
      UPDATE public.recurring_expenses
      SET next_due_date = v_next_unpaid, updated_at = NOW()
      WHERE id = v_payable.recurring_expense_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'already_paid', false,
    'payable_id', v_payable.id,
    'payment_id', v_payment_id,
    'financial_transaction_id', v_tx_id,
    'status', v_new_status,
    'paid_amount', v_new_paid
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. TRIGGERS DE CONSISTÊNCIA BIDIRECIONAL (EXCLUSÃO / ESTORNO DE LANÇAMENTO)
-- Se uma saída vinculada no Fluxo de Caixa for excluída (soft-delete), reverte
-- automaticamente o pagamento correspondente na obrigação em expense_payables.
-- Se uma obrigação em expense_payables for excluída, remove saídas vinculadas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_payable_on_tx_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payable_id UUID;
  v_remaining_paid NUMERIC(12,2);
  v_last_paid_at DATE;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND NEW.payable_id IS NOT NULL THEN
    v_payable_id := NEW.payable_id;

    DELETE FROM public.expense_payments
    WHERE financial_transaction_id = NEW.id;

    SELECT COALESCE(SUM(amount), 0), MAX(paid_at)
    INTO v_remaining_paid, v_last_paid_at
    FROM public.expense_payments
    WHERE payable_id = v_payable_id;

    UPDATE public.expense_payables
    SET
      paid_amount = v_remaining_paid,
      paid_at = v_last_paid_at,
      status = CASE
        WHEN deleted_at IS NOT NULL THEN status
        WHEN v_remaining_paid <= 0 THEN 'pending'
        WHEN v_remaining_paid < expected_amount THEN 'partial'
        ELSE 'paid'
      END,
      updated_at = NOW()
    WHERE id = v_payable_id AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payable_on_tx_delete ON public.financial_transactions;
CREATE TRIGGER trg_sync_payable_on_tx_delete
  AFTER UPDATE ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payable_on_tx_soft_delete();

CREATE OR REPLACE FUNCTION public.sync_tx_on_payable_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.financial_transactions
    SET deleted_at = NOW()
    WHERE payable_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tx_on_payable_delete ON public.expense_payables;
CREATE TRIGGER trg_sync_tx_on_payable_delete
  AFTER UPDATE ON public.expense_payables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tx_on_payable_soft_delete();

-- Permissões explícitas para os roles do Supabase (PostgREST + RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_payables TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_payments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ensure_recurring_payables(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_recurring_payables(UUID, DATE) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pay_expense_payable(UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_expense_payable(UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. GERAR COMPETÊNCIAS INICIAIS PARA OS GASTOS FIXOS JÁ EXISTENTES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT tenant_id FROM public.recurring_expenses WHERE deleted_at IS NULL AND active IS TRUE LOOP
    PERFORM public.ensure_recurring_payables(r.tenant_id, (CURRENT_DATE + INTERVAL '45 days')::DATE);
  END LOOP;
END;
$$;

-- Notificar PostgREST para recarregar o cache de schema imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
