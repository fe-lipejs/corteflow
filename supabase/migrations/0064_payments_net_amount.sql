-- Migration: 0064_payments_net_amount.sql
-- Description: Adds net_amount and platform_fee to the payments table for accurate DRE.

ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC;

-- Set existing net_amounts to amount (fallback) if they are null
UPDATE payments 
SET net_amount = amount 
WHERE net_amount IS NULL;
