-- Migration: 0066_stripe_fee.sql
-- Description: Adds stripe_fee to the payments table for tracking adquirente costs.

ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC DEFAULT 0;
