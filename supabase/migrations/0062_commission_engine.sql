-- Migration: 0062_commission_engine.sql
-- Description: Adds a Postgres Trigger to automatically generate commission expenses when a booking is completed.

-- 1. Create the function that will handle the trigger
CREATE OR REPLACE FUNCTION generate_booking_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_prof_commission NUMERIC;
  v_final_pct NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  -- Only act when a booking is marked as 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
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
      -- Calculate commission (Assuming v_final_pct is a percentage e.g., 50 for 50%)
      v_commission_amount := (NEW.amount_total * v_final_pct) / 100;

      -- Create a pending expense in financial_transactions
      -- It uses 'pending' status so the owner can 'approve' it later (meaning it was paid to the professional)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to the bookings table
DROP TRIGGER IF EXISTS trg_generate_booking_commission ON bookings;
CREATE TRIGGER trg_generate_booking_commission
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION generate_booking_commission();
