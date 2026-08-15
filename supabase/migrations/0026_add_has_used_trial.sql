-- Migration: 0026_add_has_used_trial.sql
-- Add has_used_trial column to tenants to guarantee single-use free trial per salon

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing tenants that already have a subscription created as having used trial
UPDATE tenants 
SET has_used_trial = TRUE
WHERE id IN (
  SELECT DISTINCT tenant_id 
  FROM subscriptions 
  WHERE tenant_id IS NOT NULL
);
