import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface StripeContext {
  stripe: Stripe;
  mode: 'test' | 'live';
  secretKey: string;
  publishableKey: string;
  applicationFeePercent: number;
  webhookSecret?: string;
}

/**
 * Obtém o cliente Stripe dinamicamente baseado na tabela `platform_settings`
 * configurada no painel Super Admin (/platform/settings).
 * 
 * Se o Super Admin alternou para 'live', utiliza automaticamente as chaves de produção
 * (stripe_live_secret_key). Se alternou para 'test', utiliza as chaves de teste.
 * Possui fallback transparente para as variáveis Deno.env caso a tabela ainda não
 * possua as chaves preenchidas.
 */
export async function getStripeContext(supabaseAdmin: SupabaseClient): Promise<StripeContext> {
  const { data: settings, error } = await supabaseAdmin
    .from('platform_settings')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error) {
    console.warn('[StripeContext] Erro ao ler platform_settings, usando fallback Deno.env:', error.message);
  }

  const mode: 'test' | 'live' = settings?.stripe_mode === 'live' ? 'live' : 'test';

  let secretKey = '';
  let publishableKey = '';

  if (mode === 'live') {
    secretKey = settings?.stripe_live_secret_key?.trim()
      || Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      || Deno.env.get('STRIPE_SECRET_KEY')
      || '';
    publishableKey = settings?.stripe_live_public_key?.trim()
      || Deno.env.get('STRIPE_PUBLIC_KEY_LIVE')
      || Deno.env.get('VITE_STRIPE_PUBLIC_KEY')
      || '';
  } else {
    secretKey = settings?.stripe_test_secret_key?.trim()
      || Deno.env.get('STRIPE_SECRET_KEY_TEST')
      || Deno.env.get('STRIPE_SECRET_KEY')
      || '';
    publishableKey = settings?.stripe_test_public_key?.trim()
      || Deno.env.get('STRIPE_PUBLIC_KEY_TEST')
      || Deno.env.get('VITE_STRIPE_PUBLIC_KEY')
      || '';
  }

  if (!secretKey) {
    throw new Error(
      `[Stripe] Chave secreta (${mode.toUpperCase()}) não encontrada. Configure no painel Super Admin (/platform/settings) ou nas secrets do Supabase.`
    );
  }

  const applicationFeePercent = settings?.stripe_application_fee_percent != null && !isNaN(Number(settings.stripe_application_fee_percent))
    ? Number(settings.stripe_application_fee_percent)
    : 0;

  const webhookSecret = mode === 'live'
    ? (settings?.stripe_live_webhook_secret?.trim() || Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE') || Deno.env.get('STRIPE_WEBHOOK_SECRET'))
    : (settings?.stripe_test_webhook_secret?.trim() || Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') || Deno.env.get('STRIPE_WEBHOOK_SECRET'));

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  return {
    stripe,
    mode,
    secretKey,
    publishableKey,
    applicationFeePercent,
    webhookSecret,
  };
}

/**
 * Preserva limites, recursos, permissões personalizadas e preço promocional (custom_pricing)
 * de um salão quando a assinatura é ativada/atualizada via Stripe Checkout ou Webhook,
 * evitando que a trigger padrão do banco sobrescreva o que o Super Admin liberou.
 */
export async function preserveCustomContractAndPricing(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  planId: string,
  previousContract?: any,
  stripeUnitAmountCents?: number | null
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
    let matchedCustomPrice = customPrices?.find(
      (cp: any) => cp.plan_id === planId && Number(cp.amount_override) > 0
    ) || customPrices?.find((cp: any) => Number(cp.amount_override) > 0) || null;

    if (matchedCustomPrice && matchedCustomPrice.plan_id !== planId) {
      await supabaseAdmin
        .from('custom_pricing')
        .update({ plan_id: planId })
        .eq('id', matchedCustomPrice.id);
    }

    // Determinar o valor efetivo da assinatura
    let effectivePriceAmount: number | null = null;
    if (matchedCustomPrice?.amount_override && Number(matchedCustomPrice.amount_override) > 0) {
      effectivePriceAmount = Number(matchedCustomPrice.amount_override);
    } else if (stripeUnitAmountCents && stripeUnitAmountCents > 0) {
      effectivePriceAmount = Number((stripeUnitAmountCents / 100).toFixed(2));
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
