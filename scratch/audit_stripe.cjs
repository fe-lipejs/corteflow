const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const { createClient } = require('@supabase/supabase-js');
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  const { data: settings } = await supabase.from('platform_settings').select('*');
  console.log('=== PLATFORM SETTINGS ===');
  console.log(JSON.stringify(settings, null, 2));

  const { data: prices } = await supabase.from('plan_prices').select('id, plan_id, currency, amount, stripe_price_id, plans(name, key)');
  console.log('=== PLAN PRICES ===');
  console.log(JSON.stringify(prices, null, 2));

  const { data: accounts } = await supabase.from('stripe_connect_accounts').select('*');
  console.log('=== STRIPE CONNECT ACCOUNTS ===');
  console.log(JSON.stringify(accounts, null, 2));
}

run().catch(console.error);
