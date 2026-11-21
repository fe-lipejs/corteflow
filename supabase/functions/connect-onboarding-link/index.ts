import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getMercadoPagoContext, mpRequest } from '../_shared/stripe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALLBACK_REDIRECT_URI = `${(Deno.env.get('SUPABASE_URL') ?? 'https://paefckmkawocjxzuoclq.supabase.co').replace(/\/+$/, '')}/functions/v1/connect-onboarding-link`;
const DEFAULT_APP_ORIGIN = 'https://raffros.com';
const OAUTH_STATE_TTL_MS = 30 * 60 * 1000;

interface OAuthStatePayload {
  tenantId: string;
  origin: string;
  redirectUri: string;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOAuthHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada para assinatura do OAuth.');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signOAuthState(payload: OAuthStatePayload): Promise<string> {
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getOAuthHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyOAuthState(state: string): Promise<OAuthStatePayload> {
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Parâmetro state inválido.');
  }
  const [encodedPayload, encodedSig] = parts;
  const key = await getOAuthHmacKey();
  const sigBytes = fromBase64Url(encodedSig);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(encodedPayload)
  );
  if (!valid) {
    throw new Error('Assinatura do retorno Mercado Pago inválida.');
  }

  const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as OAuthStatePayload;
  if (!decoded?.tenantId || !decoded?.origin || !decoded?.redirectUri || !decoded?.exp) {
    throw new Error('Dados do state OAuth incompletos.');
  }
  if (Date.now() > Number(decoded.exp)) {
    throw new Error('Sessão de conexão expirada. Clique em Conectar Mercado Pago novamente.');
  }
  return decoded;
}

function redirectResponse(targetUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl,
      'Cache-Control': 'no-store',
    },
  });
}

async function enableTenantOnlinePaymentDefaults(supabaseAdmin: any, tenantId: string) {
  const { data: currentSettings } = await supabaseAdmin
    .from('tenant_settings')
    .select('payment_methods')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const currentPm = (currentSettings?.payment_methods as any) || {};

  await supabaseAdmin
    .from('tenant_settings')
    .update({
      payment_methods: {
        pay_local: currentPm.pay_local !== false,
        partial_50: true,
        full_100: true,
      },
      accept_online_payment: true,
      accept_local_payment: currentPm.pay_local !== false,
      booking_payment_mode: currentPm.pay_local !== false ? 'client_choice' : 'deposit',
    } as any)
    .eq('tenant_id', tenantId);
}

async function exchangeOAuthCodeAndSaveAccount(params: {
  supabaseAdmin: any;
  tenantId: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const { supabaseAdmin, tenantId, code, redirectUri, clientId, clientSecret } = params;

  const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData?.access_token) {
    const mpDetail = tokenData?.message || tokenData?.error_description || tokenData?.error || `HTTP ${tokenRes.status}`;
    throw new Error(`Falha ao autorizar conta no Mercado Pago: ${mpDetail}`);
  }

  const mpUser = await mpRequest('/users/me', tokenData.access_token, { method: 'GET' }).catch(() => ({}));
  const mpUserId = String(tokenData.user_id || mpUser?.id || '');
  const accountLabel = `mp_${mpUserId || tenantId.slice(0, 8)}`;
  const nickname =
    mpUser?.nickname ||
    [mpUser?.first_name, mpUser?.last_name].filter(Boolean).join(' ') ||
    mpUser?.email ||
    'Conta Mercado Pago';
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null;

  const { error: upsertErr } = await supabaseAdmin
    .from('stripe_connect_accounts')
    .upsert(
      {
        tenant_id: tenantId,
        stripe_account_id: accountLabel,
        mp_user_id: mpUserId,
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token || null,
        mp_public_key: tokenData.public_key || null,
        mp_token_expires_at: expiresAt,
        mp_email: mpUser?.email || null,
        mp_nickname: nickname,
        charges_enabled: true,
        payouts_enabled: true,
      } as any,
      { onConflict: 'tenant_id' }
    );

  if (upsertErr) {
    throw new Error(`Erro ao salvar conta Mercado Pago: ${upsertErr.message}`);
  }

  await enableTenantOnlinePaymentDefaults(supabaseAdmin, tenantId);

  return {
    stripe_account_id: accountLabel,
    mp_user_id: mpUserId,
    mp_email: mpUser?.email || null,
    mp_nickname: nickname,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── GET: Callback automático do Mercado Pago após o dono do salão autorizar ─
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code')?.trim() || '';
    const state = url.searchParams.get('state')?.trim() || '';
    const oauthError = url.searchParams.get('error')?.trim() || '';
    const oauthErrorDesc = url.searchParams.get('error_description')?.trim() || '';

    let stateData: OAuthStatePayload;
    try {
      if (!state) throw new Error('Parâmetro state ausente no retorno do Mercado Pago.');
      stateData = await verifyOAuthState(state);
    } catch (stateErr: any) {
      return redirectResponse(
        `${DEFAULT_APP_ORIGIN}/admin/configuracoes?tab=stripe&mp_oauth=error&mp_error_msg=${encodeURIComponent(stateErr?.message || 'Retorno OAuth inválido.')}`
      );
    }

    const baseRedirect = `${stateData.origin.replace(/\/+$/, '')}/admin/configuracoes?tab=stripe`;

    if (oauthError) {
      const msg = oauthErrorDesc || 'Autorização cancelada no Mercado Pago.';
      return redirectResponse(`${baseRedirect}&mp_oauth=error&mp_error_msg=${encodeURIComponent(msg)}`);
    }

    if (!code) {
      return redirectResponse(
        `${baseRedirect}&mp_oauth=error&mp_error_msg=${encodeURIComponent('Código de autorização não recebido do Mercado Pago.')}`
      );
    }

    try {
      const mpContext = await getMercadoPagoContext(supabaseAdmin);
      const clientSecret = mpContext.clientSecret || mpContext.accessToken;

      if (!mpContext.clientId || !clientSecret) {
        throw new Error('Credenciais OAuth da plataforma não configuradas em /platform/settings.');
      }

      await exchangeOAuthCodeAndSaveAccount({
        supabaseAdmin,
        tenantId: stateData.tenantId,
        code,
        redirectUri: stateData.redirectUri,
        clientId: mpContext.clientId,
        clientSecret,
      });

      return redirectResponse(`${baseRedirect}&mp_oauth=success`);
    } catch (callbackErr: any) {
      console.error('Mercado Pago OAuth Callback Error:', callbackErr);
      return redirectResponse(
        `${baseRedirect}&mp_oauth=error&mp_error_msg=${encodeURIComponent(callbackErr?.message || 'Erro ao concluir conexão com Mercado Pago.')}`
      );
    }
  }

  // ── POST: Inicia OAuth (get_link) ou troca código (fallback) ────────────────
  try {
    const mpContext = await getMercadoPagoContext(supabaseAdmin);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Salão não encontrado para este usuário");
    const tenantId = profile.tenant_id;

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'get_link';

    // Fallback caso o Redirect URI configurado no App MP ainda aponte para /admin/configuracoes
    if (action === 'exchange_code') {
      const code = String(body?.code || '').trim();
      const redirectUri = String(body?.redirectUri || '').trim() || CALLBACK_REDIRECT_URI;
      const clientSecret = mpContext.clientSecret || mpContext.accessToken;

      if (!code) throw new Error("Código de autorização do Mercado Pago não informado.");
      if (!mpContext.clientId || !clientSecret) {
        throw new Error("OAuth do Mercado Pago (Client ID / Client Secret) ainda não foi configurado no Super Admin (/platform/settings).");
      }

      const saved = await exchangeOAuthCodeAndSaveAccount({
        supabaseAdmin,
        tenantId,
        code,
        redirectUri,
        clientId: mpContext.clientId,
        clientSecret,
      });

      return new Response(
        JSON.stringify({
          success: true,
          just_activated: true,
          charges_enabled: true,
          payouts_enabled: true,
          ...saved,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Padrão: gerar link oficial do Mercado Pago com redirecionamento automático para CALLBACK_REDIRECT_URI
    const clientSecret = mpContext.clientSecret || mpContext.accessToken;
    if (!mpContext.clientId || !clientSecret) {
      throw new Error(
        "Conexão automática ainda não ativada pelo administrador: preencha o Access Token e o Client Secret no Super Admin (/platform/settings)."
      );
    }

    const origin = (body?.origin || req.headers.get('origin') || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');
    const signedState = await signOAuthState({
      tenantId,
      origin,
      redirectUri: CALLBACK_REDIRECT_URI,
      exp: Date.now() + OAUTH_STATE_TTL_MS,
    });

    const authUrl =
      `https://auth.mercadopago.com.br/authorization` +
      `?client_id=${encodeURIComponent(mpContext.clientId)}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&state=${encodeURIComponent(signedState)}` +
      `&redirect_uri=${encodeURIComponent(CALLBACK_REDIRECT_URI)}`;

    return new Response(
      JSON.stringify({ url: authUrl, mode: 'oauth', redirectUri: CALLBACK_REDIRECT_URI }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("Mercado Pago Connect Onboarding Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
