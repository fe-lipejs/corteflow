-- ============================================================================
-- Migration: Antecedência Máxima de Agendamento (Max Booking Horizon)
-- ============================================================================
-- Regra de negócio global:
--   - tenant_settings.max_advance_days controla até quando NOVAS reservas e
--     REAGENDAMENTOS (mudança de data) podem ser realizados (público e manual).
--   - Contagem inclui hoje ("contando com hoje"):
--       max_advance_days = 7   -> hoje até hoje + 6 dias (7 dias corridos)
--       max_advance_days = 30  -> hoje até hoje + 29 dias (padrão)
--       max_advance_days = NULL -> Sem limite de antecedência
--   - Agendamentos futuros já existentes fora de um novo limite reduzido
--     NUNCA são cancelados, escondidos ou bloqueados para atualização de
--     status, pagamento, observações, profissional ou serviço na mesma data.
-- ============================================================================

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS max_advance_days INTEGER DEFAULT 30;

UPDATE public.tenant_settings
SET max_advance_days = 30
WHERE max_advance_days IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_settings_max_advance_days_check'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_settings_max_advance_days_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_max_advance_days_check
      CHECK (max_advance_days IS NULL OR max_advance_days >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.tenant_settings.max_advance_days IS
  'Antecedência máxima de agendamento em dias contando com hoje (NULL = Sem limite, inteiro >= 1 = limite em dias).';

CREATE OR REPLACE FUNCTION public.enforce_booking_advance_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_advance_days INTEGER;
  v_settings_found BOOLEAN := FALSE;
  v_today DATE;
  v_target_date DATE;
  v_old_date DATE;
  v_max_date DATE;
BEGIN
  -- Cancelamentos, faltas e conclusões nunca devem ser bloqueados pela janela de antecedência
  IF NEW.status IN ('canceled', 'no_show', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, se a data do agendamento (no fuso do estabelecimento) não mudou,
  -- preserva integralmente reservas futuras já existentes mesmo após redução do limite.
  IF TG_OP = 'UPDATE' THEN
    v_old_date := (OLD.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::DATE;
    v_target_date := (NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::DATE;
    IF v_target_date = v_old_date THEN
      RETURN NEW;
    END IF;
  ELSE
    v_target_date := (NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::DATE;
  END IF;

  -- Busca configuração isolada por tenant_id
  SELECT ts.max_advance_days, TRUE
    INTO v_max_advance_days, v_settings_found
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = NEW.tenant_id
  LIMIT 1;

  -- Se o estabelecimento ainda não possui linha em tenant_settings, aplica padrão de 30 dias
  IF NOT COALESCE(v_settings_found, FALSE) THEN
    v_max_advance_days := 30;
  END IF;

  -- NULL significa "Sem limite": remove apenas a restrição de antecedência
  IF v_max_advance_days IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contando com hoje: N dias = hoje (dia 1) até hoje + (N - 1)
  v_today := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_max_date := v_today + (v_max_advance_days - 1);

  IF v_target_date > v_max_date THEN
    RAISE EXCEPTION 'Data fora da antecedência máxima permitida (% %, disponível até %).',
      v_max_advance_days,
      CASE WHEN v_max_advance_days = 1 THEN 'dia' ELSE 'dias' END,
      to_char(v_max_date, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_advance_limit ON public.bookings;

CREATE TRIGGER trg_enforce_booking_advance_limit
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_advance_limit();
