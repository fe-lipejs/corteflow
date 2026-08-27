
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runLeakTest() {
  console.log('--- DATA LEAK TEST ---')
  
  // Login as existing user
  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  })
  
  if (loginErr) {
     console.log('Login failed, create user manually or check credentials', loginErr)
     // Try signing up if missing
     await supabase.auth.signUp({ email: 'test@example.com', password: 'password123'})
     await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password123'})
  }
  
  // We need a tenant id
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
  const tenantId = tenants[0]?.id
  
  if (tenantId) {
    // Insert sensitive data
    await supabase.from('customers').insert({ tenant_id: tenantId, name: 'Secret Client', phone: '123456789' })
    await supabase.from('financial_transactions').insert({ tenant_id: tenantId, amount: 5000, type: 'income', description: 'Secret Money' })
  }
  
  // Now logout to become ANONYMOUS
  await supabase.auth.signOut()
  
  // Test 1: Can anon read customers?
  const { data: customers } = await supabase.from('customers').select('*')
  console.log('Anon Customers Leak:', customers?.length > 0 ? 'FAIL (LEAKED: ' + customers.length + ')' : 'PASS (Blocked by RLS)')
  
  // Test 2: Can anon read finance?
  const { data: finance } = await supabase.from('financial_transactions').select('*')
  console.log('Anon Finance Leak:', finance?.length > 0 ? 'FAIL (LEAKED: ' + finance.length + ')' : 'PASS (Blocked by RLS)')
}

runLeakTest().catch(console.error)
