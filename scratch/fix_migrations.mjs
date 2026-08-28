import pg from 'pg';

const { Client } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("No SUPABASE_DB_URL found in .env");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log("Connected to database.");

    // Migration 0072
    console.log("Running migration 0072...");
    await client.query(`
      ALTER TABLE tenant_settings
        DROP COLUMN IF EXISTS offers_home_service,
        DROP COLUMN IF EXISTS home_service_radius_km,
        DROP COLUMN IF EXISTS home_fee_type,
        DROP COLUMN IF EXISTS home_fee_amount,
        DROP COLUMN IF EXISTS home_fee_per_km;

      ALTER TABLE professionals
        ADD COLUMN IF NOT EXISTS offers_home_service BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS max_home_distance_km NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS home_fee NUMERIC DEFAULT 0;
    `);

    // Migration 0073
    console.log("Running migration 0073...");
    await client.query(`
      ALTER TABLE professionals
        ADD COLUMN IF NOT EXISTS home_fee_type TEXT DEFAULT 'fixed',
        ADD COLUMN IF NOT EXISTS home_fee_per_km NUMERIC DEFAULT 0;
    `);

    // Add CHECK constraint safely if it doesn't exist
    console.log("Adding constraints...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'professionals_home_fee_type_check') THEN
          ALTER TABLE professionals ADD CONSTRAINT professionals_home_fee_type_check CHECK (home_fee_type IN ('fixed', 'per_km'));
        END IF;
      END
      $$;
    `);

    // Comments
    await client.query(`
      COMMENT ON COLUMN professionals.home_fee_type IS
        'fixed = taxa fixa (usa home_fee), per_km = taxa por km (usa home_fee_per_km)';
      COMMENT ON COLUMN professionals.home_fee_per_km IS
        'Valor cobrado por quilometro (caso home_fee_type seja per_km)';
    `);

    // Reload PostgREST schema cache
    console.log("Reloading schema cache...");
    await client.query(`NOTIFY pgrst, 'reload schema';`);

    console.log("SUCCESS! All columns created and schema reloaded.");
  } catch (err) {
    console.error("Error running migrations:", err);
  } finally {
    await client.end();
  }
}

main();
