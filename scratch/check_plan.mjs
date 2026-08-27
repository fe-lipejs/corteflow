import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPlan() {
  const email = 'mariafsj2310@gmail.com';
  
  // Find auth.users
  const { data: users, error: errUser } = await supabase.auth.admin.listUsers();
  if (errUser) { console.error('Error fetching users:', errUser); return; }
  
  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.log(`Usuário não encontrado: ${email}`);
    return;
  }
  
  console.log(`User ID: ${user.id}`);
  
  // Find profile and tenant
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    console.log('Profile não encontrado');
    return;
  }
  
  console.log(`Tenant ID: ${profile.tenant_id}`);
  
  // Find tenant name
  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', profile.tenant_id).single();
  console.log(`Salão: ${tenant?.name}`);
  
  // Find subscription
  const { data: subs } = await supabase.from('subscriptions').select('*, plans(*)').eq('tenant_id', profile.tenant_id).order('updated_at', { ascending: false });
  if (!subs || subs.length === 0) {
    console.log('Nenhuma assinatura encontrada. Provavelmente usando o plano fallback default.');
    // Check fallback
    const { data: dp } = await supabase.from('plans').select('*').eq('is_default', true).maybeSingle();
    console.log(`Plano Padrão: ${dp?.name || 'Nenhum'}`);
    return;
  }
  
  const sub = subs[0];
  console.log(`Status da assinatura: ${sub.status}`);
  console.log(`Plano base atual: ${sub.plans?.name || sub.plan_id}`);
  
  // Find subscription_contracts
  const { data: contracts } = await supabase.from('subscription_contracts').select('*').eq('subscription_id', sub.id);
  if (contracts && contracts.length > 0) {
    const c = contracts[0];
    console.log(`\n-- Contrato Ativo --`);
    console.log(`Valor: ${c.currency} ${c.price_amount}`);
    console.log(`Profissionais: ${c.max_professionals}`);
    console.log(`Produtos: ${c.allow_products}`);
  }
}

checkPlan();
