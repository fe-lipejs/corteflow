-- Migration: 0007_booking_policies_and_history.sql

-- 1. Add policies to tenant_settings
ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS allow_reschedule BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reschedule_deadline_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS max_reschedules INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS allow_cancel BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cancel_deadline_hours INTEGER DEFAULT 24;

-- 2. Add reschedule_count to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;

-- 3. Create booking_history table
CREATE TABLE IF NOT EXISTS booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'rescheduled', 'time_changed', 'pro_changed', 'canceled'
  reason TEXT,
  details JSONB,
  actor_type TEXT NOT NULL, -- 'client', 'admin', 'system'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for booking_history" ON booking_history
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Public read for own booking_history" ON booking_history
  FOR SELECT
  USING (
    booking_id IN (SELECT id FROM bookings)
  );

-- 4. RPC for Canceling
CREATE OR REPLACE FUNCTION cancel_booking(
  p_booking_id UUID,
  p_reason TEXT,
  p_actor_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_settings tenant_settings%ROWTYPE;
  v_hours_until NUMERIC;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status IN ('canceled', 'completed', 'no_show', 'in_progress', 'arrived') THEN
    RAISE EXCEPTION 'Booking cannot be canceled in its current status';
  END IF;

  IF p_actor_type = 'client' THEN
    SELECT * INTO v_settings FROM tenant_settings WHERE tenant_id = v_booking.tenant_id;
    IF NOT v_settings.allow_cancel THEN
      RAISE EXCEPTION 'Cancellation is disabled by the salon';
    END IF;

    v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_at::TIMESTAMPTZ - NOW())) / 3600;
    IF v_hours_until < v_settings.cancel_deadline_hours THEN
      RAISE EXCEPTION 'Cancellation deadline expired';
    END IF;
  END IF;

  UPDATE bookings SET status = 'canceled' WHERE id = p_booking_id;

  INSERT INTO booking_history (tenant_id, booking_id, action, reason, actor_type)
  VALUES (v_booking.tenant_id, p_booking_id, 'canceled', p_reason, p_actor_type);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC for Rescheduling
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
    IF NOT v_settings.allow_reschedule THEN
      RAISE EXCEPTION 'Rescheduling is disabled by the salon';
    END IF;

    IF v_settings.max_reschedules != 999 AND v_booking.reschedule_count >= v_settings.max_reschedules THEN
      RAISE EXCEPTION 'Maximum number of reschedules reached';
    END IF;

    v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_at::TIMESTAMPTZ - NOW())) / 3600;
    IF v_hours_until < v_settings.reschedule_deadline_hours THEN
      RAISE EXCEPTION 'Rescheduling deadline expired';
    END IF;
  END IF;

  IF v_booking.scheduled_at != p_new_time AND v_booking.professional_id = p_new_pro_id THEN
    v_action := 'time_changed';
  ELSIF v_booking.scheduled_at = p_new_time AND v_booking.professional_id != p_new_pro_id THEN
    v_action := 'pro_changed';
  END IF;

  UPDATE bookings 
  SET 
    scheduled_at = p_new_time,
    professional_id = p_new_pro_id,
    reschedule_count = reschedule_count + 1
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
