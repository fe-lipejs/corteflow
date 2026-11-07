// ============================================================================
// Native Web Crypto RFC 8291 (aes128gcm) + RFC 8292 (VAPID ES256) Web Push Engine
// Zero external npm dependencies — compatible with Android (FCM) & iOS 16.4+ (APNs)
// ============================================================================

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((acc, a) => acc + a.byteLength, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, data.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

async function hkdfExtractAndExpand(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const infoWithCounter = concatBytes(info, new Uint8Array([1]));
  const okm = await hmacSha256(prk, infoWithCounter);
  return okm.slice(0, length);
}

export interface VapidCredentials {
  publicKey: string;
  privateKeyJwk: JsonWebKey;
  subject: string;
}

/**
 * Resolves VAPID credentials:
 * 1. First checks Supabase Secrets (VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY).
 * 2. Otherwise reads or auto-generates P-256 VAPID keys in public.system_vapid_config (service_role only).
 */
export async function getOrProvisionVapidCredentials(supabaseAdmin: any): Promise<VapidCredentials> {
  const envPublic = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const envPrivate = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  const envSubject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:contato@raffros.com";

  if (envPublic && envPrivate) {
    try {
      // Check if envPrivate is already JSON JWK or raw 32-byte base64url
      if (envPrivate.startsWith("{")) {
        const jwk = JSON.parse(envPrivate);
        return { publicKey: envPublic, privateKeyJwk: jwk, subject: envSubject };
      }
      const pubBytes = base64UrlDecode(envPublic);
      if (pubBytes.length === 65 && pubBytes[0] === 0x04) {
        const x = base64UrlEncode(pubBytes.slice(1, 33));
        const y = base64UrlEncode(pubBytes.slice(33, 65));
        const privateKeyJwk: JsonWebKey = {
          kty: "EC",
          crv: "P-256",
          x,
          y,
          d: envPrivate,
          ext: true,
        };
        return { publicKey: envPublic, privateKeyJwk, subject: envSubject };
      }
    } catch (err) {
      console.warn("[webpush] Failed to parse env VAPID keys, falling back to DB:", err);
    }
  }

  // Fallback to service_role-only DB table
  const { data: existing } = await supabaseAdmin
    .from("system_vapid_config")
    .select("public_key, private_key_jwk, subject")
    .eq("id", 1)
    .maybeSingle();

  if (existing?.public_key && existing?.private_key_jwk) {
    return {
      publicKey: existing.public_key,
      privateKeyJwk: existing.private_key_jwk,
      subject: existing.subject || envSubject,
    };
  }

  // Auto-generate P-256 ECDSA keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKeyB64 = base64UrlEncode(rawPublic);

  await supabaseAdmin.from("system_vapid_config").upsert({
    id: 1,
    public_key: publicKeyB64,
    private_key_jwk: privateJwk,
    subject: envSubject,
  });

  return {
    publicKey: publicKeyB64,
    privateKeyJwk: privateJwk,
    subject: envSubject,
  };
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: nowSec + 12 * 3600,
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Encrypts a UTF-8 string payload according to RFC 8291 (aes128gcm)
 */
async function encryptWebPushPayload(
  payloadText: string,
  clientPublicKeyB64: string,
  clientAuthB64: string
): Promise<Uint8Array> {
  const clientPublicBytes = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(clientAuthB64);

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicBytes.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 Section 3.3: IKM derivation
  const keyInfo = concatBytes(
    encoder.encode("WebPush: info\0"),
    clientPublicBytes,
    serverPublicBytes
  );
  const ikm = await hkdfExtractAndExpand(authSecret, sharedSecret, keyInfo, 32);

  // CEK & Nonce derivation
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const cekBytes = await hkdfExtractAndExpand(salt, ikm, cekInfo, 16);
  const nonceBytes = await hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cekBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Plaintext with 0x02 delimiter
  const plainBytes = concatBytes(encoder.encode(payloadText), new Uint8Array([2]));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBytes.buffer as ArrayBuffer },
    aesKey,
    plainBytes.buffer as ArrayBuffer
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // aes128gcm header: salt (16) + rs (4, uint32 BE = 4096) + idlen (1 = 65) + keyid (65)
  const rsBytes = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096
  const idLenByte = new Uint8Array([serverPublicBytes.byteLength]);

  return concatBytes(salt, rsBytes, idLenByte, serverPublicBytes, ciphertext);
}

export interface PushMessagePayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  bookingId?: string | null;
  tenantId: string;
  eventType: string;
  icon?: string;
  badge?: string;
}

export interface PushSendResult {
  ok: boolean;
  statusCode: number;
  expired: boolean;
  error?: string;
}

export async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  message: PushMessagePayload,
  vapid: VapidCredentials
): Promise<PushSendResult> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const jwt = await createVapidJwt(audience, vapid.subject, vapid.privateKeyJwk);

    const jsonString = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: message.icon || "/icons/icon-192.png",
      badge: message.badge || "/icons/icon-192.png",
      tag: message.tag,
      data: {
        url: message.url,
        bookingId: message.bookingId || null,
        tenantId: message.tenantId,
        eventType: message.eventType,
        tag: message.tag,
      },
    });

    const encryptedBody = await encryptWebPushPayload(
      jsonString,
      subscription.p256dh,
      subscription.auth
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(encryptedBody.byteLength),
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: encryptedBody.buffer as ArrayBuffer,
    });

    const status = response.status;
    if (status >= 200 && status < 300) {
      return { ok: true, statusCode: status, expired: false };
    }

    const errText = await response.text().catch(() => "");
    const expired = status === 404 || status === 410;
    return {
      ok: false,
      statusCode: status,
      expired,
      error: errText || `HTTP ${status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 0,
      expired: false,
      error: err?.message || "Network error sending Web Push",
    };
  }
}

export type BookingPushEventType =
  | "booking_new"
  | "booking_canceled"
  | "booking_rescheduled"
  | "booking_reminder";

function formatSaoPauloDateTime(isoDate: string): { dateParam: string; formattedTime: string } {
  const dateObj = new Date(isoDate);
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateObj);
  const y = dateParts.find((p) => p.type === "year")?.value ?? "2026";
  const m = dateParts.find((p) => p.type === "month")?.value ?? "01";
  const d = dateParts.find((p) => p.type === "day")?.value ?? "01";

  const timeStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);

  return {
    dateParam: `${y}-${m}-${d}`,
    formattedTime: `${d}/${m} às ${timeStr}`,
  };
}

/**
 * Dispatches Web Push notifications to all eligible devices of the tenant for a booking event.
 * Never throws so it can never block booking creation, payment, cancellation, or rescheduling.
 */
export async function dispatchBookingPushEvent(
  supabaseAdmin: any,
  bookingId: string,
  eventType: BookingPushEventType
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        tenant_id,
        customer_id,
        professional_id,
        service_id,
        scheduled_at,
        amount_total,
        status,
        payment_mode,
        payment_status,
        customers(name),
        services(name, price),
        professionals(id, name, auth_user_id, permissions)
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) return { sent, skipped, failed };

    // Rule #10: Never fire 'booking_new' before the booking is confirmed in the database
    if (
      eventType === "booking_new" &&
      booking.status === "pending" &&
      (booking.payment_mode === "deposit" || booking.payment_mode === "full") &&
      (!booking.payment_status || booking.payment_status === "pending")
    ) {
      return { sent, skipped: 1, failed };
    }

    const tenantId = booking.tenant_id;

    // Fetch active push subscriptions for this tenant
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (!subscriptions || subscriptions.length === 0) {
      return { sent, skipped, failed };
    }

    // Fetch all professionals in this tenant to enforce permission isolation
    const { data: tenantPros } = await supabaseAdmin
      .from("professionals")
      .select("id, auth_user_id, permissions, active")
      .eq("tenant_id", tenantId);

    const proByUserId = new Map<string, any>();
    for (const p of tenantPros || []) {
      if (p.auth_user_id) proByUserId.set(p.auth_user_id, p);
    }

    // Fetch user roles in profiles & tenant_users
    const userIds = Array.from(new Set(subscriptions.map((s: any) => s.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, role, tenant_id")
      .in("id", userIds);

    const { data: tenantUsers } = await supabaseAdmin
      .from("tenant_users")
      .select("user_id, role, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("user_id", userIds);

    const { data: prefs } = await supabaseAdmin
      .from("push_notification_preferences")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    const profileMap = new Map<string, any>();
    for (const pr of profiles || []) profileMap.set(pr.id, pr);

    const tenantUserMap = new Map<string, any>();
    for (const tu of tenantUsers || []) tenantUserMap.set(tu.user_id, tu);

    const prefMap = new Map<string, any>();
    for (const pf of prefs || []) prefMap.set(pf.user_id, pf);

    const customerName = (booking.customers as any)?.name || "Cliente";
    const serviceName = (booking.services as any)?.name || "Serviço";
    const proName = (booking.professionals as any)?.name || "Qualquer profissional";
    const { dateParam, formattedTime } = formatSaoPauloDateTime(booking.scheduled_at);
    const targetUrl = `/admin/agenda?bookingId=${booking.id}&date=${dateParam}`;

    const priceVal = booking.amount_total != null ? booking.amount_total : (booking.services as any)?.price;
    const formattedPrice = priceVal != null ? ` (R$ ${Number(priceVal).toFixed(2).replace('.', ',')})` : "";

    let title = "Novo agendamento";
    let body = `${customerName} agendou ${serviceName}${formattedPrice} com ${proName} para ${formattedTime}.`;
    let dedupKey = `${eventType}:${booking.id}`;

    if (eventType === "booking_canceled") {
      title = "Agendamento cancelado";
      body = `O agendamento de ${customerName} (${serviceName}${formattedPrice}) em ${formattedTime} foi cancelado.`;
      dedupKey = `booking_canceled:${booking.id}`;
    } else if (eventType === "booking_rescheduled") {
      title = "Agendamento reagendado";
      body = `${customerName} (${serviceName}${formattedPrice}) foi reagendado para ${formattedTime} com ${proName}.`;
      const epochSec = Math.floor(new Date(booking.scheduled_at).getTime() / 1000);
      dedupKey = `booking_rescheduled:${booking.id}:${epochSec}`;
    } else if (eventType === "booking_reminder") {
      title = "Agendamento próximo";
      body = `Lembrete: ${customerName} (${serviceName}${formattedPrice}) às ${formattedTime.split(" às ")[1] || formattedTime} com ${proName}.`;
      const epochSec = Math.floor(new Date(booking.scheduled_at).getTime() / 1000);
      dedupKey = `booking_reminder:${booking.id}:${epochSec}`;
    }

    const vapid = await getOrProvisionVapidCredentials(supabaseAdmin);
    const minutesUntilBooking =
      (new Date(booking.scheduled_at).getTime() - Date.now()) / (60 * 1000);

    for (const sub of subscriptions) {
      const userId = sub.user_id;
      const userProfile = profileMap.get(userId);
      const userTenantRole = tenantUserMap.get(userId)?.role;
      const userPro = proByUserId.get(userId);
      const userPref = prefMap.get(userId);

      // 1. Check professional scope isolation
      const effectiveRole = userTenantRole || userProfile?.role;
      const isOwnerOrManager =
        effectiveRole === "owner" ||
        effectiveRole === "admin" ||
        effectiveRole === "manager" ||
        userProfile?.role === "super_admin";

      if (!isOwnerOrManager && userPro) {
        const canViewAll = Boolean(userPro.permissions?.["agenda.visualizar_todos"]);
        if (!canViewAll && booking.professional_id && booking.professional_id !== userPro.id) {
          skipped++;
          continue;
        }
      }

      // 2. Check user notification preferences
      if (userPref) {
        if (userPref.push_enabled === false) {
          skipped++;
          continue;
        }
        if (eventType === "booking_new" && userPref.notify_new_booking === false) {
          skipped++;
          continue;
        }
        if (eventType === "booking_canceled" && userPref.notify_cancellation === false) {
          skipped++;
          continue;
        }
        if (eventType === "booking_rescheduled" && userPref.notify_reschedule === false) {
          skipped++;
          continue;
        }
        if (eventType === "booking_reminder" && userPref.notify_reminder === false) {
          skipped++;
          continue;
        }
      }

      // Check per-user reminder window (default 30 min, configurable to 15, 30, or 60 min)
      if (eventType === "booking_reminder") {
        const reminderWindowMin = Number(userPref?.reminder_minutes_before ?? 30);
        if (minutesUntilBooking > reminderWindowMin + 5 || minutesUntilBooking < -5) {
          skipped++;
          continue;
        }
      }

      // 3. Deduplication check in push_delivery_logs
      const { data: existingLog } = await supabaseAdmin
        .from("push_delivery_logs")
        .select("id")
        .eq("dedup_key", dedupKey)
        .eq("subscription_id", sub.id)
        .maybeSingle();

      if (existingLog) {
        skipped++;
        continue;
      }

      // 4. Send Web Push
      const res = await sendWebPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title,
          body,
          url: targetUrl,
          tag: dedupKey,
          bookingId: booking.id,
          tenantId,
          eventType,
        },
        vapid
      );

      if (res.ok) {
        sent++;
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);

        await supabaseAdmin.from("push_delivery_logs").upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            subscription_id: sub.id,
            booking_id: booking.id,
            event_type: eventType,
            dedup_key: dedupKey,
            status: "sent",
            status_code: res.statusCode,
          },
          { onConflict: "dedup_key,subscription_id" }
        );
      } else if (res.expired) {
        failed++;
        // Deactivate expired subscription automatically
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);

        await supabaseAdmin.from("push_delivery_logs").upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            subscription_id: sub.id,
            booking_id: booking.id,
            event_type: eventType,
            dedup_key: dedupKey,
            status: "expired_removed",
            status_code: res.statusCode,
            error_message: res.error,
          },
          { onConflict: "dedup_key,subscription_id" }
        );
      } else {
        failed++;
        await supabaseAdmin.from("push_delivery_logs").upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            subscription_id: sub.id,
            booking_id: booking.id,
            event_type: eventType,
            dedup_key: dedupKey,
            status: "failed",
            status_code: res.statusCode,
            error_message: res.error,
          },
          { onConflict: "dedup_key,subscription_id" }
        );
      }
    }
  } catch (err) {
    console.warn("[webpush] Non-blocking error dispatching booking push:", err);
  }

  return { sent, skipped, failed };
}

