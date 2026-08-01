-- Migration: 0008_financials.sql

-- 1. Updates to tenant_settings
ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS accept_online_payment BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accept_local_payment BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deposit_type TEXT DEFAULT 'percentage' CHECK (deposit_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS deposit_value NUMERIC DEFAULT 50, -- 50% or 50 currency units
ADD COLUMN IF NOT EXISTS cancel_policy_24h TEXT DEFAULT 'full_refund' CHECK (cancel_policy_24h IN ('full_refund', 'partial_refund', 'credit', 'no_refund')),
ADD COLUMN IF NOT EXISTS cancel_policy_2h TEXT DEFAULT 'partial_refund' CHECK (cancel_policy_2h IN ('full_refund', 'partial_refund', 'credit', 'no_refund')),
ADD COLUMN IF NOT EXISTS partial_refund_percentage NUMERIC DEFAULT 50;

-- 2. Updates to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial_paid', 'paid', 'refunded', 'credit_generated', 'failed', 'canceled'));

-- 3. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for payments" ON payments
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Public read for own payments" ON payments
  FOR SELECT
  USING (booking_id IN (SELECT id FROM bookings));

-- 4. Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for payment_history" ON payment_history
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Public read for own payment_history" ON payment_history
  FOR SELECT
  USING (payment_id IN (SELECT id FROM payments));

-- 5. Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  stripe_refund_id TEXT,
  amount NUMERIC NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for refunds" ON refunds
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Public read for own refunds" ON refunds
  FOR SELECT
  USING (payment_id IN (SELECT id FROM payments));

-- 6. Create customer_credits table
CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, customer_id)
);

ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for customer_credits" ON customer_credits
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Public read for own credits" ON customer_credits
  FOR SELECT
  USING (customer_id IN (SELECT id FROM customers));

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_credits_updated_at ON customer_credits;
CREATE TRIGGER update_customer_credits_updated_at BEFORE UPDATE ON customer_credits FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
