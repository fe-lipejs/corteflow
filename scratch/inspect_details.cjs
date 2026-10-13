const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- TENANT USERS ---');
  const tu = await client.query('SELECT * FROM tenant_users;');
  console.table(tu.rows);

  console.log('--- SUBSCRIPTIONS ---');
  const subs = await client.query('SELECT * FROM subscriptions;');
  console.table(subs.rows);

  console.log('--- TENANTS ---');
  const ten = await client.query('SELECT * FROM tenants;');
  console.table(ten.rows);

  console.log('--- PROFILES ---');
  const prof = await client.query('SELECT * FROM profiles;');
  console.table(prof.rows);

  await client.end();
}

main().catch(console.error);
