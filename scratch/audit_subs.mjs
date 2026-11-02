import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://paefckmkawocjxzuoclq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ', { auth: { persistSession: false } });

const { data: subs, error } = await sb.from('subscriptions').select('*').order('updated_at', { ascending: false });
console.log('subs err:', error?.message, 'count:', subs?.length);
for (const s of subs || []) console.log(JSON.stringify(s));

const { data: contracts, error: ce } = await sb.from('subscription_contracts').select('*');
console.log('\ncontracts err:', ce?.message, 'count:', contracts?.length);
for (const c of contracts || []) console.log(JSON.stringify({ ...c, features: undefined }));

const { data: tenants } = await sb.from('tenants').select('id,name,slug,status,owner_user_id');
console.log('\ntenants:', JSON.stringify(tenants));

const { data: profiles } = await sb.from('profiles').select('id,role,tenant_id,full_name');
console.log('\nprofiles:', JSON.stringify(profiles));

const { data: tm, error: tme } = await sb.from('tenant_members').select('*');
console.log('\ntenant_members:', tme?.message, JSON.stringify(tm));
