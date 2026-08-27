import { Client } from 'pg';
import fs from 'fs';

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL
  });
  await client.connect();
  const res = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;');
  console.log('Remote migrations:', res.rows.map(r => r.version));
  await client.end();
}

main().catch(console.error);
