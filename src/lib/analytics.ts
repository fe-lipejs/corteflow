import { supabase } from '../integrations/supabase/client';
import { getStoredCookiePreferences } from '../components/cookies/CookieConsentBanner';

// Generate or retrieve persistent anonymous visitor ID (non-invasive random token)
function getVisitorId(): string {
  try {
    const STORAGE_KEY = 'cf_visitor_id';
    let visitorId = localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return 'v_anon';
  }
}

// Generate or retrieve session ID (expires after 30 min of inactivity or when tab closes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function getAnalyticsSessionId(scope: string = 'global'): string {
  try {
    const SESSION_KEY = `cf_session_id_${scope}`;
    const LAST_ACTIVE_KEY = `cf_session_ts_${scope}`;
    const now = Date.now();
    const lastActive = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || 0);
    let sessionId = sessionStorage.getItem(SESSION_KEY);

    if (!sessionId || (lastActive > 0 && now - lastActive > SESSION_TIMEOUT_MS)) {
      sessionId = 's_' + Math.random().toString(36).substring(2, 11) + '_' + now.toString(36);
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(now));
    return sessionId;
  } catch {
    return 's_anon';
  }
}

// Detect device type (aggregated classification, no invasive fingerprinting)
export function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// Detect browser
export function getBrowser(): string {
  if (typeof navigator === 'undefined') return 'Outro';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge') || ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Outro';
}

// Detect OS (accurate iOS / Android / Windows / macOS detection)
export function getOS(): string {
  if (typeof navigator === 'undefined') return 'Outro';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Win/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) {
    // iPadOS 13+ reports MacIntel with touch points
    if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
      return 'iOS';
    }
    return 'macOS';
  }
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Outro';
}

// Parse UTM parameters from URL
function getUTMParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
    };
  } catch {
    return {};
  }
}

// Sanitize metadata to guarantee LGPD compliance (strip any accidental PII keys)
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'senha',
  'phone',
  'telefone',
  'whatsapp',
  'email',
  'cpf',
  'card',
  'card_number',
  'cvv',
  'customer_name',
  'client_name',
  'notes',
  'observacoes',
  'address_full',
]);

function sanitizeMetadata(meta?: Record<string, any>): Record<string, any> {
  if (!meta || typeof meta !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_METADATA_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === 'string' && v.length > 160) {
      clean[k] = v.slice(0, 160);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export type AnalyticsSource = 'portal' | 'admin' | 'marketing';

export interface TrackEventOptions {
  eventType?: 'page_view' | 'click' | 'conversion';
  source?: AnalyticsSource;
  pagePath?: string;
  pageTitle?: string;
  metadata?: Record<string, any>;
  tenantId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  bookingId?: string | null;
  stepName?: string | null;
  durationMs?: number | null;
  elementId?: string | null;
  dedupeWindowMs?: number;
}

// Anti-duplication map for React StrictMode & rapid double-renders
const recentEventTimestamps = new Map<string, number>();

/**
 * Send an analytics event to Supabase asynchronously (fire-and-forget, non-blocking)
 */
export async function trackEvent(eventName: string, options: TrackEventOptions = {}) {
  try {
    if (typeof window === 'undefined') return;

    // Respect LGPD cookie preferences if explicitly rejected by visitor on marketing pages
    const prefs = getStoredCookiePreferences();
    if (prefs && prefs.statistics === false && (!options.source || options.source === 'marketing')) {
      return;
    }

    const {
      eventType = 'click',
      source = options.tenantId
        ? window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/app')
          ? 'admin'
          : 'portal'
        : 'marketing',
      pagePath = window.location.pathname,
      pageTitle = document.title,
      metadata = {},
      tenantId = null,
      userId = null,
      userRole = null,
      bookingId = null,
      stepName = null,
      durationMs = null,
      elementId = null,
      dedupeWindowMs = eventType === 'page_view' ? 1800 : 350,
    } = options;

    const sessionScope = tenantId ? `${source}_${tenantId}` : source;
    const session_id = getAnalyticsSessionId(sessionScope);

    // Deduplication check
    const dedupeKey = `${session_id}:${eventName}:${pagePath}:${stepName || ''}:${elementId || ''}`;
    const now = Date.now();
    const prevTs = recentEventTimestamps.get(dedupeKey);
    if (prevTs && now - prevTs < dedupeWindowMs) {
      return;
    }
    recentEventTimestamps.set(dedupeKey, now);

    const utm = getUTMParams();
    const visitor_id = getVisitorId();
    const device_type = getDeviceType();
    const browser = getBrowser();
    const os = getOS();
    const screen_resolution = `${window.screen.width}x${window.screen.height}`;
    let referrer = 'Direto';
    try {
      if (document.referrer) {
        referrer = new URL(document.referrer, window.location.origin).hostname || 'Direto';
      }
    } catch {
      referrer = 'Direto';
    }

    const payload: Record<string, any> = {
      visitor_id,
      session_id,
      event_type: eventType,
      event_name: eventName,
      source,
      page_path: pagePath,
      page_title: pageTitle,
      referrer,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      device_type,
      browser,
      os,
      screen_resolution,
      metadata: sanitizeMetadata(metadata),
      tenant_id: tenantId || null,
      user_id: userId || null,
      user_role: userRole || null,
      booking_id: bookingId || null,
      step_name: stepName || null,
      duration_ms: durationMs != null ? Math.round(Math.max(0, durationMs)) : null,
      element_id: elementId || null,
      created_at: new Date().toISOString(),
    };

    // Non-blocking fire-and-forget insert
    supabase
      .from('analytics_events')
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          // Silently ignore in production so UX is never disrupted
          console.debug('[Raffros Analytics]', error.message);
        }
      });
  } catch {
    // Fail silently so user experience is never affected
  }
}

/**
 * Track a page view
 */
export function trackPageView(pagePath?: string, metadata?: Record<string, any>) {
  trackEvent('view_page', {
    eventType: 'page_view',
    pagePath: pagePath || window.location.pathname,
    pageTitle: document.title,
    metadata,
  });
}

/**
 * Active Dwell Time Tracker (excludes periods of inactivity > 60s)
 */
export class ActiveDwellTracker {
  private lastTick: number = Date.now();
  private lastInteraction: number = Date.now();
  private accumulatedMs: number = 0;
  private isIdle: boolean = false;
  private readonly idleThresholdMs: number;

  constructor(idleThresholdMs = 60000) {
    this.idleThresholdMs = idleThresholdMs;
  }

  public recordInteraction = () => {
    const now = Date.now();
    if (!this.isIdle && document.visibilityState === 'visible') {
      const delta = now - this.lastTick;
      if (delta > 0 && delta < this.idleThresholdMs) {
        this.accumulatedMs += delta;
      }
    }
    this.isIdle = false;
    this.lastInteraction = now;
    this.lastTick = now;
  };

  public getActiveDurationMs(): number {
    const now = Date.now();
    if (!this.isIdle && document.visibilityState === 'visible') {
      const sinceInteraction = now - this.lastInteraction;
      if (sinceInteraction <= this.idleThresholdMs) {
        const delta = now - this.lastTick;
        if (delta > 0) {
          this.accumulatedMs += delta;
        }
      } else {
        this.isIdle = true;
      }
    }
    this.lastTick = now;
    return Math.round(this.accumulatedMs);
  }

  public reset(): number {
    const total = this.getActiveDurationMs();
    this.accumulatedMs = 0;
    this.lastTick = Date.now();
    this.lastInteraction = Date.now();
    this.isIdle = false;
    return total;
  }
}
