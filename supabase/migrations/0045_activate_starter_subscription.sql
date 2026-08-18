-- Migration 0045: Add unique constraint on tenant_id for subscriptions and activate Starter

DO $$
BEGIN
    -- Delete duplicate older subscriptions for the tenant if any
    DELETE FROM subscriptions
    WHERE tenant_id = '1b09bb52-3750-43bf-9c84-ecf53d53f926';
    
    -- Insert clean active subscription
    INSERT INTO subscriptions (
        tenant_id,
        plan_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        current_period_end,
        latest_invoice_status,
        created_at,
        updated_at
    ) VALUES (
        '1b09bb52-3750-43bf-9c84-ecf53d53f926',
        'd7965427-f263-4563-bbd2-c0fac5335b37',
        'sub_1U5aLN8dE283e6kochAMLw6a',
        'cus_V5ltAXDg2kqDSL',
        'active',
        NOW() + INTERVAL '30 days',
        'paid',
        NOW(),
        NOW()
    );

    -- Ensure unique constraint on tenant_id exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenant_id_key'
    ) THEN
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);
    END IF;

    -- Update tenant status
    UPDATE tenants
    SET status = 'active'
    WHERE id = '1b09bb52-3750-43bf-9c84-ecf53d53f926';
END $$;
