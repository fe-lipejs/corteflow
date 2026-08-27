
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function runPaywallTest() {
  console.log('--- PAYWALL BYPASS TEST ---')
  
  // 1. Create a user
  const email = 'paywall_' + Date.now() + '@test.com'
  await supabaseAdmin.auth.admin.createUser({ email, password: 'password123', email_confirm: true })
  
  const { data: { user } } = await supabase.auth.signInWithPassword({ email, password: 'password123' })
  
  // 2. Create tenant
  const { data: tenantData } = await supabase.from('tenants').insert({ name: 'Paywall Salon', slug: 'paywall-' + Date.now(), business_type: 'barbearia', owner_user_id: user.id }).select()
  const tenantId = tenantData?.[0]?.id
  
  // 3. Force tenant to Starter Plan
  // We need to fetch the starter plan id
  const { data: plans } = await supabaseAdmin.from('plans').select('id, max_professionals').eq('key', 'starter').limit(1)
  const starterPlanId = plans?.[0]?.id
  
  // Ensure a subscription exists on starter plan
  await supabaseAdmin.from('subscriptions').insert({ tenant_id: tenantId, plan_id: starterPlanId, status: 'active', stripe_customer_id: 'cus_fake' })
  
  // 4. Try to insert 1st professional (Should succeed)
  const { error: err1 } = await supabase.from('professionals').insert({ tenant_id: tenantId, name: 'Pro 1', active: true })
  console.log('Insert Pro 1:', err1 ? 'FAILED' : 'SUCCESS')
  
  // 5. Try to insert 2nd professional (Should fail because Starter plan max is 1)
  const { error: err2 } = await supabase.from('professionals').insert({ tenant_id: tenantId, name: 'Pro 2', active: true })
  console.log('Insert Pro 2 (Bypass):', err2 ? 'BLOCKED by DB (' + err2.message + ')' : 'ALLOWED (VULNERABILITY!)')
}

runPaywallTest().catch(console.error)
