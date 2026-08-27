
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY // fallback to test

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY) : supabase

async function createAccount(email) {
  if (supabaseAdmin !== supabase) {
    await supabaseAdmin.auth.admin.createUser({ email, password: 'password123', email_confirm: true })
  } else {
    await supabase.auth.signUp({ email, password: 'password123' })
  }
  const { data } = await supabase.auth.signInWithPassword({ email, password: 'password123' })
  return data?.user
}

async function runCrossTenantTest() {
  console.log('--- CROSS-TENANT RLS TEST ---')
  if (supabaseAdmin === supabase) {
     console.log('WARNING: No service role key found. Might fail due to email confirmation.')
  }
  
  const userA = await createAccount('usera' + Date.now() + '@test.com')
  if (!userA) return console.log('Failed to create userA')
  
  const { data: insertedA } = await supabase.from('tenants').insert({ name: 'Salon A', slug: 'salon-a-' + Date.now(), business_type: 'barbearia', owner_user_id: userA.id }).select()
  let finalTenantA = insertedA?.[0]?.id

  if (finalTenantA) {
    await supabase.from('customers').insert({ tenant_id: finalTenantA, name: 'Customer A', phone: '11111' })
  }
  await supabase.auth.signOut()

  const userB = await createAccount('userb' + Date.now() + '@test.com')
  const { data: insertedB } = await supabase.from('tenants').insert({ name: 'Salon B', slug: 'salon-b-' + Date.now(), business_type: 'barbearia', owner_user_id: userB.id }).select()
  let finalTenantB = insertedB?.[0]?.id

  if (finalTenantB) {
     await supabase.from('customers').insert({ tenant_id: finalTenantB, name: 'Customer B', phone: '22222' })
  }
  
  // Now User B tries to read ALL customers
  const { data: allCustomers } = await supabase.from('customers').select('*')
  console.log('Total customers visible to User B:', allCustomers?.length)
  const sawA = allCustomers?.some(c => c.tenant_id === finalTenantA)
  console.log('User B saw Tenant A data:', sawA ? 'FAIL (LEAK)' : 'PASS (ISOLATED)')

  // Now User B tries to UPDATE Tenant A's customer
  const { error: updateErr, data: updated } = await supabase.from('customers').update({ name: 'Hacked by B' }).eq('tenant_id', finalTenantA).select()
  console.log('User B update Tenant A data:', updated?.length > 0 ? 'FAIL (MODIFIED)' : 'PASS (BLOCKED)')
}

runCrossTenantTest().catch(console.error)
