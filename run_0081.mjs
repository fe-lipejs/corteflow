import { Client } from 'pg';
import fs from 'fs';

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL
  });
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/0081_new_limits_permissions.sql', 'utf8');
  await client.query(sql);
  console.log('Migration 0081 executada com sucesso!');
  await client.end();
}

main().catch(console.error);
