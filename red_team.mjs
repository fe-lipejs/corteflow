
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runAttack() {
  console.log('--- STARTING RED TEAM AUDIT ---')
  
  // Try to query ALL tenants anonymously
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*')
  console.log('1. Anonymous Tenant Access:', tErr ? 'BLOCKED' : 'ALLOWED (' + tenants?.length + ' found)')
  
  // Try to query ALL customers anonymously
  const { data: customers, error: cErr } = await supabase.from('customers').select('*')
  console.log('2. Anonymous Customers Access:', cErr ? 'BLOCKED' : 'ALLOWED (' + customers?.length + ' found)')
  
  // Try to query ALL financial transactions
  const { data: finance, error: fErr } = await supabase.from('financial_transactions').select('*')
  console.log('3. Anonymous Finance Access:', fErr ? 'BLOCKED' : 'ALLOWED (' + finance?.length + ' found)')
  
  // Try to insert a fake tenant anonymously
  const { error: insertErr } = await supabase.from('tenants').insert({ name: 'Hacked', slug: 'hacked-tenant', business_type: 'barbearia', owner_user_id: '11111111-1111-1111-1111-111111111111'})
  console.log('4. Anonymous Tenant Creation:', insertErr ? 'BLOCKED' : 'ALLOWED')
}

runAttack().catch(console.error)
