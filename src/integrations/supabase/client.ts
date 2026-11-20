import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env as any).VITE_SUPABASE_UR ||
  'https://paefckmkawocjxzuoclq.supabase.co'
).replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODM5MDUsImV4cCI6MjEwMDU1OTkwNX0.9_FCFsaktXqmAyFcQi4jENaxj2TF2xRNREREwUN8Pio';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * ─── Proxy de contingência (/sb) ─────────────────────────────────────────────
 * Algumas operadoras/redes no Brasil (principalmente 4G/5G Vivo, Claro, TIM e provedores
 * regionais) bloqueiam ou perdem rota para os IPs da Cloudflare usados pelo domínio
 * *.supabase.co (bloqueios judiciais em IPs compartilhados da Cloudflare, falhas de
 * DNS/BGP, etc). O site (raffros.com, hospedado na Vercel) continua abrindo, mas toda
 * chamada direta ao Supabase falha com "Failed to fetch" / "Load failed" ou trava.
 *
 * Solução:
 * 1) Na abertura do app, uma sonda leve testa a conexão direta ao Supabase em 3,2s.
 *    Se a rede bloquear *.supabase.co, já ativa o proxy /sb antes mesmo do usuário
 *    clicar em "Entrar" ou "Confirmar agendamento".
 * 2) Qualquer chamada que falhar por erro de rede ou timeout é repetida automaticamente
 *    pelo nosso próprio domínio (/sb/...), que a Vercel/Netlify/Vite repassa ao Supabase.
 */
const PROXY_PREF_KEY = 'raffros_sb_proxy_until';
const PROXY_PREF_TTL_MS = 6 * 60 * 60 * 1000; // lembra a preferência por 6h
const DIRECT_TIMEOUT_MS = 6000; // 6s: rota direta travada ("buraco negro") → cai no proxy /sb

const isBrowser = typeof window !== 'undefined';
const proxyBaseUrl = isBrowser ? `${window.location.origin}/sb` : null;

function shouldUseProxyNow(): boolean {
  if (!isBrowser) return false;
  try {
    const until = Number(window.localStorage.getItem(PROXY_PREF_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function rememberProxy() {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(PROXY_PREF_KEY, String(Date.now() + PROXY_PREF_TTL_MS));
  } catch {
    // ignore
  }
}

function clearProxyPref() {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(PROXY_PREF_KEY);
  } catch {
    // ignore
  }
}

function isNetworkError(err: any): boolean {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('fetch error') ||
    msg.includes('direct-timeout')
  );
}

function toProxyUrl(url: string): string {
  return proxyBaseUrl ? proxyBaseUrl + url.slice(supabaseUrl.length) : url;
}

/**
 * Verifica se a resposta do proxy não caiu no fallback HTML do SPA (index.html),
 * o que aconteceria apenas em um ambiente onde a regra /sb/* não estivesse ativa.
 */
function isInvalidSpaHtmlFallback(url: string, res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('text/html')) return false;
  return (
    url.includes('/rest/v1/') ||
    url.includes('/auth/v1/') ||
    url.includes('/functions/v1/')
  );
}

/**
 * Define quais chamadas podem receber timeout rápido na tentativa direta antes de cair no proxy:
 * - Qualquer GET / HEAD / OPTIONS
 * - Qualquer chamada de autenticação (/auth/v1/* — login, refresh token, recover, resend)
 * - RPCs de leitura (/rest/v1/rpc/get_*, /rest/v1/rpc/check_*) que o PostgREST envia via POST
 */
function canTimeoutDirectCall(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (url.includes('/auth/v1/')) return true;
  if (
    url.includes('/rest/v1/rpc/get_') ||
    url.includes('/rest/v1/rpc/check_')
  ) {
    return true;
  }
  return false;
}

async function fetchDirectWithTimeout(url: string, init: RequestInit | undefined): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  if (!canTimeoutDirectCall(url, method)) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const externalSignal = init?.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, DIRECT_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (timedOut && !externalSignal?.aborted) {
      throw new TypeError('direct-timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const resilientFetch: typeof fetch = async (input, init) => {
  let url: string | null = null;
  let mergedInit: RequestInit | undefined = init;

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (typeof Request !== 'undefined' && input instanceof Request) {
    url = input.url;
    if (!mergedInit) {
      mergedInit = {
        method: input.method,
        headers: input.headers,
        signal: input.signal,
      };
    }
  }

  // URLs que não são do Supabase: comportamento padrão.
  if (!url || !proxyBaseUrl || !url.startsWith(supabaseUrl)) {
    return fetch(input as any, init);
  }

  // Rede já identificada como bloqueada → vai direto pelo proxy /sb.
  if (shouldUseProxyNow()) {
    try {
      const proxied = await fetch(toProxyUrl(url), mergedInit);
      if (isInvalidSpaHtmlFallback(url, proxied)) {
        clearProxyPref();
        return fetch(url, mergedInit);
      }
      return proxied;
    } catch (proxyErr) {
      // Se o proxy falhar (ex.: oscilação total), tenta direto uma vez
      return fetch(url, mergedInit);
    }
  }

  try {
    return await fetchDirectWithTimeout(url, mergedInit);
  } catch (err: any) {
    if (!isNetworkError(err) || mergedInit?.signal?.aborted) throw err;
    // Falha de rede ao alcançar *.supabase.co → repete pelo domínio próprio (/sb).
    const proxied = await fetch(toProxyUrl(url), mergedInit);
    if (isInvalidSpaHtmlFallback(url, proxied)) {
      throw err;
    }
    rememberProxy();
    return proxied;
  }
};

// Sonda preventiva em background ao abrir o app: se a operadora bloquear *.supabase.co,
// já ativa o modo proxy (/sb) antes do primeiro clique em "Entrar" ou "Confirmar agendamento".
if (isBrowser && !shouldUseProxyNow()) {
  const probeController = new AbortController();
  const probeTimer = setTimeout(() => probeController.abort(), 3200);
  fetch(`${supabaseUrl}/auth/v1/health`, {
    method: 'GET',
    headers: { apikey: supabaseAnonKey },
    signal: probeController.signal,
  })
    .then(() => clearTimeout(probeTimer))
    .catch(() => {
      clearTimeout(probeTimer);
      if (! proxyBaseUrl) return;
      // Verifica se o proxy /sb responde JSON válido antes de ativar
      fetch(`${proxyBaseUrl}/auth/v1/health`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey },
      })
        .then((res) => {
          if (!isInvalidSpaHtmlFallback('/auth/v1/health', res)) {
            rememberProxy();
          }
        })
        .catch(() => {});
    });
}

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: resilientFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Converte erros técnicos de rede em mensagem amigável para o usuário final. */
export function friendlyNetworkError(message?: string | null): string | null {
  if (!message) return null;
  const msg = message.toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('functionsfetcherror') ||
    msg.includes('failed to send a request to the edge function')
  ) {
    return 'Instabilidade na conexão com o servidor. Verifique sua internet e tente novamente em alguns segundos.';
  }
  return message;
}

export type { Database };
