-- Migration: 0006_customers_metrics.sql
-- Description: Adds CRM metrics to customers and a trigger to automatically sync them with bookings.

-- 1. Add new columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_visit TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS past_services TEXT[],
ADD COLUMN IF NOT EXISTS favorite_professionals TEXT[];

-- Ensure segment enum can handle 'inativo' if using text constraint. (If it's just text, no constraint needed, but our app treats it as union type).

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION update_customer_metrics()
RETURNS TRIGGER AS $$
DECLARE
  target_customer_id UUID;
  v_count INTEGER;
  v_spent NUMERIC;
  v_last_visit TIMESTAMPTZ;
  v_segment TEXT;
BEGIN
  -- Determine which customer ID to update (handle INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    target_customer_id := OLD.customer_id;
  ELSE
    target_customer_id := NEW.customer_id;
  END IF;

  -- 1. Recalculate raw aggregates
  SELECT 
    COUNT(*), 
    COALESCE(SUM(amount_total), 0),
    MAX(scheduled_at)
  INTO 
    v_count, 
    v_spent, 
    v_last_visit
  FROM bookings 
  WHERE customer_id = target_customer_id AND status NOT IN ('canceled', 'no_show') AND scheduled_at <= NOW();

  -- 2. Determine Segment
  IF v_count = 0 THEN
    v_segment := NULL;
  ELSIF v_last_visit < (NOW() - INTERVAL '60 days') THEN
    v_segment := 'inativo';
  ELSIF v_spent >= 500 THEN
    v_segment := 'vip';
  ELSIF v_count >= 3 THEN
    v_segment := 'fiel';
  ELSE
    v_segment := 'novo';
  END IF;

  -- 3. Update the customer record
  UPDATE customers
  SET 
    visit_count = v_count,
    total_spent = v_spent,
    last_visit = v_last_visit,
    first_visit = (
      SELECT MIN(scheduled_at) FROM bookings 
      WHERE customer_id = target_customer_id AND status NOT IN ('canceled', 'no_show')
    ),
    next_visit = (
      SELECT MIN(scheduled_at) FROM bookings 
      WHERE customer_id = target_customer_id AND status NOT IN ('canceled', 'no_show') AND scheduled_at > NOW()
    ),
    past_services = ARRAY(
      SELECT DISTINCT s.name 
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.customer_id = target_customer_id AND b.status NOT IN ('canceled', 'no_show')
    ),
    favorite_professionals = ARRAY(
      SELECT p.name 
      FROM bookings b
      JOIN professionals p ON p.id = b.professional_id
      WHERE b.customer_id = target_customer_id AND b.status NOT IN ('canceled', 'no_show')
      GROUP BY p.id, p.name
      ORDER BY COUNT(*) DESC
      LIMIT 3
    ),
    segment = v_segment
  WHERE id = target_customer_id;

  RETURN NULL; -- AFTER trigger can return NULL
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the Trigger to the bookings table
DROP TRIGGER IF EXISTS trigger_update_customer_metrics ON bookings;
CREATE TRIGGER trigger_update_customer_metrics
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_customer_metrics();
