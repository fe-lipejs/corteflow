-- Fix reschedule_booking RPC:
-- 1. Add max_reschedules column to tenant_settings if it doesn't exist
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS max_reschedules INTEGER DEFAULT NULL;

-- 2. Add reschedule_count column to bookings if it doesn't exist
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;

-- 3. Replace the RPC with a NULL-safe version
CREATE OR REPLACE FUNCTION reschedule_booking(
  p_booking_id UUID,
  p_new_time TIMESTAMPTZ,
  p_new_pro_id UUID,
  p_actor_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_settings tenant_settings%ROWTYPE;
  v_hours_until NUMERIC;
  v_max_reschedules INTEGER;
  v_action TEXT := 'rescheduled';
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status IN ('canceled', 'completed', 'no_show', 'in_progress', 'arrived') THEN
    RAISE EXCEPTION 'Booking cannot be rescheduled in its current status';
  END IF;

  IF p_actor_type = 'client' THEN
    SELECT * INTO v_settings FROM tenant_settings WHERE tenant_id = v_booking.tenant_id;

    -- allow_reschedule must be explicitly TRUE (NULL = allow by default)
    IF v_settings.allow_reschedule = FALSE THEN
      RAISE EXCEPTION 'Rescheduling is disabled by the salon';
    END IF;

    -- max_reschedules: NULL means unlimited
    v_max_reschedules := COALESCE(v_settings.max_reschedules, NULL);
    IF v_max_reschedules IS NOT NULL AND v_booking.reschedule_count >= v_max_reschedules THEN
      RAISE EXCEPTION 'Maximum number of reschedules reached';
    END IF;

    -- Deadline check: NULL means no deadline enforced
    IF v_settings.reschedule_deadline_hours IS NOT NULL THEN
      v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_at::TIMESTAMPTZ - NOW())) / 3600;
      IF v_hours_until < v_settings.reschedule_deadline_hours THEN
        RAISE EXCEPTION 'Rescheduling deadline expired';
      END IF;
    END IF;
  END IF;

  -- Determine history action label
  IF v_booking.scheduled_at != p_new_time AND v_booking.professional_id IS NOT DISTINCT FROM p_new_pro_id THEN
    v_action := 'time_changed';
  ELSIF v_booking.scheduled_at = p_new_time AND v_booking.professional_id IS DISTINCT FROM p_new_pro_id THEN
    v_action := 'pro_changed';
  END IF;

  UPDATE bookings
  SET
    scheduled_at = p_new_time,
    professional_id = p_new_pro_id,
    reschedule_count = COALESCE(reschedule_count, 0) + 1
  WHERE id = p_booking_id;

  INSERT INTO booking_history (tenant_id, booking_id, action, details, actor_type)
  VALUES (
    v_booking.tenant_id,
    p_booking_id,
    v_action,
    jsonb_build_object(
      'old_time', v_booking.scheduled_at,
      'new_time', p_new_time,
      'old_pro', v_booking.professional_id,
      'new_pro', p_new_pro_id
    ),
    p_actor_type
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
