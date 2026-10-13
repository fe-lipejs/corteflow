const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();
  console.log('Connected to DB. Starting radical reset...');

  await client.query('BEGIN;');

  try {
    // 1. Unlink tenant_id from profiles for felipejsf7@gmail.com so no FK restriction blocks deletion
    await client.query(`
      UPDATE profiles 
      SET tenant_id = NULL, role = 'super_admin', is_super_admin = true 
      WHERE email = 'felipejsf7@gmail.com';
    `);

    // 2. Delete any other profile that is NOT felipejsf7@gmail.com (if any exists)
    await client.query(`
      DELETE FROM profiles 
      WHERE email != 'felipejsf7@gmail.com' OR email IS NULL;
    `);

    // 3. Delete any other auth.users that is NOT felipejsf7@gmail.com
    await client.query(`
      DELETE FROM auth.users 
      WHERE email != 'felipejsf7@gmail.com';
    `);

    // 4. Delete dependent tables that might have SET NULL or standalone data
    await client.query(`DELETE FROM support_messages;`);
    await client.query(`DELETE FROM support_tickets;`);
    await client.query(`DELETE FROM admin_notifications;`);
    await client.query(`DELETE FROM notifications;`);
    await client.query(`DELETE FROM billing_events;`);
    await client.query(`DELETE FROM stripe_events;`);
    await client.query(`DELETE FROM commercial_history;`);
    await client.query(`DELETE FROM analytics_events;`);

    // 5. Delete subscription_contracts and subscriptions
    await client.query(`DELETE FROM subscription_contracts;`);
    await client.query(`DELETE FROM subscriptions;`);

    // 6. Delete all bookings, customers, services, etc.
    await client.query(`DELETE FROM booking_notes;`);
    await client.query(`DELETE FROM booking_history;`);
    await client.query(`DELETE FROM bookings;`);
    await client.query(`DELETE FROM customers;`);
    await client.query(`DELETE FROM customer_credits;`);
    await client.query(`DELETE FROM refunds;`);
    await client.query(`DELETE FROM payment_history;`);
    await client.query(`DELETE FROM payments;`);
    await client.query(`DELETE FROM financial_transactions;`);
    await client.query(`DELETE FROM recurring_expenses;`);
    await client.query(`DELETE FROM products;`);
    await client.query(`DELETE FROM professional_services;`);
    await client.query(`DELETE FROM professional_blocked_times;`);
    await client.query(`DELETE FROM professional_working_hours;`);
    await client.query(`DELETE FROM blocked_times;`);
    await client.query(`DELETE FROM services;`);
    await client.query(`DELETE FROM categories;`);
    await client.query(`DELETE FROM professionals;`);
    await client.query(`DELETE FROM business_hours;`);
    await client.query(`DELETE FROM tenant_settings;`);
    await client.query(`DELETE FROM tenant_users;`);
    await client.query(`DELETE FROM stripe_connect_accounts;`);

    // 7. Delete all tenants!
    await client.query(`DELETE FROM tenants;`);

    await client.query('COMMIT;');
    console.log('Radical reset committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Reset failed, rolled back:', err);
    throw err;
  }

  // Verify remaining records
  const authUsers = await client.query('SELECT id, email FROM auth.users;');
  console.log('Remaining auth users:');
  console.table(authUsers.rows);

  const profiles = await client.query('SELECT id, role, is_super_admin, tenant_id, email FROM profiles;');
  console.log('Remaining profiles:');
  console.table(profiles.rows);

  const tenants = await client.query('SELECT count(*) as total FROM tenants;');
  console.log('Remaining tenants count:', tenants.rows[0].total);

  const bookings = await client.query('SELECT count(*) as total FROM bookings;');
  console.log('Remaining bookings count:', bookings.rows[0].total);

  const customers = await client.query('SELECT count(*) as total FROM customers;');
  console.log('Remaining customers count:', customers.rows[0].total);

  await client.end();
}

main().catch(console.error);
