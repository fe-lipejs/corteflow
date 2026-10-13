const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- ALL CUSTOMERS IN SALAO DO JO ---');
  const custs = await client.query('SELECT id, name, phone, email FROM customers WHERE tenant_id = $1;', ['1fb9311b-3901-4735-8ee6-07293ca7d028']);
  console.table(custs.rows);

  console.log('--- ALL BOOKINGS IN SALAO DO JO ---');
  const books = await client.query('SELECT id, order_number, scheduled_at, status FROM bookings WHERE tenant_id = $1;', ['1fb9311b-3901-4735-8ee6-07293ca7d028']);
  console.table(books.rows);

  console.log('--- PROFESSIONALS IN SALAO DO JO ---');
  const pros = await client.query('SELECT id, name, role_title FROM professionals WHERE tenant_id = $1;', ['1fb9311b-3901-4735-8ee6-07293ca7d028']);
  console.table(pros.rows);

  console.log('--- SERVICES IN SALAO DO JO ---');
  const servs = await client.query('SELECT id, name, price FROM services WHERE tenant_id = $1;', ['1fb9311b-3901-4735-8ee6-07293ca7d028']);
  console.table(servs.rows);

  await client.end();
}

main().catch(console.error);
