import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  dispatchBookingPushEvent,
  getOrProvisionVapidCredentials,
  sendWebPushNotification,
  type BookingPushEventType,
} from "../_shared/webpush.ts";

function getSaoPauloDateInfo(date: Date): { dateKey: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "08";

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: parseInt(hourStr, 10) || 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get_vapid_public_key";

    // ── 1. Get VAPID Public Key ─────────────────────────────────────────────────
    if (action === "get_vapid_public_key") {
      const vapid = await getOrProvisionVapidCredentials(supabaseAdmin);
      return new Response(
        JSON.stringify({ publicKey: vapid.publicKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Dispatch Booking Event (can be called internally or after booking actions) ──
    if (action === "dispatch_booking_event") {
      const { bookingId, eventType } = body as {
        bookingId?: string;
        eventType?: BookingPushEventType;
      };
      if (!bookingId || !eventType) {
        return new Response(
          JSON.stringify({ error: "bookingId and eventType are required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const stats = await dispatchBookingPushEvent(supabaseAdmin, bookingId, eventType);
      return new Response(
        JSON.stringify({ success: true, ...stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Process Scheduled Notifications (Upcoming Reminders & Daily Summary) ──
    if (action === "process_scheduled_notifications") {
      const targetTenantId = body.tenantId as string | undefined;
      const now = new Date();
      const in65Min = new Date(now.getTime() + 65 * 60 * 1000);
      const { dateKey: todayKey, hour: currentHourSP } = getSaoPauloDateInfo(now);

      let remindersSent = 0;
      let summariesSent = 0;

      // 3A. Upcoming Booking Reminders (within next 65 minutes, filtered per user preference inside dispatchBookingPushEvent)
      let upcomingQuery = supabaseAdmin
        .from("bookings")
        .select("id, tenant_id, scheduled_at, status")
        .eq("status", "confirmed")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in65Min.toISOString());

      if (targetTenantId) {
        upcomingQuery = upcomingQuery.eq("tenant_id", targetTenantId);
      }

      const { data: upcomingBookings } = await upcomingQuery;
      for (const bk of upcomingBookings || []) {
        const res = await dispatchBookingPushEvent(supabaseAdmin, bk.id, "booking_reminder");
        remindersSent += res.sent;
      }

      // 3B. Daily Summary (only between 07:00 and 11:59 Sao Paulo time, or if forceDailySummary is true)
      if ((currentHourSP >= 7 && currentHourSP <= 11) || body.forceDailySummary === true) {
        let subQuery = supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .eq("is_active", true);

        if (targetTenantId) {
          subQuery = subQuery.eq("tenant_id", targetTenantId);
        }

        const { data: activeSubs } = await subQuery;
        if (activeSubs && activeSubs.length > 0) {
          const vapid = await getOrProvisionVapidCredentials(supabaseAdmin);
          const dayStartSP = `${todayKey}T00:00:00-03:00`;
          const dayEndSP = `${todayKey}T23:59:59-03:00`;

          // Group subscriptions by tenant_id
          const subsByTenant = new Map<string, any[]>();
          for (const s of activeSubs) {
            const arr = subsByTenant.get(s.tenant_id) || [];
            arr.push(s);
            subsByTenant.set(s.tenant_id, arr);
          }

          for (const [tId, tSubs] of subsByTenant.entries()) {
            const { data: dayBookings } = await supabaseAdmin
              .from("bookings")
              .select("id, professional_id, scheduled_at, status, customers(name), services(name)")
              .eq("tenant_id", tId)
              .in("status", ["confirmed", "arrived", "in_progress", "completed"])
              .gte("scheduled_at", new Date(dayStartSP).toISOString())
              .lte("scheduled_at", new Date(dayEndSP).toISOString())
              .order("scheduled_at", { ascending: true });

            if (!dayBookings || dayBookings.length === 0) continue;

            const userIds = Array.from(new Set(tSubs.map((s: any) => s.user_id)));
            const { data: prefs } = await supabaseAdmin
              .from("push_notification_preferences")
              .select("*")
              .eq("tenant_id", tId)
              .in("user_id", userIds);

            const prefMap = new Map<string, any>();
            for (const pf of prefs || []) prefMap.set(pf.user_id, pf);

            const { data: pros } = await supabaseAdmin
              .from("professionals")
              .select("id, auth_user_id, permissions")
              .eq("tenant_id", tId);

            const proByUser = new Map<string, any>();
            for (const p of pros || []) {
              if (p.auth_user_id) proByUser.set(p.auth_user_id, p);
            }

            for (const sub of tSubs) {
              const pref = prefMap.get(sub.user_id);
              if (pref && (pref.push_enabled === false || pref.notify_daily_summary === false)) {
                continue;
              }

              const pro = proByUser.get(sub.user_id);
              const canViewAll = !pro || Boolean(pro.permissions?.["agenda.visualizar_todos"]);
              const userBookings = canViewAll
                ? dayBookings
                : dayBookings.filter((b: any) => !b.professional_id || b.professional_id === pro.id);

              if (userBookings.length === 0) continue;

              const dedupKey = `daily_summary:${tId}:${sub.user_id}:${todayKey}`;
              const { data: existingLog } = await supabaseAdmin
                .from("push_delivery_logs")
                .select("id")
                .eq("dedup_key", dedupKey)
                .eq("subscription_id", sub.id)
                .maybeSingle();

              if (existingLog) continue;

              const firstBk = userBookings[0];
              const firstTime = new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(firstBk.scheduled_at));

              const count = userBookings.length;
              const summaryTitle = "Resumo do dia • Raffros";
              const summaryBody =
                count === 1
                  ? `Você tem 1 agendamento hoje (às ${firstTime}). Toque para ver sua agenda.`
                  : `Você tem ${count} agendamentos hoje. O primeiro é às ${firstTime}.`;

              const sendRes = await sendWebPushNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                  title: summaryTitle,
                  body: summaryBody,
                  url: `/admin/agenda?date=${todayKey}`,
                  tag: dedupKey,
                  bookingId: firstBk.id,
                  tenantId: tId,
                  eventType: "daily_summary",
                },
                vapid
              );

              if (sendRes.ok) {
                summariesSent++;
                await supabaseAdmin.from("push_delivery_logs").upsert(
                  {
                    tenant_id: tId,
                    user_id: sub.user_id,
                    subscription_id: sub.id,
                    booking_id: firstBk.id,
                    event_type: "daily_summary",
                    dedup_key: dedupKey,
                    status: "sent",
                    status_code: sendRes.statusCode,
                  },
                  { onConflict: "dedup_key,subscription_id" }
                );
              } else if (sendRes.expired) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .update({ is_active: false, updated_at: new Date().toISOString() })
                  .eq("id", sub.id);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, remindersSent, summariesSent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Authenticated User Actions (subscribe, unsubscribe, send_test) ──────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ── 4. Register / Update Push Subscription ──────────────────────────────────
    if (action === "subscribe") {
      const {
        tenantId,
        professionalId,
        subscription,
        deviceName,
        platform,
        userAgent,
      } = body;

      if (!tenantId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return new Response(
          JSON.stringify({ error: "Dados de assinatura Push incompletos." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const nowIso = new Date().toISOString();

      const { data: subRow, error: subErr } = await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            tenant_id: tenantId,
            professional_id: professionalId || null,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            device_name: deviceName || "Dispositivo",
            platform: platform || "web",
            user_agent: userAgent || null,
            is_active: true,
            updated_at: nowIso,
            last_used_at: nowIso,
          },
          { onConflict: "user_id,tenant_id,endpoint" }
        )
        .select("*")
        .single();

      if (subErr) throw subErr;

      // Ensure user preferences exist for this tenant
      await supabaseAdmin.from("push_notification_preferences").upsert(
        {
          user_id: user.id,
          tenant_id: tenantId,
          push_enabled: true,
          updated_at: nowIso,
        },
        { onConflict: "user_id,tenant_id" }
      );

      return new Response(
        JSON.stringify({ success: true, subscription: subRow, device: subRow }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Send Test Notification to User's Active Devices ──────────────────────
    if (action === "send_test") {
      const { tenantId } = body;
      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: "tenantId é obrigatório." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: userSubs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (!userSubs || userSubs.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum dispositivo ativo encontrado para envio do teste." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Also check if there is a real upcoming booking to link to in the test
      const { data: sampleBooking } = await supabaseAdmin
        .from("bookings")
        .select("id, scheduled_at")
        .eq("tenant_id", tenantId)
        .neq("status", "canceled")
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { dateKey: todayKey } = getSaoPauloDateInfo(
        sampleBooking?.scheduled_at ? new Date(sampleBooking.scheduled_at) : new Date()
      );
      const targetUrl = sampleBooking?.id
        ? `/admin/agenda?bookingId=${sampleBooking.id}&date=${todayKey}`
        : `/admin/agenda?date=${todayKey}`;

      const vapid = await getOrProvisionVapidCredentials(supabaseAdmin);
      let delivered = 0;

      for (const sub of userSubs) {
        const res = await sendWebPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: "Notificações Push ativas!",
            body: "Seu dispositivo está conectado ao Raffros. Toque para abrir a agenda.",
            url: targetUrl,
            tag: `test:${sub.id}:${Date.now()}`,
            bookingId: sampleBooking?.id || null,
            tenantId,
            eventType: "test",
          },
          vapid
        );

        if (res.ok) {
          delivered++;
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", sub.id);
        } else if (res.expired) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
      }

      return new Response(
        JSON.stringify({ success: delivered > 0, delivered, sent: delivered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (err: any) {
    console.error("[push-notifications] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno em push-notifications" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

