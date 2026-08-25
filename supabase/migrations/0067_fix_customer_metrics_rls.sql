-- =================================================================================
-- Migration 0067: Fix Customer Metrics RLS Error
-- 
-- Adds SECURITY DEFINER to trigger functions that update related tables
-- to prevent RLS violations when an anonymous user makes a booking.
-- =================================================================================

-- 1. Fix update_customer_metrics to run with elevated privileges
-- Without SECURITY DEFINER, the UPDATE on customers fails for anon users
-- because they don't have UPDATE permissions on the customers table.
CREATE OR REPLACE FUNCTION update_customer_metrics()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
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

-- 2. Also ensure commission engine has SECURITY DEFINER (to prevent similar issues if triggered differently)
CREATE OR REPLACE FUNCTION generate_booking_commission()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_prof_commission NUMERIC;
  v_final_pct NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  -- CASE A: Booking was CANCELED, REFUNDED or NO_SHOW
  IF NEW.status IN ('canceled', 'refunded', 'no_show') AND (OLD.status IS NULL OR OLD.status NOT IN ('canceled', 'refunded', 'no_show')) THEN
    -- Reject any pending/approved commissions for this booking
    UPDATE financial_transactions 
    SET status = 'rejected', 
        description = 'Comissão cancelada (Serviço estornado/cancelado)'
    WHERE booking_id = NEW.id AND category = 'Comissão';
    
    RETURN NEW;
  END IF;

  -- CASE B: Booking is COMPLETED
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Idempotency check: Does a commission already exist for this booking?
    IF EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE booking_id = NEW.id AND category = 'Comissão'
    ) THEN
      RETURN NEW; -- Skip generation, commission already exists
    END IF;

    -- Check if professional has a commission set
    SELECT commission_value INTO v_prof_commission 
    FROM professionals 
    WHERE id = NEW.professional_id;

    -- Check if service has a specific commission
    SELECT commission_pct INTO v_commission_pct 
    FROM services 
    WHERE id = NEW.service_id;

    -- Service commission takes precedence over professional default
    v_final_pct := COALESCE(NULLIF(v_commission_pct, 0), v_prof_commission, 0);

    IF v_final_pct > 0 THEN
      -- Calculate commission based on final percentage
      v_commission_amount := (NEW.amount_total * v_final_pct) / 100;

      -- Create pending expense
      INSERT INTO financial_transactions (
        tenant_id,
        booking_id,
        professional_id,
        type,
        amount,
        description,
        category,
        status,
        created_at
      ) VALUES (
        NEW.tenant_id,
        NEW.id,
        NEW.professional_id,
        'expense',
        v_commission_amount,
        'Comissão Automática',
        'Comissão',
        'pending',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
