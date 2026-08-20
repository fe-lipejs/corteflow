import { supabase } from '../integrations/supabase/client';

// Generate or retrieve persistent anonymous visitor ID
function getVisitorId(): string {
  const STORAGE_KEY = 'cf_visitor_id';
  let visitorId = localStorage.getItem(STORAGE_KEY);
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, visitorId);
  }
  return visitorId;
}

// Generate or retrieve session ID (expires when tab/browser closes)
function getSessionId(): string {
  const SESSION_KEY = 'cf_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Detect device type
function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
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
function getBrowser(): string {
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

// Detect OS
function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
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

export interface TrackEventOptions {
  eventType?: 'page_view' | 'click' | 'conversion';
  pagePath?: string;
  pageTitle?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

/**
 * Send an analytics event to Supabase asynchronously (fire-and-forget)
 */
export async function trackEvent(eventName: string, options: TrackEventOptions = {}) {
  try {
    const {
      eventType = 'click',
      pagePath = window.location.pathname,
      pageTitle = document.title,
      metadata = {},
      tenantId,
    } = options;

    const utm = getUTMParams();
    const visitor_id = getVisitorId();
    const session_id = getSessionId();
    const device_type = getDeviceType();
    const browser = getBrowser();
    const os = getOS();
    const screen_resolution = `${window.screen.width}x${window.screen.height}`;
    const referrer = document.referrer ? new URL(document.referrer, window.location.origin).hostname : 'Direto';

    const payload = {
      visitor_id,
      session_id,
      event_type: eventType,
      event_name: eventName,
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
      metadata,
      tenant_id: tenantId || null,
    };

    // Non-blocking insert
    supabase
      .from('analytics_events')
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          console.warn('[Analytics] Failed to send event:', error.message);
        }
      });
  } catch (err) {
    // Fail silently so user experience is never affected
    console.warn('[Analytics Error]', err);
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
