const { createClient } = require('@supabase/supabase-js');

async function runTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // USE SERVICE ROLE TO BYPASS RLS
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

  // Make sure travel_fee is set up so it doesn't fail on fee mismatch during our radius tests
  await supabase.from('tenant_settings').update({ home_fee_amount: 0, home_fee_type: 'fixed' }).eq('tenant_id', tenantId);
  await supabase.from('professionals').update({ home_fee: 0 }).eq('id', proId);
  
  async function testBooking(empresaRadius, proRadius, clientDistance, testName) {
    // 1 km is roughly 0.009 degrees of latitude
    const latOffset = (clientDistance * 0.009);
    
    // update db for the test
    await supabase.from('tenant_settings').update({ home_service_radius_km: empresaRadius }).eq('tenant_id', tenantId);
    await supabase.from('professionals').update({ max_home_distance_km: proRadius }).eq('id', proId);
    
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    futureDate.setMinutes(futureDate.getMinutes() + Math.floor(Math.random() * 1000));
    
    const res = await supabase.from('bookings').insert({
      tenant_id: tenantId,
      customer_id: customerId,
      professional_id: proId,
      service_id: serviceId,
      order_number: 'TEST-' + Math.random().toString(36).substring(7),
      scheduled_at: futureDate.toISOString(),
      status: 'pending',
      payment_mode: 'local',
      amount_paid: 0,
      amount_total: 50,
      service_location: 'home',
      client_lat: tLat + latOffset, 
      client_lng: tLng,
      travel_fee: 0
    });
    
    console.log(`${testName}:`, res.error ? 'BLOCKED: ' + res.error.message : 'SUCCESS');
  }

  console.log('\\n--- INICIANDO TESTES DO NOVO LIMITE DE RAIO ---\\n');
  await testBooking(15, 5, 8, 'Empresa 15, Pro 5, Cliente 8 (Esperado: BLOQUEAR)');
  await testBooking(5, 15, 10, 'Empresa 5, Pro 15, Cliente 10 (Esperado: BLOQUEAR)');
  await testBooking(15, 5, 3, 'Empresa 15, Pro 5, Cliente 3 (Esperado: PERMITIR)');
  await testBooking(10, 0, 8, 'Empresa 10, Pro 0/NULL, Cliente 8 (Esperado: PERMITIR)');
  await testBooking(10, 0, 12, 'Empresa 10, Pro 0/NULL, Cliente 12 (Esperado: BLOQUEAR)');
}
runTests();
