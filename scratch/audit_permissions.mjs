import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://paefckmkawocjxzuoclq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const sb = createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: sysPerms, error: e1 } = await sb.from('sys_permissions').select('*');
console.log('=== sys_permissions ===', e1?.message || '');
console.log('cols:', Object.keys(sysPerms?.[0] || {}));
console.log((sysPerms || []).map(p => p.key ?? p.permission_key ?? p.id).sort().join('\n'));

const { data: rp, error: e2 } = await sb.from('sys_role_permissions').select('*');
console.log('\n=== sys_role_permissions ===', e2?.message || '');
const byRole = {};
(rp || []).forEach(r => { (byRole[r.role] ||= []).push(r.permission_key); });
for (const [r, ps] of Object.entries(byRole)) console.log(r, ps.length, ps.sort().join(', '));

const { data: plans } = await sb.from('plans').select('id,key,name,active,is_default,is_trial_plan,permissions,limits,max_professionals,allow_products,features').order('sort_order');
console.log('\n=== plans ===');
for (const p of plans || []) {
  const { display_features, ...f } = p.features || {};
  console.log(`\n[${p.key}] ${p.name} id=${p.id} active=${p.active} default=${p.is_default} trial=${p.is_trial_plan}`);
  console.log('  permissions:', JSON.stringify(p.permissions));
  console.log('  limits:', JSON.stringify(p.limits), 'max_prof:', p.max_professionals, 'allow_products:', p.allow_products);
  console.log('  features:', JSON.stringify(f));
}

const { data: subs } = await sb.from('subscriptions').select('id,tenant_id,status,plan_id,trial_ends_at,updated_at,tenants(name),plans(key),subscription_contracts(id,permissions)').order('updated_at', { ascending: false });
console.log('\n=== subscriptions ===');
for (const s of subs || []) {
  const c = Array.isArray(s.subscription_contracts) ? s.subscription_contracts : [s.subscription_contracts].filter(Boolean);
  console.log(`${s.tenants?.name} | ${s.status} | plan=${s.plans?.key} | trial_ends=${s.trial_ends_at} | contracts=${c.length}`);
}

const { data: profs } = await sb.from('profiles').select('role');
const rc = {};
(profs || []).forEach(p => { rc[p.role] = (rc[p.role] || 0) + 1; });
console.log('\n=== profile roles ===', rc);
