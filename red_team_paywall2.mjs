
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function runPaywallTest() {
  const email = 'paywall2_' + Date.now() + '@test.com'
  await supabaseAdmin.auth.admin.createUser({ email, password: 'password123', email_confirm: true })
  
  const supabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user } } = await supabase.auth.signInWithPassword({ email, password: 'password123' })
  
  const { data: tenantData } = await supabase.from('tenants').insert({ name: 'Paywall Salon', slug: 'paywall2-' + Date.now(), business_type: 'barbearia', owner_user_id: user.id }).select()
  const tenantId = tenantData?.[0]?.id
  
  const { data: plans } = await supabaseAdmin.from('plans').select('id').eq('key', 'starter').limit(1)
  const starterPlanId = plans?.[0]?.id
  
  await supabaseAdmin.from('subscriptions').insert({ tenant_id: tenantId, plan_id: starterPlanId, status: 'active', stripe_customer_id: 'cus_fake' })
  
  const { error: err1 } = await supabase.from('products').insert({ tenant_id: tenantId, name: 'Pomada', price: 50, stock: 10, active: true })
  console.log('Insert Product (Starter Plan):', err1 ? 'BLOCKED (' + err1.message + ')' : 'ALLOWED (VULNERABILITY!)')
}

runPaywallTest().catch(console.error)
