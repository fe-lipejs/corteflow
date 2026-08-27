import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id, name, status,
      subscriptions (
        id, status, plan_id,
        subscription_contracts (
          permissions, limits
        ),
        plans (
          permissions, limits
        )
      )
    `)
    .eq('name', 'Maria Manicure');
    
  console.dir(data, { depth: null });
}

check();
