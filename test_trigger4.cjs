const { createClient } = require('@supabase/supabase-js');

async function runTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenants[0].id;
  
  const { data: pros } = await supabase.from('professionals').select('id').eq('tenant_id', tenantId).limit(1);
  const proId = pros[0].id;
  const { data: services } = await supabase.from('services').select('id').eq('tenant_id', tenantId).limit(1);
  const serviceId = services[0].id;
  const { data: customers } = await supabase.from('customers').select('id').eq('tenant_id', tenantId).limit(1);
  const customerId = customers[0].id;
  
  const { data: ts } = await supabase.from('tenant_settings').select('latitude, longitude').eq('tenant_id', tenantId).single();
  const tLat = ts?.latitude || -20.3155;
  const tLng = ts?.longitude || -40.3128;
  
  console.log('\\nTest 3: Malicious Booking (Home service with travel_fee = 0 within radius, but backend should enforce 20)');
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1); // 1 month in the future
  
  const res3 = await supabase.from('bookings').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    professional_id: proId,
    service_id: serviceId,
    order_number: 'TEST-MALICIOUS-5',
    scheduled_at: futureDate.toISOString(),
    status: 'pending',
    payment_mode: 'local',
    amount_paid: 0,
    amount_total: 50,
    service_location: 'home',
    client_lat: tLat + 0.001, 
    client_lng: tLng + 0.001,
    travel_fee: 0 // trying to bypass fee
  });
  console.log('Result 3:', res3.error ? 'BLOCKED: ' + res3.error.message : 'SUCCESS (BUG!) or CORRECTED');
}
runTests();
