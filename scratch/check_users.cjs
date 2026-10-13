const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  // Get all table names in public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('Tables found:', tablesRes.rows.map(r => r.table_name));

  for (const row of tablesRes.rows) {
    const table = row.table_name;
    // Check if table has tenant_id or user_id or similar
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [table]);
    const cols = colsRes.rows.map(c => c.column_name);

    const countRes = await client.query(`SELECT count(*) as total FROM "${table}";`);
    const total = countRes.rows[0].total;

    let tenantCounts = '';
    if (cols.includes('tenant_id')) {
      const byTenant = await client.query(`
        SELECT tenant_id, count(*) as count 
        FROM "${table}" 
        GROUP BY tenant_id;
      `);
      tenantCounts = JSON.stringify(byTenant.rows);
    }

    console.log(`Table: ${table} (Total: ${total}) ${tenantCounts ? 'Tenants: ' + tenantCounts : ''}`);
  }

  await client.end();
}

main().catch(console.error);
