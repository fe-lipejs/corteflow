-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL, -- Will reference auth.users later or handled via application logic
    business_type TEXT CHECK (business_type IN ('barbearia', 'salao', 'esmalteria')) NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('trial', 'active', 'suspended', 'blocked', 'canceled')) NOT NULL DEFAULT 'trial',
    language TEXT CHECK (language IN ('pt', 'en', 'es', 'fr', 'de')) NOT NULL DEFAULT 'pt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- References auth.users
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    role TEXT CHECK (role IN ('super_admin', 'owner', 'professional')) NOT NULL DEFAULT 'owner',
    full_name TEXT NOT NULL,
    avatar_url TEXT
);

-- Table: plans
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT CHECK (key IN ('starter', 'growth')) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    max_professionals INT NOT NULL DEFAULT 1,
    allow_products BOOLEAN NOT NULL DEFAULT false,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    trial_days INT NOT NULL DEFAULT 14,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

-- Table: plan_prices
CREATE TABLE plan_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    stripe_price_id TEXT
);

-- Table: custom_pricing
CREATE TABLE custom_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    amount_override NUMERIC NOT NULL,
    note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Table: subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ
);

-- Table: stripe_connect_accounts
CREATE TABLE stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    charges_enabled BOOLEAN NOT NULL DEFAULT false,
    payouts_enabled BOOLEAN NOT NULL DEFAULT false
);

-- Table: professionals
CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role_title TEXT,
    photo_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    working_hours JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Table: services
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    duration_minutes INT NOT NULL,
    buffer_minutes INT NOT NULL DEFAULT 0,
    category TEXT,
    color TEXT,
    active BOOLEAN NOT NULL DEFAULT true
);

-- Table: products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    linked_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

-- Table: customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    birthday DATE,
    segment TEXT CHECK (segment IN ('novo', 'fiel', 'vip')),
    total_spent NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    professional_id UUID REFERENCES professionals(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    order_number TEXT UNIQUE NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled', 'no_show')) NOT NULL DEFAULT 'pending',
    payment_mode TEXT CHECK (payment_mode IN ('local', 'deposit', 'full')) NOT NULL DEFAULT 'local',
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    amount_total NUMERIC NOT NULL,
    notes TEXT,
    access_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: financial_transactions
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: tenant_settings
CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    theme_preset TEXT,
    custom_palette JSONB,
    logo_url TEXT,
    banner_url TEXT,
    short_description TEXT,
    phone TEXT,
    address TEXT,
    instagram TEXT,
    whatsapp_number TEXT,
    booking_payment_mode TEXT CHECK (booking_payment_mode IN ('local', 'deposit', 'full', 'client_choice')) DEFAULT 'local',
    deposit_percentage NUMERIC
);

-- Table: business_hours
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    weekday INT CHECK (weekday BETWEEN 0 AND 6) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    open_time TIME,
    close_time TIME,
    lunch_start TIME,
    lunch_end TIME,
    UNIQUE(tenant_id, weekday)
);

-- Table: blocked_times
CREATE TABLE blocked_times (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT
);

-- Table: notification_settings
CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    sms_enabled BOOLEAN NOT NULL DEFAULT false
);

-- Table: country_pricing_defaults
CREATE TABLE country_pricing_defaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL,
    language_default TEXT NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all relevant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_pricing_defaults ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can see their own profile, or admins can see all
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id OR is_super_admin());
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id OR is_super_admin());
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenants: Owners can see and update their own tenant
CREATE POLICY "Users can view their tenant" ON tenants
    FOR SELECT USING (
        id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin()
    );
CREATE POLICY "Users can update their tenant" ON tenants
    FOR UPDATE USING (
        id = (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')) OR is_super_admin()
    );

-- General RLS pattern for tenant-bound data:
-- USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))

-- custom_pricing
CREATE POLICY "Tenant isolation for custom_pricing" ON custom_pricing
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- subscriptions
CREATE POLICY "Tenant isolation for subscriptions" ON subscriptions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- stripe_connect_accounts
CREATE POLICY "Tenant isolation for stripe_connect_accounts" ON stripe_connect_accounts
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- professionals
CREATE POLICY "Tenant isolation for professionals" ON professionals
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- services
CREATE POLICY "Tenant isolation for services" ON services
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- products
CREATE POLICY "Tenant isolation for products" ON products
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- customers
CREATE POLICY "Tenant isolation for customers" ON customers
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- bookings
CREATE POLICY "Tenant isolation for bookings" ON bookings
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- financial_transactions
CREATE POLICY "Tenant isolation for financial_transactions" ON financial_transactions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- tenant_settings
CREATE POLICY "Tenant isolation for tenant_settings" ON tenant_settings
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- business_hours
CREATE POLICY "Tenant isolation for business_hours" ON business_hours
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- blocked_times
CREATE POLICY "Tenant isolation for blocked_times" ON blocked_times
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- notification_settings
CREATE POLICY "Tenant isolation for notification_settings" ON notification_settings
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR is_super_admin());

-- Global/Public tables (plans, plan_prices, country_pricing_defaults)
-- Super admin can do everything, others can only read.
CREATE POLICY "Public read plans" ON plans FOR SELECT USING (true);
CREATE POLICY "Admin all plans" ON plans FOR ALL USING (is_super_admin());

CREATE POLICY "Public read plan_prices" ON plan_prices FOR SELECT USING (true);
CREATE POLICY "Admin all plan_prices" ON plan_prices FOR ALL USING (is_super_admin());

CREATE POLICY "Public read country_pricing_defaults" ON country_pricing_defaults FOR SELECT USING (true);
CREATE POLICY "Admin all country_pricing_defaults" ON country_pricing_defaults FOR ALL USING (is_super_admin());

-- Add trigger to automatically create profile on signup (example logic for Supabase Auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger binding itself requires permissions on auth.users which is done via Dashboard or special privileges
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
