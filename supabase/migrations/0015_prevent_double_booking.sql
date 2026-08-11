-- Migration: 0015_prevent_double_booking.sql
-- Adiciona bloqueio de backend para agendamentos simultâneos e configurações de política de cancelamento

-- 1. Add cancellation policy fields to tenant_settings
ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS cancel_policy_text TEXT,
ADD COLUMN IF NOT EXISTS cancel_fee_amount NUMERIC DEFAULT 0;

-- 2. Create trigger function to check for booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_overlapping_count INTEGER;
  v_duration INTEGER;
  v_buffer INTEGER;
BEGIN
  -- We only care about statuses that occupy time (we don't block canceled or no_show)
  IF NEW.status NOT IN ('pending', 'confirmed', 'arrived', 'in_progress') THEN
    RETURN NEW;
  END IF;

  -- Fetch duration and buffer from services table
  SELECT duration_minutes, buffer_minutes INTO v_duration, v_buffer
  FROM services WHERE id = NEW.service_id;

  -- The end time is scheduled_at + duration_minutes + buffer_minutes
  v_new_end := NEW.scheduled_at + ((COALESCE(v_duration, 30) + COALESCE(v_buffer, 0)) || ' minutes')::INTERVAL;

  -- Count overlapping bookings for the same professional in the same tenant
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

-- 3. Apply the trigger to bookings table
DROP TRIGGER IF EXISTS trg_check_booking_conflict ON bookings;
CREATE TRIGGER trg_check_booking_conflict
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION check_booking_conflict();
