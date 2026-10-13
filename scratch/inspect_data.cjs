const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- CUSTOMERS (first 5) ---');
  const cust = await client.query('SELECT id, name, phone, email, tenant_id FROM customers LIMIT 5;');
  console.table(cust.rows);

  console.log('--- BOOKINGS (first 5) ---');
  const book = await client.query('SELECT id, tenant_id, customer_id, scheduled_at, status FROM bookings LIMIT 5;');
  console.table(book.rows);

  console.log('--- SUPPORT TICKETS ---');
  const tickets = await client.query('SELECT * FROM support_tickets;');
  console.table(tickets.rows);

  console.log('--- NOTIFICATIONS (first 5) ---');
  const notifs = await client.query('SELECT id, tenant_id, title, user_id FROM notifications LIMIT 5;');
  console.table(notifs.rows);

  await client.end();
}

main().catch(console.error);
