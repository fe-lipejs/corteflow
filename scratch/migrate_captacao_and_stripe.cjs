const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.paefckmkawocjxzuoclq:El4ever7%23uv3@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to database...');

  // 1. Create cliente_captacao table
  console.log('Creating cliente_captacao table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS cliente_captacao (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_name TEXT NOT NULL,
      contact_name TEXT,
      business_type TEXT NOT NULL DEFAULT 'barbearia',
      whatsapp TEXT,
      instagram TEXT,
      channel TEXT NOT NULL DEFAULT 'Instagram',
      score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'novo',
      estimated_value NUMERIC NOT NULL DEFAULT 0,
      demo_url TEXT,
      next_follow_up DATE,
      notes TEXT,
      objection_faced TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_cliente_captacao_stage ON cliente_captacao (stage);
    CREATE INDEX IF NOT EXISTS idx_cliente_captacao_business_type ON cliente_captacao (business_type);
    CREATE INDEX IF NOT EXISTS idx_cliente_captacao_created_at ON cliente_captacao (created_at DESC);

    ALTER TABLE cliente_captacao ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Super admin manage cliente_captacao" ON cliente_captacao;
    CREATE POLICY "Super admin manage cliente_captacao"
    ON cliente_captacao
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
      )
    );
  `);

  // 2. Create platform_settings table
  console.log('Creating platform_settings table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      stripe_mode TEXT NOT NULL DEFAULT 'test',
      stripe_test_public_key TEXT,
      stripe_test_secret_key TEXT,
      stripe_live_public_key TEXT,
      stripe_live_secret_key TEXT,
      stripe_application_fee_percent NUMERIC NOT NULL DEFAULT 2,
      stripe_test_account_id TEXT,
      stripe_live_account_id TEXT,
      stripe_notes TEXT,
      whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
      email_enabled BOOLEAN NOT NULL DEFAULT true,
      sms_enabled BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Super admin manage platform_settings" ON platform_settings;
    CREATE POLICY "Super admin manage platform_settings"
    ON platform_settings
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
      )
    );

    -- Insert singleton record if not exists
    INSERT INTO platform_settings (
      id,
      stripe_mode,
      stripe_test_public_key,
      stripe_test_secret_key,
      stripe_application_fee_percent,
      whatsapp_enabled,
      email_enabled
    )
    VALUES (
      'singleton',
      'test',
      'pk_test_51TNwwH8dE283e6ko4eIDPHyMd4g91yvvMjUMWjaGPiTg2C0qXniTeJwyxwp0AgZu3hHZbzSr1Wc96jux6zDPyGZb00O0cgSGor',
      '',
      2,
      true,
      true
    )
    ON CONFLICT (id) DO NOTHING;

    -- RPC for public/tenants to safely know the Stripe mode and publishable key without leaking secrets
    CREATE OR REPLACE FUNCTION get_platform_public_config()
    RETURNS JSONB AS $$
    DECLARE
      v_settings platform_settings%ROWTYPE;
    BEGIN
      SELECT * INTO v_settings FROM platform_settings WHERE id = 'singleton' LIMIT 1;
      
      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'stripe_mode', 'test',
          'stripe_public_key', '',
          'application_fee_percent', 2,
          'whatsapp_enabled', true,
          'email_enabled', true
        );
      END IF;

      RETURN jsonb_build_object(
        'stripe_mode', COALESCE(v_settings.stripe_mode, 'test'),
        'stripe_public_key', CASE 
          WHEN v_settings.stripe_mode = 'live' THEN COALESCE(v_settings.stripe_live_public_key, '')
          ELSE COALESCE(v_settings.stripe_test_public_key, '')
        END,
        'application_fee_percent', COALESCE(v_settings.stripe_application_fee_percent, 2),
        'whatsapp_enabled', COALESCE(v_settings.whatsapp_enabled, true),
        'email_enabled', COALESCE(v_settings.email_enabled, true)
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    GRANT EXECUTE ON FUNCTION get_platform_public_config() TO anon, authenticated;
  `);

  console.log('Migration completed successfully!');
  await client.end();
}

run().catch(err => {
  console.error('Error running migration:', err);
  process.exit(1);
});
