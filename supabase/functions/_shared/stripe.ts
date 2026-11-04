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
