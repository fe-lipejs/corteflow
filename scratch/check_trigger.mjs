import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTrigger() {
  const { data, error } = await supabase.rpc('get_triggers'); // not gonna work if no rpc
  // Or just try updating a plan and see if subscription_contracts updates!
  const { data: plans } = await supabase.from('plans').select('id, permissions, limits').eq('key', 'expired_tier').single();
  
  if (plans) {
    console.log('Current plan:', plans);
    const newPerms = ['agenda.visualizar_todos'];
    const res = await supabase.from('plans').update({ permissions: newPerms }).eq('id', plans.id).select();
    console.log('Update res:', res.data);
    
    // Check if subscription_contracts updated
    const { data: subs } = await supabase.from('subscriptions').select('id').eq('plan_id', plans.id);
    if (subs && subs.length > 0) {
       const sub = subs[0];
       const { data: c } = await supabase.from('subscription_contracts').select('*').eq('subscription_id', sub.id).single();
       console.log('Contract after update:', c);
    }
  }
}

checkTrigger();
