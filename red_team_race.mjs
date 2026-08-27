
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runRaceTest() {
  const { data: tenants } = await supabase.from('tenants').select('id, slug').limit(1)
  const tenantId = tenants?.[0]?.id
  const slug = tenants?.[0]?.slug
  if (!tenantId) return console.log('No tenant found for race test')
  
  const { data: pros } = await supabase.from('professionals').select('id').eq('tenant_id', tenantId).limit(1)
  const proId = pros?.[0]?.id
  
  const { data: services } = await supabase.from('services').select('id, duration_minutes').eq('tenant_id', tenantId).limit(1)
  const serviceId = services?.[0]?.id
  
  const futureTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  
  console.log('Firing 5 concurrent requests for', futureTime)
  
  const promises = []
  for (let i = 0; i < 5; i++) {
    const p = supabase.functions.invoke('create-public-booking', {
      body: {
        tenant_id: tenantId,
        slug: slug,
        customer: { name: 'Race Tester ' + i, phone: '55512345' + i },
        service_id: serviceId,
        professional_id: proId,
        scheduled_at: futureTime,
        booking_mode: 'instore',
        payment_scope: 'local',
        payment_method: 'local'
      }
    })
    promises.push(p)
  }
  
  const results = await Promise.all(promises)
  
  let successes = 0
  let failures = 0
  
  for (let idx = 0; idx < results.length; idx++) {
    const res = results[idx]
    if (res.error) {
       let msg = res.error.message
       if (res.error.context && typeof res.error.context.text === 'function') {
           msg = await res.error.context.text()
       }
       console.log('Req', idx, 'FAILED:', msg)
       failures++
    } else {
       console.log('Req', idx, 'SUCCESS. Booking ID:', res.data?.booking_id)
       successes++
    }
  }
  
  console.log('--- SUMMARY ---')
  console.log('Successes:', successes)
  console.log('Failures:', failures)
  console.log('Race Condition Verdict:', successes === 1 ? 'PASS (Double Booking Blocked)' : 'FAIL (Double Booking Allowed!)')
}

runRaceTest().catch(console.error)
