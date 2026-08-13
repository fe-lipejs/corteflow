import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

export interface PlanFeatures {
  // Core screens
  agenda: boolean;
  clientes: boolean;
  equipe: boolean;
  servicos: boolean;
  // Advanced screens
  produtos: boolean;
  financeiro: boolean;
  relatorios: boolean;
  configuracoes: boolean;
  assinatura: boolean;
  // Limits
  max_professionals: number;
  allow_products: boolean;
  // Plan metadata
  plan_key: string | null;
  plan_name: string | null;
  // Subscription state
  subscription_status: string | null; // 'trial', 'active', 'past_due', 'canceled', null
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  suspension_reason: string | null;
  canceled_at: string | null;
  is_trial: boolean;
  is_active: boolean; // true for both trial and active
  has_subscription: boolean;
}

/**
 * Default features for a tenant with no subscription at all.
 * Only assinatura and configuracoes are accessible so they can subscribe.
 */
const NO_PLAN_FEATURES: PlanFeatures = {
  agenda: false,
  clientes: false,
  equipe: false,
  servicos: false,
  produtos: false,
  financeiro: false,
  relatorios: false,
  configuracoes: true,   // must access to set up
  assinatura: true,      // must access to choose a plan
  max_professionals: 0,
  allow_products: false,
  plan_key: null,
  plan_name: null,
  subscription_status: null,
  trial_ends_at: null,
  grace_period_ends_at: null,
  suspension_reason: null,
  canceled_at: null,
  is_trial: false,
  is_active: false,
  has_subscription: false,
};

/**
 * Features applied when the user is in an active Trial (7 days).
 * Allows full core testing (agenda, clients, services, 1 professional).
 * Advanced features (products, full financial, multiple pros) prompt Growth upgrade.
 */
const TRIAL_FEATURES: PlanFeatures = {
  agenda: true,
  clientes: true,
  equipe: true,
  servicos: true,
  produtos: false,
  financeiro: false,
  relatorios: false,
  configuracoes: true,
  assinatura: true,
  max_professionals: 1, // 1 professional in Trial/Starter
  allow_products: false,
  plan_key: 'starter',
  plan_name: 'Trial (7 dias)',
  subscription_status: 'trial',
  trial_ends_at: null,
  grace_period_ends_at: null,
  suspension_reason: null,
  canceled_at: null,
  is_trial: true,
  is_active: true,
  has_subscription: true,
};

/**
 * Full feature set — used when no JSONB features are configured yet.
 * Allows full access to avoid locking out tenants during initial setup.
 */
const FULL_FEATURES_FALLBACK: Partial<PlanFeatures> = {
  agenda: true,
  clientes: true,
  equipe: true,
  servicos: true,
  produtos: true,
  financeiro: true,
  relatorios: true,
  configuracoes: true,
  assinatura: true,
};

export function usePlanFeatures(): { features: PlanFeatures; isLoading: boolean } {
  const { tenantId, role } = useAuth();

  const { data: features = NO_PLAN_FEATURES, isLoading } = useQuery({
    queryKey: ['plan_features', tenantId, role],
    enabled: !!tenantId || role === 'super_admin',
    staleTime: 1000 * 60 * 2, // 2 min cache
    queryFn: async () => {
      // Super admin always has everything
      if (role === 'super_admin') {
        return {
          ...FULL_FEATURES_FALLBACK,
          max_professionals: 999,
          allow_products: true,
          plan_key: 'super_admin',
          plan_name: 'Super Admin',
          subscription_status: 'active',
          trial_ends_at: null,
          grace_period_ends_at: null,
          suspension_reason: null,
          canceled_at: null,
          is_trial: false,
          is_active: true,
          has_subscription: true,
        } as PlanFeatures;
      }

      // Fetch the best active subscription for this tenant
      const { data: sub } = await supabase
        .from('subscriptions')
        .select(`
          status,
          trial_ends_at,
          current_period_end,
          grace_period_ends_at,
          suspension_reason,
          canceled_at,
          plans (
            key,
            name,
            max_professionals,
            allow_products,
            features
          )
        `)
        .eq('tenant_id', tenantId!)
        .in('status', ['active', 'trialing', 'trial', 'past_due'])
        .order('status', { ascending: false }) // active first
        .limit(1)
        .maybeSingle();

      // No subscription → lock most features
      if (!sub) return NO_PLAN_FEATURES;

      const plan = (sub as any).plans;
      const subStatus: string = sub.status;

      // Check if trial is expired (for 'trial' status stored in our DB)
      const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
      const trialExpired = trialEndsAt ? trialEndsAt < new Date() : false;

      if (subStatus === 'trial' && trialExpired) {
        // Trial expired — lock down like no subscription
        return {
          ...NO_PLAN_FEATURES,
          subscription_status: 'trial_expired',
          trial_ends_at: sub.trial_ends_at,
          has_subscription: true,
        } as PlanFeatures;
      }

      const isTrial = subStatus === 'trial' || subStatus === 'trialing';
      const isActive = subStatus === 'active' || isTrial || subStatus === 'past_due';

      if (isTrial) {
        return {
          ...TRIAL_FEATURES,
          trial_ends_at: sub.trial_ends_at,
          grace_period_ends_at: sub.grace_period_ends_at,
        } as PlanFeatures;
      }

      // Read features from the plan's JSONB column (set by Super Admin)
      // Fall back to full access if the JSONB is empty/not configured yet
      let jsonbFeatures: Partial<PlanFeatures> = FULL_FEATURES_FALLBACK;

      if (plan?.features && typeof plan.features === 'object' && !Array.isArray(plan.features)) {
        const featureObj = plan.features as Record<string, unknown>;
        // Only override if the JSONB has at least one feature key defined
        const featureKeys = ['agenda', 'clientes', 'equipe', 'servicos', 'financeiro', 'relatorios', 'produtos'];
        const hasAnyKey = featureKeys.some(k => k in featureObj);
        if (hasAnyKey) {
          jsonbFeatures = {
            agenda: featureObj.agenda as boolean ?? true,
            clientes: featureObj.clientes as boolean ?? true,
            equipe: featureObj.equipe as boolean ?? true,
            servicos: featureObj.servicos as boolean ?? true,
            produtos: featureObj.produtos as boolean ?? false,
            financeiro: featureObj.financeiro as boolean ?? false,
            relatorios: featureObj.relatorios as boolean ?? false,
            configuracoes: true, // always accessible
            assinatura: true,    // always accessible
          };
        }
      }

      return {
        ...jsonbFeatures,
        configuracoes: true,
        assinatura: true,
        max_professionals: plan?.max_professionals ?? 1,
        allow_products: plan?.allow_products ?? false,
        plan_key: plan?.key ?? null,
        plan_name: plan?.name ?? null,
        subscription_status: subStatus,
        trial_ends_at: sub.trial_ends_at ?? null,
        grace_period_ends_at: sub.grace_period_ends_at ?? null,
        suspension_reason: sub.suspension_reason ?? null,
        canceled_at: sub.canceled_at ?? null,
        is_trial: isTrial,
        is_active: isActive,
        has_subscription: true,
      } as PlanFeatures;
    },
  });

  return { features, isLoading };
}
