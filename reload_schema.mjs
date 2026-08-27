import pg from 'pg';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
// supabaseUrl: https://fdbzuzpzxjzvzjz.supabase.co
// postgresql://postgres.fdbzuzpzxjzvzjz:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

if (!supabaseUrl || !dbPassword) {
  console.log("Missing env vars");
  process.exit(1);
}

const projectId = supabaseUrl.replace('https://', '').split('.')[0];
const connectionString = `postgresql://postgres.${projectId}:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

const pool = new pg.Pool({ connectionString });

async function run() {
  try {
    const res = await pool.query(`NOTIFY pgrst, 'reload schema'`);
    console.log("Reloaded schema:", res.rows);
    
    // Also delete expired plan
    const res2 = await pool.query(`UPDATE plans SET name = 'Trial', is_trial_plan = true, active = true WHERE name ILIKE '%expirado%' RETURNING *`);
    console.log("Updated plans:", res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
