-- ============================================================
-- Migration 0087: Fix Public Slots and Conflict Check
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_booking_slots(p_tenant_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
RETURNS TABLE (
  id uuid,
  professional_id uuid,
  service_id uuid,
  scheduled_at timestamp with time zone,
  status text,
  created_at timestamp with time zone
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.professional_id, b.service_id, b.scheduled_at, b.status, b.created_at
  FROM bookings b
  WHERE b.tenant_id = p_tenant_id
    AND b.status IN ('pending', 'confirmed', 'arrived', 'in_progress', 'completed')
    AND b.scheduled_at >= p_start
    AND b.scheduled_at <= p_end;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_booking_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_overlapping_count INTEGER;
  v_duration INTEGER;
  v_buffer INTEGER;
  v_new_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- We only care about statuses that occupy time
  IF NEW.status NOT IN ('pending', 'confirmed', 'arrived', 'in_progress', 'completed') THEN
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
    AND b.status IN ('pending', 'confirmed', 'arrived', 'in_progress', 'completed')
    AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.scheduled_at < v_new_end
    AND (b.scheduled_at + ((COALESCE(s.duration_minutes, 30) + COALESCE(s.buffer_minutes, 0)) || ' minutes')::INTERVAL) > NEW.scheduled_at;

  IF v_overlapping_count > 0 THEN
    RAISE EXCEPTION 'O horário selecionado já está ocupado para este profissional.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
