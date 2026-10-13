const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  console.log('--- ALL AUTH USERS ---');
  const authUsers = await client.query('SELECT id, email, raw_user_meta_data FROM auth.users;');
  console.log(authUsers.rows);

  console.log('--- ALL PROFILES ---');
  const profiles = await client.query('SELECT * FROM profiles;');
  console.log(profiles.rows);

  console.log('--- ALL TENANTS ---');
  const tenants = await client.query('SELECT id, owner_user_id, name, slug, status FROM tenants;');
  console.log(tenants.rows);

  console.log('--- FOREIGN KEYS REFERENCING tenants ---');
  const fksTenants = await client.query(`
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'tenants';
  `);
  console.table(fksTenants.rows);

  console.log('--- FOREIGN KEYS REFERENCING profiles / auth.users ---');
  const fksUsers = await client.query(`
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
    WHERE ccu.table_name IN ('users', 'profiles');
  `);
  console.table(fksUsers.rows);

  await client.end();
}

main().catch(console.error);
