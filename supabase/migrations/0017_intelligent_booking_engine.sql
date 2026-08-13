-- Migration: 0017_intelligent_booking_engine.sql
-- Adiciona configurações de políticas comerciais e melhora a segurança contra double-booking

-- 1. Políticas de Cancelamento e Formas de Pagamento no Salão
ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{"partial_50": true, "full_100": false, "pay_local": true}'::jsonb,
ADD COLUMN IF NOT EXISTS cancel_free_hours_before INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS cancel_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS noshow_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delay_tolerance_minutes INT DEFAULT 15;

-- 2. Colunas Financeiras e de Status Avançado no Agendamento
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial_paid', 'full_paid', 'refunded', 'failed')),
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'pay_local' CHECK (payment_mode IN ('pay_local', 'partial_50', 'full_100')),
ADD COLUMN IF NOT EXISTS amount_due NUMERIC DEFAULT 0;

-- Atualizar amount_due para agendamentos antigos para bater com amount_total
UPDATE bookings SET amount_due = amount_total WHERE amount_due = 0 AND amount_total IS NOT NULL;

-- 3. Melhorar Gatilho Anti-Double Booking (Trava de concorrência - Row Lock)
CREATE OR REPLACE FUNCTION check_booking_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_overlapping_count INTEGER;
  v_duration INTEGER;
  v_buffer INTEGER;
  v_new_end TIMESTAMPTZ;
  v_pro_lock UUID;
BEGIN
  -- Só nos importamos com status que ocupam espaço na agenda
  IF NEW.status NOT IN ('pending', 'confirmed', 'arrived', 'in_progress') THEN
    RETURN NEW;
  END IF;

  -- FOR UPDATE LOCK no profissional para serializar requisições simultâneas reais no banco de dados!
  -- Isso impede que dois inserts passem pelo trigger ao mesmo tempo, resolvendo a condição de corrida perfeitamente.
  SELECT id INTO v_pro_lock FROM professionals WHERE id = NEW.professional_id FOR UPDATE;

  -- Obter duration e buffer
  SELECT duration_minutes, buffer_minutes INTO v_duration, v_buffer
  FROM services WHERE id = NEW.service_id;

  -- Calcular o término do atendimento
  v_new_end := NEW.scheduled_at + ((COALESCE(v_duration, 30) + COALESCE(v_buffer, 0)) || ' minutes')::INTERVAL;

  -- Verificar sobreposição
  SELECT COUNT(*) INTO v_overlapping_count
  FROM bookings b
  JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = NEW.tenant_id
    AND b.professional_id = NEW.professional_id
    AND b.status IN ('pending', 'confirmed', 'arrived', 'in_progress')
    AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.scheduled_at < v_new_end
    AND (b.scheduled_at + ((COALESCE(s.duration_minutes, 30) + COALESCE(s.buffer_minutes, 0)) || ' minutes')::INTERVAL) > NEW.scheduled_at;

  IF v_overlapping_count > 0 THEN
    RAISE EXCEPTION 'O horário selecionado já está ocupado para este profissional.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
