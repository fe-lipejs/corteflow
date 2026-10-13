const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- ALL AUTH USERS (full detail) ---');
  const users = await client.query('SELECT id, email, phone, role FROM auth.users;');
  console.table(users.rows);

  console.log('--- ALL PROFILES ---');
  const profs = await client.query('SELECT id, tenant_id, role, full_name, email FROM profiles;');
  console.table(profs.rows);

  console.log('--- ALL TENANTS ---');
  const tens = await client.query('SELECT id, owner_user_id, name, slug, status FROM tenants;');
  console.table(tens.rows);

  console.log('--- ALL BILLING EVENTS ---');
  const be = await client.query('SELECT id, tenant_id, event_type, created_at FROM billing_events;');
  console.table(be.rows);

  console.log('--- ALL STRIPE EVENTS ---');
  const se = await client.query('SELECT id, tenant_id, type FROM stripe_events;');
  console.table(se.rows);

  console.log('--- ALL SUPPORT TICKETS ---');
  const st = await client.query('SELECT id, tenant_id, subject FROM support_tickets;');
  console.table(st.rows);

  console.log('--- ALL SUPPORT MESSAGES ---');
  const sm = await client.query('SELECT id, ticket_id, sender_id, message FROM support_messages;');
  console.table(sm.rows);

  console.log('--- ALL NOTIFICATIONS ---');
  const notifCount = await client.query('SELECT tenant_id, count(*) FROM notifications GROUP BY tenant_id;');
  console.table(notifCount.rows);

  await client.end();
}

main().catch(console.error);
