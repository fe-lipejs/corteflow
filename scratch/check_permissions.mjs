import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPermissions() {
  const email = 'mariafsj2310@gmail.com';
  
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
  const { data: subs } = await supabase.from('subscriptions').select('*, plans(*)').eq('tenant_id', profile.tenant_id).order('updated_at', { ascending: false });
  const sub = subs[0];
  
  console.log('--- PLano Base (vitrine) ---');
  console.log('Permissoes do plano base:', sub.plans.permissions);
  console.log('Limites do plano base:', sub.plans.limits);
  
  const { data: contracts } = await supabase.from('subscription_contracts').select('*').eq('subscription_id', sub.id);
  const c = contracts[0];
  
  console.log('\n--- Contrato Ativo (snapshot) ---');
  console.log('Permissoes do contrato:', c.permissions);
  console.log('Limites do contrato:', c.limits);
  console.log('Max Profs:', c.max_professionals);
}

checkPermissions();
