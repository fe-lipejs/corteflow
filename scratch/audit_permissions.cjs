const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

async function main() {
  await client.connect();

  const sysPerms = await client.query(`SELECT * FROM sys_permissions ORDER BY module, key`);
  console.log('\n=== sys_permissions ===');
  console.log(sysPerms.rows.map(r => r.key || r.permission_key || JSON.stringify(r)).join('\n'));
  console.log('columns:', Object.keys(sysPerms.rows[0] || {}));

  const roles = await client.query(`SELECT role, array_agg(permission_key ORDER BY permission_key) AS perms FROM sys_role_permissions GROUP BY role`);
  console.log('\n=== sys_role_permissions ===');
  for (const r of roles.rows) console.log(r.role, '=>', r.perms.length, r.perms.join(', '));

  const plans = await client.query(`SELECT id, key, name, active, is_default, is_trial_plan, permissions, limits, max_professionals, allow_products, features - 'display_features' AS features FROM plans ORDER BY sort_order`);
  console.log('\n=== plans ===');
  for (const p of plans.rows) {
    console.log(`\n[${p.key}] ${p.name} id=${p.id} active=${p.active} default=${p.is_default} trial_plan=${p.is_trial_plan}`);
    console.log('  permissions:', JSON.stringify(p.permissions));
    console.log('  limits:', JSON.stringify(p.limits), 'max_prof:', p.max_professionals, 'allow_products:', p.allow_products);
    console.log('  features:', JSON.stringify(p.features));
  }

  const subs = await client.query(`
    SELECT s.id, s.tenant_id, t.name AS tenant, s.status, s.plan_id, pl.key AS plan_key, s.trial_ends_at, s.updated_at,
           (SELECT count(*) FROM subscription_contracts c WHERE c.subscription_id = s.id) AS contracts
    FROM subscriptions s
    LEFT JOIN tenants t ON t.id = s.tenant_id
    LEFT JOIN plans pl ON pl.id = s.plan_id
    ORDER BY t.name, s.updated_at DESC`);
  console.log('\n=== subscriptions ===');
  for (const s of subs.rows) console.log(`${s.tenant} | ${s.status} | plan=${s.plan_key} (${s.plan_id}) | trial_ends=${s.trial_ends_at?.toISOString?.()} | contracts=${s.contracts}`);

  const profiles = await client.query(`SELECT role, count(*) FROM profiles GROUP BY role`);
  console.log('\n=== profiles by role ===', profiles.rows);

  const tm = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tenant_members'`);
  console.log('tenant_members columns:', tm.rows.map(r => r.column_name));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
