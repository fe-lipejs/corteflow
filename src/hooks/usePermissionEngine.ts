import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

export type SubscriptionStatusType =
  | 'active'
  | 'trial'
  | 'trial_expired'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'no_subscription';

export interface PermissionEngine {
  hasFeature: (key: string) => boolean;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (prefix: string) => boolean;
  getPlanLimit: (key: string) => number | 'unlimited';
  checkLimit: (key: string, currentUsage: number) => boolean;
  getEffectivePermissions: () => string[];
  isLoading: boolean;
  contract: any;
  subscription: any;
  defaultPlan: any;
  /** Plano efetivamente usado para calcular permissões (plano da assinatura ou plano de fallback) */
  effectivePlan: any;
  isCanceled: boolean;
  isTrialExpired: boolean;
  isPastDue: boolean;
  isSubscriptionActive: boolean;
  subscriptionStatus: SubscriptionStatusType;
  subscriptionMessage: string;
}

/** Colunas do plano necessárias para o motor */
const PLAN_COLUMNS = 'id, key, name, max_professionals, allow_products, features, permissions, limits, is_default, is_trial_plan';

/** Select completo da assinatura (sempre com join do plano e contrato) */
const SUBSCRIPTION_SELECT = `
  id,
  plan_id,
  status,
  trial_ends_at,
  current_period_end,
  grace_period_ends_at,
  suspension_reason,
  canceled_at,
  updated_at,
  created_at,
  subscription_contracts (
    max_professionals,
    allow_products,
    features,
    permissions,
    limits
  ),
  plans (
    ${PLAN_COLUMNS}
  )
`;

/** Status em que a assinatura NÃO concede o plano contratado → usa plano de fallback */
const INACTIVE_STATUSES = ['canceled', 'incomplete_expired', 'unpaid', 'expired'];

function isTrialExpired(sub: any): boolean {
  if (!sub) return false;
  if (sub.status !== 'trial' && sub.status !== 'trialing') return false;
  if (!sub.trial_ends_at) return false;
  return new Date(sub.trial_ends_at) < new Date();
}

/** Assinatura concede o plano contratado? */
function subscriptionGrantsPlan(sub: any): boolean {
  if (!sub) return false;
  // Se a assinatura foi cancelada, mas o ciclo já pago ainda está no futuro, o salão continua com acesso total ao plano contratado!
  if (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
    return true;
  }
  if (INACTIVE_STATUSES.includes(sub.status)) return false;
  if (isTrialExpired(sub)) return false;
  return true;
}

function normalizePermissions(value: any): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

export function usePermissionEngine(): PermissionEngine {
  const { tenantId, role, professionalPermissions } = useAuth();

  const { data: rolePermissions = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['sys_role_permissions', role],
    enabled: !!role && role !== 'super_admin' && role !== 'professional',
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase
        .from('sys_role_permissions')
        .select('permission_key')
        .eq('role', role);
      return data?.map((d) => d.permission_key) || [];
    }
  });

  const { data: subData, isLoading: isLoadingSub } = useQuery({
    queryKey: ['active_subscription_contract', tenantId, role],
    enabled: !!tenantId || role === 'super_admin',
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (role === 'super_admin' && !tenantId) return { isSuperAdmin: true };

      const { data: subs } = await supabase
        .from('subscriptions')
        .select(SUBSCRIPTION_SELECT)
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false });

      let sub: any = subs?.find((s: any) => s.status === 'active' || s.status === 'trialing') ||
                subs?.find((s: any) => s.status === 'trial') ||
                subs?.find((s: any) => s.status === 'past_due') ||
                subs?.[0] || null;

      if ((!sub || sub.status !== 'active') && (role === 'owner' || role === 'admin') && tenantId) {
        try {
          const { data: syncData } = await supabase.functions.invoke('sync-stripe-subscription');
          if (syncData?.synced) {
            const { data: refreshedSubs } = await supabase
              .from('subscriptions')
              .select(SUBSCRIPTION_SELECT)
              .eq('tenant_id', tenantId!)
              .order('updated_at', { ascending: false });

            const newActiveSub = refreshedSubs?.find((s: any) => s.status === 'active' || s.status === 'trialing');
            if (newActiveSub) sub = newActiveSub;
          }
        } catch (_) {}
      }

      // Plano de fallback: usado quando não há assinatura válida (cancelada, expirada, trial vencido).
      // Prioridade: plano marcado como padrão (is_default) → plano de período de teste (is_trial_plan).
      let defaultPlan: any = null;
      if (!subscriptionGrantsPlan(sub)) {
        const { data: dp } = await supabase
          .from('plans')
          .select(PLAN_COLUMNS)
          .eq('is_default', true)
          .limit(1)
          .maybeSingle();
        defaultPlan = dp;

        if (!defaultPlan) {
          const { data: tp } = await supabase
            .from('plans')
            .select(PLAN_COLUMNS)
            .eq('is_trial_plan', true)
            .limit(1)
            .maybeSingle();
          defaultPlan = tp;
        }
      }

      return { sub, defaultPlan };
    }
  });

  const isLoading = isLoadingRoles || isLoadingSub;

  const isSuperAdmin = role === 'super_admin';
  const sub = (subData as any)?.sub as any;
  const defaultPlan = (subData as any)?.defaultPlan as any;
  const contract = Array.isArray(sub?.subscription_contracts) ? sub?.subscription_contracts[0] : sub?.subscription_contracts;
  const subPlan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;

  // Status contextual
  const subStatus = sub?.status;
  const trialExpired = isTrialExpired(sub);
  const periodStillValid = sub?.current_period_end && new Date(sub.current_period_end) > new Date();
  const isCanceled = (subStatus === 'canceled' || subStatus === 'incomplete_expired') && !periodStillValid;
  const isPastDue = subStatus === 'past_due' || subStatus === 'unpaid';
  const isSubscriptionActive = isSuperAdmin ? true : subscriptionGrantsPlan(sub);

  let subscriptionStatus: SubscriptionStatusType = 'no_subscription';
  let subscriptionMessage = 'Nenhuma assinatura ativa encontrada para este salão.';

  if (isSuperAdmin) {
    subscriptionStatus = 'active';
    subscriptionMessage = 'Acesso irrestrito de Super Admin.';
  } else if (!sub) {
    subscriptionStatus = 'no_subscription';
    subscriptionMessage = 'Você ainda não possui um plano ativo. Escolha um plano para começar a usar o sistema completo.';
  } else if (isCanceled) {
    subscriptionStatus = 'canceled';
    subscriptionMessage = 'Sua assinatura foi cancelada. O acesso aos recursos do salão foi interrompido. Escolha um plano para reativar seu negócio.';
  } else if (trialExpired) {
    subscriptionStatus = 'trial_expired';
    subscriptionMessage = 'Seu período de teste gratuito de 7 dias encerrou. Escolha um plano para continuar aproveitando todos os recursos.';
  } else if (isPastDue) {
    subscriptionStatus = 'past_due';
    subscriptionMessage = 'Identificamos uma pendência no pagamento da sua assinatura. Regularize para liberar seu acesso.';
  } else if (subStatus === 'trial' || subStatus === 'trialing') {
    subscriptionStatus = 'trial';
    subscriptionMessage = 'Você está utilizando o período de teste gratuito.';
  } else {
    subscriptionStatus = 'active';
    subscriptionMessage = periodStillValid && subStatus === 'canceled'
      ? 'Sua assinatura foi cancelada, mas seu acesso continua ativo até o final do período contratado.'
      : 'Assinatura ativa.';
  }

  // Fonte única de verdade para permissões/limites/features
  let source: any = null;
  if (!isSuperAdmin) {
    if (subscriptionGrantsPlan(sub)) {
      source = contract ? {
        ...subPlan,
        ...contract,
        max_professionals: contract.max_professionals ?? subPlan?.max_professionals,
        allow_products: contract.allow_products ?? subPlan?.allow_products,
        features: { ...(subPlan?.features || {}), ...(contract?.features || {}) },
        limits: { ...(subPlan?.limits || {}), ...(contract?.limits || {}) },
        permissions: contract?.permissions && Array.isArray(contract.permissions) && contract.permissions.length > 0
          ? contract.permissions
          : subPlan?.permissions,
      } : (subPlan || null);
    } else {
      source = defaultPlan || null;
    }
  }

  const featuresObj: Record<string, any> = source?.features || {};
  const permissionsArr: string[] = normalizePermissions(source?.permissions);
  const limitsObj: Record<string, any> = { ...(source?.limits || {}) };
  if (source?.max_professionals !== undefined && source?.max_professionals !== null) {
    limitsObj.profissionais = source.max_professionals;
  }

  const isProductsAllowedByFeature = Boolean(source?.allow_products || featuresObj?.produtos);
  const isFinanceiroExplicitlyDisabled = featuresObj?.financeiro === false;

  const planHas = (key: string) => {
    if (key.startsWith('produto')) {
      if (isProductsAllowedByFeature) return true;
      return (
        permissionsArr.includes(key) ||
        (key === 'produto.criar' && permissionsArr.includes('produtos.criar')) ||
        (key === 'produto.editar' && permissionsArr.includes('produtos.editar')) ||
        (key === 'produto.excluir' && permissionsArr.includes('produtos.excluir')) ||
        (key === 'produtos.criar' && permissionsArr.includes('produto.criar')) ||
        (key === 'produtos.editar' && permissionsArr.includes('produto.editar')) ||
        (key === 'produtos.excluir' && permissionsArr.includes('produto.excluir'))
      );
    }
    if (key.startsWith('financeiro') && isFinanceiroExplicitlyDisabled) {
      return permissionsArr.includes(key);
    }
    if (permissionsArr.includes('*') || permissionsArr.includes(key)) return true;
    return false;
  };

  /** Papel (owner/admin/manager...) tem a permissão? Owner/Admin sempre têm tudo que o plano permitir. */
  const roleHas = (key: string) =>
    role === 'owner' || role === 'admin' || rolePermissions.includes('*') || rolePermissions.includes(key);

  const hasPermission = (key: string) => {
    if (isSuperAdmin) return true;

    // Configurações gerais e personalização visual são funcionalidades básicas do salão para owner/admin
    if (key.startsWith('configuracoes') && (role === 'owner' || role === 'admin')) {
      return true;
    }

    if (role === 'professional') {
      if (key.startsWith('agenda')) return !!professionalPermissions?.view_own_schedule;
      if (key.startsWith('financeiro')) return !!professionalPermissions?.view_financial;
      if (key.startsWith('clientes')) return !!professionalPermissions?.view_clients;
      if (key.startsWith('comissao')) return !!professionalPermissions?.view_commission;
      if (key === 'equipe.ver_comissoes') return !!professionalPermissions?.view_commission;
      return false;
    }

    return roleHas(key) && planHas(key);
  };

  const hasAnyPermission = (prefix: string) => {
    if (isSuperAdmin) return true;

    const cleanPrefix = prefix.endsWith('.') ? prefix.slice(0, -1) : prefix;

    if (role === 'professional') {
      if (cleanPrefix === 'agenda') return !!professionalPermissions?.view_own_schedule;
      if (cleanPrefix === 'financeiro') return !!professionalPermissions?.view_financial;
      if (cleanPrefix === 'clientes') return !!professionalPermissions?.view_clients;
      if (cleanPrefix === 'comissao') return !!professionalPermissions?.view_commission;
      return false;
    }

    if (cleanPrefix.startsWith('produto') && !isProductsAllowedByFeature) {
      return permissionsArr.some((p) => (p.startsWith('produto.') || p.startsWith('produtos.')) && roleHas(p));
    }

    if (cleanPrefix === 'financeiro' && isFinanceiroExplicitlyDisabled) {
      return permissionsArr.some((p) => p.startsWith('financeiro.') && roleHas(p));
    }

    if (permissionsArr.length === 0) return false;

    const matchesPrefix = (p: string) => p === cleanPrefix || p.startsWith(cleanPrefix + '.');

    if (permissionsArr.includes('*')) {
      if (role === 'owner' || role === 'admin' || rolePermissions.includes('*')) return true;
      return rolePermissions.some(matchesPrefix);
    }

    return permissionsArr.some((p) => matchesPrefix(p) && roleHas(p));
  };

  const hasFeature = (key: string) => {
    if (isSuperAdmin) return true;
    if (key === 'produtos') {
      return isProductsAllowedByFeature || hasPermission('produto.criar') || hasPermission('produto.editar') || hasPermission('produto.excluir');
    }
    return !!featuresObj[key];
  };

  const getPlanLimit = (key: string): number | 'unlimited' => {
    if (isSuperAdmin) return 'unlimited';

    const val = limitsObj[key];
    if (val === undefined || val === null || val === '') {
      return 'unlimited';
    }
    if (val === -1 || val === '-1' || val === 'unlimited') return 'unlimited';

    const num = Number(val);
    return Number.isFinite(num) ? num : 'unlimited';
  };

  const checkLimit = (key: string, currentUsage: number) => {
    if (isSuperAdmin) return true;

    const limit = getPlanLimit(key);
    if (limit === 'unlimited') return true;

    return currentUsage < limit;
  };

  const getEffectivePermissions = () => {
    if (isSuperAdmin) return ['*'];
    if (role === 'professional') return ['professional_scoped'];
    if (permissionsArr.includes('*')) {
      return role === 'owner' || role === 'admin' ? ['*'] : rolePermissions;
    }
    return permissionsArr.filter((p) => roleHas(p));
  };

  return {
    hasFeature,
    hasPermission,
    hasAnyPermission,
    getPlanLimit,
    checkLimit,
    getEffectivePermissions,
    isLoading,
    contract,
    subscription: sub,
    defaultPlan,
    effectivePlan: source,
    isCanceled,
    isTrialExpired: trialExpired,
    isPastDue,
    isSubscriptionActive,
    subscriptionStatus,
    subscriptionMessage
  };
}
