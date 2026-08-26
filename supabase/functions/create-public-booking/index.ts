import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

function haversineKm(
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 *
      Math.cos((pos1.lat * Math.PI) / 180) *
      Math.cos((pos2.lat * Math.PI) / 180);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { 
      tenant_id, 
      service_id, 
      professional_id, 
      customer, 
      scheduled_at, 
      booking_mode, 
      payment_scope,
      payment_method,
      client_address,
      client_lat,
      client_lng,
      customer_notes
    } = payload;

    if (!tenant_id || !service_id || !customer || !scheduled_at || !booking_mode) {
      throw new Error("Missing required booking fields.");
    }

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('id', tenant_id)
      .single();
    
    if (tErr || !tenant) throw new Error("Invalid tenant.");
    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      throw new Error("Tenant is not active.");
    }

    const { data: service, error: sErr } = await supabase
      .from('services')
      .select('id, price, home_price_extra, active')
      .eq('id', service_id)
      .eq('tenant_id', tenant_id)
      .single();
      
    if (sErr || !service) throw new Error("Invalid service.");
    if (!service.active) throw new Error("Service is not active.");

    let travel_fee = 0;
    
    if (booking_mode === 'home') {
      if (!professional_id || professional_id === 'any') {
        throw new Error("Para atendimento a domicílio, escolha um profissional específico.");
      }
      
      const { data: professional, error: pErr } = await supabase
        .from('professionals')
        .select('id, offers_home_service, max_home_distance_km, home_fee, home_fee_type, home_fee_per_km, active')
        .eq('id', professional_id)
        .eq('tenant_id', tenant_id)
        .single();
        
      if (pErr || !professional) throw new Error("Invalid professional.");
      if (!professional.active) throw new Error("Professional is not active.");
      if (!professional.offers_home_service) throw new Error("Este profissional não realiza atendimentos a domicílio.");

      if (!client_lat || !client_lng) {
        throw new Error("Coordenadas do cliente são obrigatórias para atendimento a domicílio.");
      }

      const { data: tenantSettings, error: tsErr } = await supabase
        .from('tenant_settings')
        .select('latitude, longitude')
        .eq('tenant_id', tenant_id)
        .single();
        
      if (tsErr || !tenantSettings || !tenantSettings.latitude || !tenantSettings.longitude) {
        throw new Error("O salão não possui coordenadas configuradas para calcular a distância.");
      }

      const distanceKm = haversineKm(
        { lat: client_lat, lng: client_lng },
        { lat: tenantSettings.latitude, lng: tenantSettings.longitude }
      );

      const maxDistance = professional.max_home_distance_km || 0;
      if (distanceKm > maxDistance) {
        throw new Error("A distância solicitada excede o limite de cobertura do profissional.");
      }

      if (professional.home_fee_type === 'per_km') {
          travel_fee = (professional.home_fee_per_km || 0) * distanceKm;
        } else {
          travel_fee = professional.home_fee || 0;
        }
    } else {
      if (professional_id && professional_id !== 'any') {
        const { data: professional, error: pErr } = await supabase
          .from('professionals')
          .select('id, active')
          .eq('id', professional_id)
          .eq('tenant_id', tenant_id)
          .single();
          
        if (pErr || !professional || !professional.active) throw new Error("Invalid or inactive professional.");
      }
    }

    const serviceHomeExtra = booking_mode === 'home' ? (service.home_price_extra || 0) : 0;
    const amount_total = (service.price || 0) + serviceHomeExtra + travel_fee;
    
    let amount_paid = 0;
    if (payment_scope === "full" && payment_method !== "cash") {
      amount_paid = amount_total;
    } else if (payment_scope === "partial" && payment_method !== "cash") {
      amount_paid = amount_total / 2;
    }

    let customerId = null;
    let cleanPhone = customer.phone.replace(/\D/g, "");
    
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (customer.email) {
        await supabase.from("customers").update({ email: customer.email }).eq("id", customerId);
      }
    } else {
      const { data: newCustomer, error: cErr } = await supabase
        .from("customers")
        .insert([{ 
          tenant_id: tenant_id, 
          name: customer.name, 
          phone: cleanPhone, 
          email: customer.email 
        }])
        .select("id")
        .single();
      if (cErr) throw cErr;
      customerId = newCustomer.id;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const accessCode = Math.random().toString(36).substring(2, 12);

    const { data: newBooking, error: bErr } = await supabase
      .from("bookings")
      .insert([
        {
          tenant_id: tenant_id,
          customer_id: customerId,
          professional_id: professional_id === 'any' ? null : professional_id,
          service_id: service_id,
          order_number: code,
          scheduled_at: scheduled_at,
          status: (payment_scope !== "local" && payment_method !== "cash") ? "pending" : "confirmed",
          payment_mode:
            payment_scope === "full"
              ? "full"
              : payment_scope === "partial"
                ? "deposit"
                : "local",
          amount_paid: amount_paid,
          amount_total: amount_total,
          notes: customer_notes,
          access_code: accessCode,
          service_location: booking_mode,
          client_address: booking_mode === 'home' ? client_address : null,
          client_lat: booking_mode === 'home' ? client_lat : null,
          client_lng: booking_mode === 'home' ? client_lng : null,
          travel_fee: booking_mode === 'home' ? travel_fee : 0,
        },
      ])
      .select("id, order_number, amount_total")
      .single();

    if (bErr) throw bErr;

    return new Response(JSON.stringify({ 
      success: true, 
      booking: newBooking 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
