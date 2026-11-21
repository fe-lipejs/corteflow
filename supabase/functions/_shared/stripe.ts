import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface MercadoPagoContext {
  mode: 'test' | 'live';
  accessToken: string;
  testAccessToken: string;
  publicKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  applicationFeePercent: number;
}

export interface TenantMercadoPagoAccount {
  accountId: string;
  accessToken: string;
  publicKey: string | null;
  mpUserId: string | null;
  chargesEnabled: boolean;
  isOAuth: boolean;
  isTestUser: boolean;
  email: string | null;
  nickname: string | null;
}

function isLegacyStripeSecret(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed.startsWith('sk_') || trimmed.startsWith('rk_') || trimmed.startsWith('pk_');
}

export function extractMpClientIdFromToken(accessToken?: string | null): string {
  if (!accessToken) return '';
  const match = accessToken.trim().match(/^(?:APP_USR|TEST)-(\d+)-/);
  return match ? match[1] : '';
}

export async function mpRequest<T = any>(
  path: string,
  accessToken: string,
  options: {
    method?: string;
    body?: any;
    idempotencyKey?: string;
  } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') {
    headers['X-Idempotency-Key'] = options.idempotencyKey || crypto.randomUUID();
  }

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const causeMsg = Array.isArray(data?.cause) && data.cause[0]?.description
      ? ` (${data.cause[0].description})`
      : '';
    const detail = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Mercado Pago: ${detail}${causeMsg}`);
  }

  return data as T;
}

/**
 * Obtém o contexto do Mercado Pago da Plataforma Raffros a partir da tabela `platform_settings`
 * configurada no painel Super Admin (/platform/settings), com fallback para Deno.env.
 */
export async function getMercadoPagoContext(supabaseAdmin: SupabaseClient): Promise<MercadoPagoContext> {
  const { data: settings, error } = await supabaseAdmin
    .from('platform_settings')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error) {
    console.warn('[MercadoPagoContext] Erro ao ler platform_settings, usando fallback Deno.env:', error.message);
  }

  const rawMode = (settings?.mp_mode || settings?.stripe_mode || 'live').toLowerCase();
  const mode: 'test' | 'live' = rawMode === 'test' ? 'test' : 'live';

  let accessToken = '';
  let publicKey = '';

  if (mode === 'live') {
    const legacyLiveSecret = !isLegacyStripeSecret(settings?.stripe_live_secret_key)
      ? settings?.stripe_live_secret_key?.trim()
      : '';
    const legacyLivePub = !isLegacyStripeSecret(settings?.stripe_live_public_key)
      ? settings?.stripe_live_public_key?.trim()
      : '';

    accessToken =
      settings?.mp_live_access_token?.trim() ||
      settings?.mp_test_access_token?.trim() ||
      legacyLiveSecret ||
      Deno.env.get('MP_ACCESS_TOKEN_LIVE') ||
      Deno.env.get('MP_ACCESS_TOKEN') ||
      '';
    publicKey =
      settings?.mp_live_public_key?.trim() ||
      settings?.mp_test_public_key?.trim() ||
      legacyLivePub ||
      Deno.env.get('MP_PUBLIC_KEY_LIVE') ||
      Deno.env.get('MP_PUBLIC_KEY') ||
      '';
  } else {
    const legacyTestSecret = !isLegacyStripeSecret(settings?.stripe_test_secret_key)
      ? settings?.stripe_test_secret_key?.trim()
      : '';
    const legacyTestPub = !isLegacyStripeSecret(settings?.stripe_test_public_key)
      ? settings?.stripe_test_public_key?.trim()
      : '';

    accessToken =
      settings?.mp_test_access_token?.trim() ||
      settings?.mp_live_access_token?.trim() ||
      legacyTestSecret ||
      Deno.env.get('MP_ACCESS_TOKEN_TEST') ||
      Deno.env.get('MP_ACCESS_TOKEN') ||
      '';
    publicKey =
      settings?.mp_test_public_key?.trim() ||
      settings?.mp_live_public_key?.trim() ||
      legacyTestPub ||
      Deno.env.get('MP_PUBLIC_KEY_TEST') ||
      Deno.env.get('MP_PUBLIC_KEY') ||
      '';
  }

  const clientId =
    settings?.mp_client_id?.trim() ||
    Deno.env.get('MP_CLIENT_ID') ||
    extractMpClientIdFromToken(accessToken) ||
    '';
  const clientSecret = settings?.mp_client_secret?.trim() || Deno.env.get('MP_CLIENT_SECRET') || '';
  const webhookSecret =
    settings?.mp_webhook_secret?.trim() ||
    Deno.env.get('MP_WEBHOOK_SECRET') ||
    '';

  const testAccessToken =
    settings?.mp_test_access_token?.trim() ||
    Deno.env.get('MP_ACCESS_TOKEN_TEST') ||
    (accessToken.startsWith('TEST-') ? accessToken : '');

  const rawFee = settings?.mp_application_fee_percent ?? settings?.stripe_application_fee_percent ?? 0;
  const applicationFeePercent = !isNaN(Number(rawFee)) ? Math.max(0, Number(rawFee)) : 0;

  return {
    mode,
    accessToken,
    testAccessToken,
    publicKey,
    clientId,
    clientSecret,
    webhookSecret,
    applicationFeePercent,
  };
}

/**
 * Obtém as credenciais do Mercado Pago conectadas pelo dono do salão (para repasse direto).
 * Caso utilize OAuth e o token esteja próximo do vencimento, renova automaticamente via refresh_token.
 */
export async function getTenantMercadoPagoAccount(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  mpContext?: MercadoPagoContext
): Promise<TenantMercadoPagoAccount | null> {
  const { data: row } = await supabaseAdmin
    .from('stripe_connect_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!row || !row.mp_access_token) {
    return null;
  }

  let accessToken = String(row.mp_access_token).trim();
  let isOAuth = Boolean(row.mp_refresh_token);
  const isTestUser = Boolean(
    String(row.mp_email || '').toLowerCase().endsWith('@testuser.com') ||
    String(row.mp_nickname || '').toUpperCase().startsWith('TESTUSER')
  );

  // Contas sintéticas TESTUSER (@testuser.com) não possuem chave Pix Bacen no endpoint /v1/payments com token APP_USR
  // (retornam "user_allowed_only_in_test: 400"). Usamos o testAccessToken da plataforma para simular o Pix/Checkout sem erro.
  if (isTestUser && mpContext?.testAccessToken) {
    return {
      accountId: row.stripe_account_id || `mp_${row.mp_user_id || tenantId}`,
      accessToken: mpContext.testAccessToken,
      publicKey: row.mp_public_key || mpContext.publicKey || null,
      mpUserId: row.mp_user_id || null,
      chargesEnabled: Boolean(row.charges_enabled),
      isOAuth: false,
      isTestUser: true,
      email: row.mp_email || null,
      nickname: row.mp_nickname || null,
    };
  }

  // Renova token OAuth automaticamente se faltar menos de 24h para expirar
  if (isOAuth && row.mp_token_expires_at && mpContext?.clientId && (mpContext?.clientSecret || mpContext?.accessToken)) {
    const expiresMs = new Date(row.mp_token_expires_at).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (!Number.isNaN(expiresMs) && expiresMs - Date.now() < oneDayMs) {
      try {
        const refreshed = await mpRequest<any>('/oauth/token', mpContext.accessToken || accessToken, {
          method: 'POST',
          body: {
            client_id: mpContext.clientId,
            client_secret: mpContext.clientSecret || mpContext.accessToken,
            grant_type: 'refresh_token',
            refresh_token: row.mp_refresh_token,
          },
        });

        if (refreshed?.access_token) {
          accessToken = refreshed.access_token;
          const nextExpires = refreshed.expires_in
            ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
            : null;
          await supabaseAdmin
            .from('stripe_connect_accounts')
            .update({
              mp_access_token: refreshed.access_token,
              mp_refresh_token: refreshed.refresh_token || row.mp_refresh_token,
              mp_token_expires_at: nextExpires,
              mp_public_key: refreshed.public_key || row.mp_public_key,
            })
            .eq('tenant_id', tenantId);
        }
      } catch (refreshErr: any) {
        console.warn('[getTenantMercadoPagoAccount] Falha ao renovar OAuth token do salão:', refreshErr?.message);
      }
    }
  }

  return {
    accountId: row.stripe_account_id || `mp_${row.mp_user_id || tenantId}`,
    accessToken,
    publicKey: row.mp_public_key || null,
    mpUserId: row.mp_user_id || null,
    chargesEnabled: Boolean(row.charges_enabled),
    isOAuth,
    isTestUser,
    email: row.mp_email || null,
    nickname: row.mp_nickname || null,
  };
}

/**
 * Preserva limites, recursos, permissões personalizadas e preço promocional (custom_pricing)
 * de um salão quando a assinatura é ativada/atualizada via Mercado Pago Checkout ou Webhook,
 * evitando que a trigger padrão do banco sobrescreva o que o Super Admin liberou.
 */
export async function preserveCustomContractAndPricing(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  planId: string,
  previousContract?: any,
  paidUnitAmountCents?: number | null
) {
  try {
    const [{ data: sub }, { data: newPlan }, { data: customPrices }] = await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('id, plan_id')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle(),
      supabaseAdmin
        .from('custom_pricing')
        .select('id, plan_id, amount_override')
        .eq('tenant_id', tenantId),
    ]);

    if (!sub?.id || !newPlan) return;

    // Encontrar preço promocional (exato ou órfão de Trial)
    const matchedCustomPrice =
      customPrices?.find((cp: any) => cp.plan_id === planId && Number(cp.amount_override) > 0) ||
      customPrices?.find((cp: any) => Number(cp.amount_override) > 0) ||
      null;

    if (matchedCustomPrice && matchedCustomPrice.plan_id !== planId) {
      await supabaseAdmin
        .from('custom_pricing')
        .update({ plan_id: planId })
        .eq('id', matchedCustomPrice.id);
    }

    let effectivePriceAmount: number | null = null;
    if (matchedCustomPrice?.amount_override && Number(matchedCustomPrice.amount_override) > 0) {
      effectivePriceAmount = Number(matchedCustomPrice.amount_override);
    } else if (paidUnitAmountCents && paidUnitAmountCents > 0) {
      effectivePriceAmount = Number((paidUnitAmountCents / 100).toFixed(2));
    }

    const wasCustomizedByAdmin = Boolean(
      previousContract?.features?._custom_override ||
      (matchedCustomPrice && previousContract)
    );

    if (!wasCustomizedByAdmin && effectivePriceAmount === null) {
      return;
    }

    const { data: currentContract } = await supabaseAdmin
      .from('subscription_contracts')
      .select('*')
      .eq('subscription_id', sub.id)
      .maybeSingle();

    const baseContract = currentContract || {};
    const prevFeatures = previousContract?.features || {};
    const planFeatures = newPlan.features || {};
    const prevLimits = previousContract?.limits || {};
    const planLimits = newPlan.limits || {};

    const mergedMaxPros = wasCustomizedByAdmin
      ? Math.max(Number(previousContract?.max_professionals || 1), Number(newPlan.max_professionals || 1))
      : Number(newPlan.max_professionals || 1);

    const mergedAllowProducts = wasCustomizedByAdmin
      ? Boolean(previousContract?.allow_products || newPlan.allow_products)
      : Boolean(newPlan.allow_products);

    const mergedFeatures = wasCustomizedByAdmin
      ? {
          ...planFeatures,
          ...prevFeatures,
          _custom_override: true,
          agenda: true,
          servicos: true,
          clientes: true,
          equipe: true,
          financeiro: Boolean(prevFeatures.financeiro || planFeatures.financeiro),
          produtos: Boolean(prevFeatures.produtos || planFeatures.produtos || mergedAllowProducts),
          relatorios: Boolean(prevFeatures.relatorios || planFeatures.relatorios),
        }
      : planFeatures;

    const mergedLimits = wasCustomizedByAdmin
      ? {
          ...planLimits,
          ...prevLimits,
          profissionais: mergedMaxPros,
          servicos: Math.max(Number(prevLimits.servicos || 0), Number(planLimits.servicos || 3)),
          produtos: Math.max(Number(prevLimits.produtos || 0), Number(planLimits.produtos || 0)),
        }
      : planLimits;

    const prevPerms: string[] = Array.isArray(previousContract?.permissions) ? previousContract.permissions : [];
    const planPerms: string[] = Array.isArray(newPlan.permissions) ? newPlan.permissions : [];
    const mergedPermissions = wasCustomizedByAdmin
      ? (prevPerms.includes('*') || planPerms.includes('*')
          ? ['*']
          : Array.from(new Set([...planPerms, ...prevPerms])))
      : planPerms;

    await supabaseAdmin
      .from('subscription_contracts')
      .upsert({
        subscription_id: sub.id,
        plan_id: planId,
        price_amount: effectivePriceAmount ?? baseContract.price_amount ?? 0,
        currency: baseContract.currency || 'BRL',
        max_professionals: mergedMaxPros,
        allow_products: mergedAllowProducts,
        features: mergedFeatures,
        limits: mergedLimits,
        permissions: mergedPermissions,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'subscription_id' });
  } catch (err: any) {
    console.warn('[preserveCustomContractAndPricing] Aviso ao preservar contrato customizado:', err?.message);
  }
}
