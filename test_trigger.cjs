const { createClient } = require('@supabase/supabase-js');

async function runTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('--- STARTING BACKEND SECURITY TEST ---');
  
  // 1. Get a valid tenant and professional
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, name, slug').limit(1);
  if (tErr || !tenants.length) {
    console.log('No tenants found.');
    return;
  }
  const tenant = tenants[0];
  console.log('Using tenant:', tenant.slug);
  
  const { data: pros, error: pErr } = await supabase.from('professionals').select('id, name, offers_home_service').eq('tenant_id', tenant.id).limit(1);
  const proId = pros && pros.length ? pros[0].id : null;
  
  const { data: services, error: sErr } = await supabase.from('services').select('id, name').eq('tenant_id', tenant.id).limit(1);
  const serviceId = services && services.length ? services[0].id : null;
  
  const { data: customers, error: cErr } = await supabase.from('customers').select('id').eq('tenant_id', tenant.id).limit(1);
  const customerId = customers && customers.length ? customers[0].id : null;
  
  if (!proId || !serviceId || !customerId) {
    console.log('Missing pro, service, or customer to create a booking.');
    return;
  }
  
  console.log('\\nTest 1: Malicious Booking (Home service with NO coordinates)');
  const res1 = await supabase.from('bookings').insert({
    tenant_id: tenant.id,
    customer_id: customerId,
    professional_id: proId,
    service_id: serviceId,
    order_number: 'TEST-MALICIOUS-1',
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    payment_mode: 'local',
    amount_paid: 0,
    amount_total: 50,
    service_location: 'home',
    // Missing client_lat and client_lng
  });
  console.log('Result 1:', res1.error ? 'BLOCKED: ' + res1.error.message : 'SUCCESS (BUG!)');
  
  console.log('\\nTest 2: Malicious Booking (Home service with coords FAR outside radius)');
  const res2 = await supabase.from('bookings').insert({
    tenant_id: tenant.id,
    customer_id: customerId,
    professional_id: proId,
    service_id: serviceId,
    order_number: 'TEST-MALICIOUS-2',
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    payment_mode: 'local',
    amount_paid: 0,
    amount_total: 50,
    service_location: 'home',
    client_lat: -23.5505, // SP
    client_lng: -46.6333, // SP
    travel_fee: 0 // trying to bypass fee
  });
  console.log('Result 2:', res2.error ? 'BLOCKED: ' + res2.error.message : 'SUCCESS (BUG!)');
  
  console.log('\\nTest 3: Malicious Booking (Home service with travel_fee = 0 within radius)');
  const { data: ts } = await supabase.from('tenant_settings').select('latitude, longitude').eq('tenant_id', tenant.id).single();
  const tLat = ts?.latitude || -20.3155;
  const tLng = ts?.longitude || -40.3128;
  
  const res3 = await supabase.from('bookings').insert({
    tenant_id: tenant.id,
    customer_id: customerId,
    professional_id: proId,
    service_id: serviceId,
    order_number: 'TEST-MALICIOUS-3',
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    payment_mode: 'local',
    amount_paid: 0,
    amount_total: 50,
    service_location: 'home',
    client_lat: tLat + 0.001, // Very close
    client_lng: tLng + 0.001,
    travel_fee: 0 // trying to bypass fee
  });
  console.log('Result 3:', res3.error ? 'BLOCKED: ' + res3.error.message : 'SUCCESS (BUG!) or CORRECTED');
  
  if (!res3.error) {
    const { data: check } = await supabase.from('bookings').select('travel_fee').eq('order_number', 'TEST-MALICIOUS-3').single();
    console.log('Travel Fee in DB:', check?.travel_fee);
  }
}

runTests();
