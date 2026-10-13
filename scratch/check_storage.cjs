const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();
  const res = await client.query('SELECT id, name, public FROM storage.buckets;');
  console.log('Storage buckets:');
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
