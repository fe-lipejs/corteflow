import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: plans, error: pErr } = await supabase.from('plans').select('*');
  const { data: prices, error: prErr } = await supabase.from('plan_prices').select('*');

  console.log('--- PLANS ---');
  console.log(JSON.stringify(plans, null, 2));
  
  console.log('--- PRICES ---');
  console.log(JSON.stringify(prices, null, 2));
}

main().catch(console.error);
