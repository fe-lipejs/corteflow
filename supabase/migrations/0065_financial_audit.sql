-- Migration: 0065_financial_audit.sql
-- Description: Adds created_by and updated_by to track who generated or modified financial transactions.

ALTER TABLE financial_transactions 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create trigger to automatically set updated_at and updated_by
CREATE OR REPLACE FUNCTION update_financial_audit_info()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_financial_audit ON financial_transactions;
CREATE TRIGGER trg_financial_audit
  BEFORE UPDATE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_audit_info();

-- Automatically inject created_by on INSERT if missing
CREATE OR REPLACE FUNCTION insert_financial_audit_info()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_financial_audit_insert ON financial_transactions;
CREATE TRIGGER trg_financial_audit_insert
  BEFORE INSERT ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION insert_financial_audit_info();

-- Fix the commission engine to carry over auth.uid() if running in the context of a booking completion
-- Actually, the insert trigger above handles it automatically because auth.uid() will be the user completing the booking!
