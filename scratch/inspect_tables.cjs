const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.paefckmkawocjxzuoclq:El4ever7%23uv3@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Total tables in public schema:', res.rows.length);
  console.log('Tables:', res.rows.map(r => r.table_name));
  await client.end();
}

run().catch(console.error);
