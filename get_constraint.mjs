
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getConstraint() {
  const { data, error } = await supabase.rpc('execute_sql', { query: 'SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = ''public'' AND conname = ''bookings_service_location_check'';' })
  console.log('Result:', data || error)
}
getConstraint().catch(console.error)
