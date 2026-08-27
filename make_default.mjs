import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''; 

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Remove default from all
  await supabase.from('plans').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');

  // Set Trial as default
  const { data, error } = await supabase
    .from('plans')
    .update({ is_default: true })
    .eq('name', 'Trial (Período de Teste)')
    .select();

  console.log('Update default result:', data, error);
}

main();
