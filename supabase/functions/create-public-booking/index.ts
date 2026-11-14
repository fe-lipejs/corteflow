import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { dispatchBookingPushEvent } from "../_shared/webpush.ts";

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

function getSaoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function computeMaxDateKey(todayKey: string, maxAdvanceDays: number): string {
  const anchor = new Date(`${todayKey}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + (maxAdvanceDays - 1));
  return anchor.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
      customer_notes,
    } = payload;

    if (!tenant_id || !service_id || !customer || !scheduled_at || !booking_mode) {
      throw new Error("Missing required booking fields.");
    }

    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) {
      throw new Error("Data ou horário de agendamento inválido.");
    }
    if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new Error("Não é possível agendar em um horário que já passou.");
    }

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, status, trial_ends_at")
      .eq("id", tenant_id)
      .single();

    if (tErr || !tenant) throw new Error("Invalid tenant.");
    if (tenant.status !== "active" && tenant.status !== "trial") {
      throw new Error("Tenant is not active.");
    }
    if (tenant.status === "trial" && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
      throw new Error("Período de avaliação encerrado. O estabelecimento está temporariamente indisponível para agendamentos.");
    }

    // Fetch tenant_settings for horizon validation, coordinates & deposit_percentage
    const { data: tenantSettings } = await supabase
      .from("tenant_settings")
      .select("latitude, longitude, deposit_percentage, max_advance_days")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Antecedência Máxima de Agendamento ("contando com hoje"; null = Sem limite; sem registro = 30)
    const effectiveMaxAdvanceDays: number | null = tenantSettings
      ? tenantSettings.max_advance_days
      : 30;

    if (effectiveMaxAdvanceDays !== null && effectiveMaxAdvanceDays >= 1) {
      const todayKey = getSaoPauloDateKey(new Date());
      const maxDateKey = computeMaxDateKey(todayKey, effectiveMaxAdvanceDays);
      const targetDateKey = getSaoPauloDateKey(scheduledDate);

      if (targetDateKey > maxDateKey) {
        const maxDateBR = maxDateKey.split("-").reverse().join("/");
        throw new Error(
          `Data fora da antecedência máxima permitida (${effectiveMaxAdvanceDays} ${
            effectiveMaxAdvanceDays === 1 ? "dia" : "dias"
          }, disponível até ${maxDateBR}).`
        );
      }
    }

    const { data: service, error: sErr } = await supabase
      .from("services")
      .select("id, price, home_price_extra, active, duration_minutes, buffer_minutes")
      .eq("id", service_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (sErr || !service) throw new Error("Invalid service.");
    if (!service.active) throw new Error("Service is not active.");

    let travel_fee = 0;
    let resolvedProColor: string | null = null;

    if (booking_mode === "home") {
      if (!professional_id || professional_id === "any") {
        throw new Error("Para atendimento a domicílio, escolha um profissional específico.");
      }

      const { data: professional, error: pErr } = await supabase
        .from("professionals")
        .select("id, offers_home_service, max_home_distance_km, home_fee, home_fee_type, home_fee_per_km, active, agenda_color")
        .eq("id", professional_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (pErr || !professional) throw new Error("Invalid professional.");
      if (!professional.active) throw new Error("Professional is not active.");
      if (!professional.offers_home_service) throw new Error("Este profissional não realiza atendimentos a domicílio.");
      resolvedProColor = professional.agenda_color || null;

      if (!client_lat || !client_lng) {
        throw new Error("Coordenadas do cliente são obrigatórias para atendimento a domicílio.");
      }

      if (!tenantSettings || !tenantSettings.latitude || !tenantSettings.longitude) {
        throw new Error("O salão não possui coordenadas configuradas para calcular a distância.");
      }

      const distanceKm = haversineKm(
        { lat: client_lat, lng: client_lng },
        { lat: tenantSettings.latitude, lng: tenantSettings.longitude }
      );

      const proRadius = professional.max_home_distance_km != null ? Number(professional.max_home_distance_km) : 0;

      if (distanceKm > proRadius + 2.5) {
        throw new Error("A distância solicitada excede o limite de cobertura do profissional.");
      }

      if (professional.home_fee_type === "per_km") {
        travel_fee = (professional.home_fee_per_km || 0) * distanceKm;
      } else {
        travel_fee = professional.home_fee || 0;
      }
    } else {
      if (professional_id && professional_id !== "any") {
        const { data: professional, error: pErr } = await supabase
          .from("professionals")
          .select("id, active, agenda_color")
          .eq("id", professional_id)
          .eq("tenant_id", tenant_id)
          .single();

        if (pErr || !professional || !professional.active) throw new Error("Invalid or inactive professional.");
        resolvedProColor = professional.agenda_color || null;
      }
    }

    // ── Validação rigorosa de bloqueios e colisões no backend ─────────────────
    const bookingStart = scheduledDate;
    const durationMinutesTotal = (service.duration_minutes ?? 30) + (service.buffer_minutes ?? 0);
    const bookingEnd = new Date(bookingStart.getTime() + durationMinutesTotal * 60 * 1000);
    const targetProId = professional_id && professional_id !== "any" ? professional_id : null;

    // 1. Valida se o profissional ou o salão possui bloqueio ativo no intervalo
    let blockQuery = supabase
      .from("professional_blocked_times")
      .select("id")
      .eq("tenant_id", tenant_id)
      .lt("starts_at", bookingEnd.toISOString())
      .gt("ends_at", bookingStart.toISOString());

    if (targetProId) {
      blockQuery = blockQuery.or(`professional_id.eq.${targetProId},professional_id.is.null`);
    }

    const { data: activeBlocks } = await blockQuery.limit(1);
    if (activeBlocks && activeBlocks.length > 0) {
      throw new Error("Este horário ou dia está bloqueado para agendamentos. Por favor, escolha outro horário.");
    }

    // 2. Valida se já existe agendamento ativo concorrente no mesmo intervalo
    if (targetProId) {
      const searchWindowStart = new Date(bookingStart.getTime() - 240 * 60 * 1000).toISOString();
      const { data: existingBookings } = await supabase
        .from("bookings")
        .select("id, scheduled_at, duration_minutes, buffer_minutes")
        .eq("tenant_id", tenant_id)
        .eq("professional_id", targetProId)
        .in("status", ["confirmed", "pending"])
        .lt("scheduled_at", bookingEnd.toISOString())
        .gt("scheduled_at", searchWindowStart);

      const hasCollision = (existingBookings || []).some((b: any) => {
        const bStart = new Date(b.scheduled_at);
        const bDur = (b.duration_minutes ?? 30) + (b.buffer_minutes ?? 0);
        const bEnd = new Date(bStart.getTime() + bDur * 60 * 1000);
        return bookingStart.getTime() < bEnd.getTime() && bookingEnd.getTime() > bStart.getTime();
      });

      if (hasCollision) {
        throw new Error("Este horário acabou de ser preenchido por outro cliente. Por favor, escolha outro horário.");
      }
    }

    const serviceHomeExtra = booking_mode === "home" ? (service.home_price_extra || 0) : 0;
    const amount_total = (service.price || 0) + serviceHomeExtra + travel_fee;
    const depositPct = (tenantSettings?.deposit_percentage ?? 50) / 100;

    let amount_paid = 0;
    if (payment_scope === "full" && payment_method !== "cash") {
      amount_paid = amount_total;
    } else if (payment_scope === "partial" && payment_method !== "cash") {
      amount_paid = amount_total * depositPct;
    }

    let customerId = null;
    let cleanPhone = (customer.phone || "").replace(/\D/g, "");
    const VALID_BR_DDDS = new Set([
      "11", "12", "13", "14", "15", "16", "17", "18", "19",
      "21", "22", "24", "27", "28",
      "31", "32", "33", "34", "35", "37", "38",
      "41", "42", "43", "44", "45", "46", "47", "48", "49",
      "51", "53", "54", "55",
      "61", "62", "63", "64", "65", "66", "67", "68", "69",
      "71", "73", "74", "75", "77", "79",
      "81", "82", "83", "84", "85", "86", "87", "88", "89",
      "91", "92", "93", "94", "95", "96", "97", "98", "99",
    ]);

    if (
      (cleanPhone.length === 12 || cleanPhone.length === 13) &&
      cleanPhone.startsWith("55") &&
      VALID_BR_DDDS.has(cleanPhone.slice(2, 4))
    ) {
      cleanPhone = cleanPhone.slice(2);
    }

    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      throw new Error("Informe um telefone válido com DDD (ex: (27) 99999-9999).");
    }

    const ddd = cleanPhone.slice(0, 2);
    if (!VALID_BR_DDDS.has(ddd)) {
      throw new Error(`O DDD (${ddd}) informado não é válido no Brasil. Confira o seu número.`);
    }

    if (cleanPhone.length === 11 && cleanPhone[2] !== "9") {
      throw new Error("Celular com 9 dígitos deve começar com 9 após o DDD. Ex: (27) 99999-9999.");
    }

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const updateCustomerFields: Record<string, any> = {};
      if (customer.name?.trim()) updateCustomerFields.name = customer.name.trim();
      if (customer.email) updateCustomerFields.email = customer.email;
      if (Object.keys(updateCustomerFields).length > 0) {
        await supabase.from("customers").update(updateCustomerFields).eq("id", customerId);
      }
    } else {
      const { data: newCustomer, error: cErr } = await supabase
        .from("customers")
        .insert([
          {
            tenant_id: tenant_id,
            name: customer.name,
            phone: cleanPhone,
            email: customer.email,
          },
        ])
        .select("id")
        .single();
      if (cErr) throw cErr;
      customerId = newCustomer.id;
    }

    // Limpar rascunhos pendentes abandonados (mesmo cliente no mesmo horário ou rascunhos online > 15 min sem pagamento)
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: staleBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("status", "pending")
        .in("payment_mode", ["deposit", "full"])
        .or(`created_at.lt.${fifteenMinAgo},customer_id.eq.${customerId}`);

      if (staleBookings && staleBookings.length > 0) {
        const staleIds = staleBookings.map((b: any) => b.id);
        await supabase.from("payments").delete().in("booking_id", staleIds).eq("status", "pending");
        await supabase.from("bookings").delete().in("id", staleIds).eq("status", "pending");
      }
    } catch (_) {
      // Non-blocking cleanup
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const accessCode = Math.random().toString(36).substring(2, 12);
    const isOnlinePending = payment_scope !== "local" && payment_method !== "cash";
    const resolvedPaymentMethod =
      payment_scope === "local" || payment_method === "cash"
        ? "local"
        : payment_method === "card"
          ? "card"
          : "pix";

    const { data: newBooking, error: bErr } = await supabase
      .from("bookings")
      .insert([
        {
          tenant_id: tenant_id,
          customer_id: customerId,
          professional_id: professional_id === "any" ? null : professional_id,
          service_id: service_id,
          order_number: code,
          scheduled_at: scheduled_at,
          duration_minutes: service.duration_minutes ?? 30,
          buffer_minutes: service.buffer_minutes ?? 0,
          pro_color: resolvedProColor,
          status: isOnlinePending ? "pending" : "confirmed",
          confirmation_status: "pending",
          booking_source: "online",
          payment_method: resolvedPaymentMethod,
          payment_status: "pending",
          payment_mode:
            payment_scope === "full"
              ? "full"
              : payment_scope === "partial"
                ? "deposit"
                : "local",
          amount_paid: amount_paid,
          amount_total: amount_total,
          amount_due: isOnlinePending ? amount_total : amount_total,
          notes: customer_notes,
          access_code: accessCode,
          service_location: booking_mode,
          client_address: booking_mode === "home" ? client_address : null,
          client_lat: booking_mode === "home" ? client_lat : null,
          client_lng: booking_mode === "home" ? client_lng : null,
          travel_fee: booking_mode === "home" ? travel_fee : 0,
        },
      ])
      .select("id, order_number, amount_total")
      .single();

    if (bErr) throw bErr;

    // Dispara Web Push apenas se o agendamento já nasceu confirmado (pagamento local)
    if (!isOnlinePending && newBooking?.id) {
      await dispatchBookingPushEvent(supabase, newBooking.id, "booking_new").catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking: newBooking,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
