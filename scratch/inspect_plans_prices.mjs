import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://paefckmkawocjxzuoclq.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: plans } = await supabase.from('plans').select('*');
  console.log('--- PLANS ---');
  console.log(JSON.stringify(plans, null, 2));

  const { data: prices } = await supabase.from('plan_prices').select('*');
  console.log('--- PLAN PRICES ---');
  console.log(JSON.stringify(prices, null, 2));
}

main();
