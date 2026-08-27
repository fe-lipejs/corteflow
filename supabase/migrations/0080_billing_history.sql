-- Migration 0080: Histórico Comercial e LGPD

-- 1. Create commercial_history table
CREATE TABLE IF NOT EXISTS commercial_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_tenant_id UUID, -- Not a foreign key because tenant can be deleted
    normalized_email TEXT NOT NULL,
    first_signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_known_status TEXT DEFAULT 'trial',
    stripe_customer_id TEXT,
    total_subscriptions INT DEFAULT 0,
    total_cancellations INT DEFAULT 0,
    total_account_deletions INT DEFAULT 0,
    total_trials_used INT DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicate histories for the same email
CREATE UNIQUE INDEX IF NOT EXISTS commercial_history_email_idx ON commercial_history(normalized_email);

-- 2. Create billing_events table for timeline
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID REFERENCES commercial_history(id) ON DELETE CASCADE,
    tenant_id UUID,
    event_type TEXT, -- Application events like 'checkout_initiated'
    type TEXT,       -- Stripe event types like 'invoice.payment_succeeded'
    stripe_event_id TEXT, -- Used for stripe webhook idempotency
    details jsonb DEFAULT '{}'::jsonb,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicate webhook events
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_stripe_event_idx ON billing_events(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

-- 3. RLS for commercial_history
ALTER TABLE commercial_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin can view history" ON commercial_history;
CREATE POLICY "Super Admin can view history" ON commercial_history
    FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Super Admin can view events" ON billing_events;
CREATE POLICY "Super Admin can view events" ON billing_events
    FOR SELECT USING (is_super_admin());

-- 4. Re-write the delete_tenant_safely function to perform HARD DELETE + Archive
CREATE OR REPLACE FUNCTION delete_tenant_safely(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    v_sub_status TEXT;
    v_owner_email TEXT;
    v_history_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Empresa não encontrada.';
    END IF;

    -- Fetch the Stripe subscription status
    SELECT status INTO v_sub_status
    FROM subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;

    IF v_sub_status IN ('active', 'past_due', 'unpaid') THEN
        RAISE EXCEPTION 'Não é possível apagar esta empresa pois ela possui uma assinatura ativa (%). Cancele a assinatura primeiro.', v_sub_status;
    END IF;

    -- Fetch owner's email from auth.users via profiles owner_user_id
    SELECT email INTO v_owner_email
    FROM auth.users
    WHERE id = (SELECT owner_user_id FROM tenants WHERE id = p_tenant_id);

    -- Find history_id
    SELECT id INTO v_history_id FROM commercial_history WHERE normalized_email = v_owner_email;

    -- Update history counts
    IF v_history_id IS NOT NULL THEN
        UPDATE commercial_history 
        SET total_account_deletions = total_account_deletions + 1,
            last_activity_at = now(),
            last_known_status = 'deleted_account'
        WHERE id = v_history_id;

        -- Log Event
        INSERT INTO billing_events (history_id, event_type, details)
        VALUES (v_history_id, 'account_deleted', json_build_object('tenant_id', p_tenant_id));
    END IF;

    -- HARD DELETE: This will cascade to all bookings, services, professionals, customers (LGPD Compliance)
    DELETE FROM tenants WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to automatically log commercial history on new tenant creation
CREATE OR REPLACE FUNCTION log_commercial_history_on_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_email TEXT;
    v_history_id UUID;
BEGIN
    -- Fetch owner's email
    SELECT email INTO v_owner_email
    FROM auth.users
    WHERE id = NEW.owner_user_id;

    IF v_owner_email IS NOT NULL THEN
        -- Insert or get existing history
        INSERT INTO commercial_history (original_tenant_id, normalized_email, last_known_status)
        VALUES (NEW.id, v_owner_email, NEW.status)
        ON CONFLICT (normalized_email) 
        DO UPDATE SET last_activity_at = now(), last_known_status = EXCLUDED.last_known_status
        RETURNING id INTO v_history_id;

        -- Log event
        INSERT INTO billing_events (history_id, event_type, details)
        VALUES (v_history_id, 'account_created', json_build_object('tenant_id', NEW.id, 'status', NEW.status));
        
        -- If it's a trial
        IF NEW.status = 'trial' THEN
            UPDATE commercial_history SET total_trials_used = total_trials_used + 1 WHERE id = v_history_id;
            INSERT INTO billing_events (history_id, event_type, details)
            VALUES (v_history_id, 'trial_started', json_build_object('tenant_id', NEW.id));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tenant_created_log_history ON tenants;
CREATE TRIGGER on_tenant_created_log_history
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION log_commercial_history_on_tenant();
