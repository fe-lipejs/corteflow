import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paefckmkawocjxzuoclq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data: plans, error: pErr } = await supabase.from('plans').select('id, key, name');
  console.log('Plans:', plans, 'Error:', pErr);

  const { data: settings, error: sErr } = await supabase.from('platform_settings').select('*');
  console.log('platform_settings:', settings, 'Error:', sErr);

  const { data: cap, error: cErr } = await supabase.from('cliente_captacao').select('*');
  console.log('cliente_captacao:', cap, 'Error:', cErr);
}

test();
