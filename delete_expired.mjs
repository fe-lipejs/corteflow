import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''; 

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('plans')
    .delete()
    .ilike('name', '%expirado%')
    .select();

  console.log('Delete result:', data, error);
}

main();
