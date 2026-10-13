const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- SUBSCRIPTION CONTRACTS ---');
  const sc = await client.query('SELECT * FROM subscription_contracts;');
  console.log(sc.rows);

  console.log('--- SUBSCRIPTIONS ---');
  const sub = await client.query('SELECT * FROM subscriptions;');
  console.log(sub.rows);

  console.log('--- COMMERCIAL HISTORY ---');
  const ch = await client.query('SELECT * FROM commercial_history;');
  console.log(ch.rows);

  await client.end();
}

main().catch(console.error);
