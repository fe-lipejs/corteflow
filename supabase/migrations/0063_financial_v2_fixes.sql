-- Migration: 0063_financial_v2_fixes.sql
-- Description: Fixes commission idempotency, handles refund reversals, and adds soft deletes.

-- 1. ADD SOFT DELETE COLUMN
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Revoke DELETE permission from public/authenticated users if we want strict accounting
-- Or we enforce soft deletes in the UI. For now we just add the column and RLS will allow delete, 
-- but our UI will update deleted_at instead.

-- 2. FIX COMMISSION ENGINE (Idempotency and Cancellations)
CREATE OR REPLACE FUNCTION generate_booking_commission()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
