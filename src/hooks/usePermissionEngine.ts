import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

export interface PermissionEngine {
  hasFeature: (key: string) => boolean;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (prefix: string) => boolean;
  getPlanLimit: (key: string) => number | 'unlimited';
  checkLimit: (key: string, currentUsage: number) => boolean;
  getEffectivePermissions: () => string[];
  isLoading: boolean;
  // Raw data for backwards compatibility
  contract: any;
  subscription: any;
  defaultPlan: any;
}

export function usePermissionEngine(): PermissionEngine {
  const { tenantId, role } = useAuth();

  // 1. Fetch Role Permissions
  const { data: rolePermissions = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['sys_role_permissions', role],
    enabled: !!role && role !== 'super_admin',
    staleTime: Infinity, // Role definitions don't change often
    queryFn: async () => {
      const { data } = await supabase
        .from('sys_role_permissions')
        .select('permission_key')
        .eq('role', role);
      return data?.map(d => d.permission_key) || [];
    }
  });

  // 2. Fetch Active Subscription & Contract
  const { data: subData, isLoading: isLoadingSub } = useQuery({
    queryKey: ['active_subscription_contract', tenantId, role],
    enabled: !!tenantId || role === 'super_admin',
    staleTime: 1000 * 60 * 2, // 2 min cache
    queryFn: async () => {
      if (role === 'super_admin') return { isSuperAdmin: true };

      const { data: subs } = await supabase
        .from('subscriptions')
        .select(`
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
            id,
            key,
            name,
            max_professionals,
            allow_products,
            features,
            permissions,
            limits,
            is_default
          )
        `)
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false });

      // Always pick active/trialing first, then trial, then past_due, then newest
      let sub = subs?.find((s: any) => s.status === 'active' || s.status === 'trialing') ||
                subs?.find((s: any) => s.status === 'trial') ||
                subs?.find((s: any) => s.status === 'past_due') ||
                subs?.[0] || null;

      // Se não há assinatura ativa no banco local e o usuário é dono, sincroniza automaticamente com Stripe em background
      if ((!sub || sub.status !== 'active') && role === 'owner' && tenantId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const syncRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            const syncData = await syncRes.json();
            if (syncData.synced) {
              const { data: refreshedSubs } = await supabase
                .from('subscriptions')
                .select(`
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
                    id,
                    key,
                    name,
                    max_professionals,
                    allow_products,
                    features,
                    permissions,
                    limits,
                    is_default
                  )
                `)
                .eq('tenant_id', tenantId!)
                .order('updated_at', { ascending: false });

              const newActiveSub = refreshedSubs?.find((s: any) => s.status === 'active' || s.status === 'trialing');
              if (newActiveSub) sub = newActiveSub;
            }
          }
        } catch (_) {}
      }

      let defaultPlan = null;
      if (!sub || sub.status === 'canceled') {
        const { data: dp } = await supabase
          .from('plans')
          .select('*')
          .eq('is_default', true)
          .single();
        defaultPlan = dp;
      }

      return { sub, defaultPlan };
    }
  });

  const isLoading = isLoadingRoles || isLoadingSub;

  // Extract raw data
  const isSuperAdmin = role === 'super_admin';
  const sub = subData?.sub as any;
  const defaultPlan = subData?.defaultPlan as any;
  const contract = Array.isArray(sub?.subscription_contracts) ? sub?.subscription_contracts[0] : sub?.subscription_contracts;

  // Resolve active sources (Contract or Plan or Default Plan)
  let featuresObj: any = {};
  let permissionsArr: string[] = [];
  let limitsObj: any = {};

  if (isSuperAdmin) {
    // Super admin overrides
  } else if (sub && sub.status !== 'canceled') {
    const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    const trialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
    
    if (sub.status === 'trial' && trialExpired) {
      // Trial expired: block everything until payment
      featuresObj = {};
      permissionsArr = [];
      limitsObj = { profissionais: 0 };
    } else if (contract) {
      featuresObj = { ...(sub.plans?.features || {}), ...(contract.features || {}) };
      const contractPerms = Array.isArray(contract.permissions) ? contract.permissions : [];
      const planPerms = Array.isArray(sub.plans?.permissions) ? sub.plans.permissions : [];
      permissionsArr = Array.from(new Set([...planPerms, ...contractPerms]));
      limitsObj = { ...(sub.plans?.limits || {}), ...(contract.limits || {}) };
      
      // Retrocompatibility parsing for limits if max_professionals is used
      if (!limitsObj.profissionais && (contract.max_professionals || sub.plans?.max_professionals)) {
        limitsObj.profissionais = contract.max_professionals || sub.plans?.max_professionals;
      }
    } else if (sub.plans) {
      featuresObj = sub.plans.features || {};
      permissionsArr = Array.isArray(sub.plans.permissions) ? sub.plans.permissions : [];
      limitsObj = sub.plans.limits || {};
      
      if (!limitsObj.profissionais && sub.plans.max_professionals) {
        limitsObj.profissionais = sub.plans.max_professionals;
      }
    }
  } else if (defaultPlan) {
    // Fallback to Free/Default plan
    featuresObj = defaultPlan.features || {};
    permissionsArr = Array.isArray(defaultPlan.permissions) ? defaultPlan.permissions : [];
    limitsObj = defaultPlan.limits || {};
    
    if (!limitsObj.profissionais && defaultPlan.max_professionals) {
      limitsObj.profissionais = defaultPlan.max_professionals;
    }
  }

  // Engine Methods
  const hasPermission = (key: string) => {
    if (isSuperAdmin) return true;
    
    // Role check: owners have all role permissions by default; other roles check sys_role_permissions
    const roleHasIt = role === 'owner' || role === 'admin' || rolePermissions.includes(key) || rolePermissions.includes('*');
    if (!roleHasIt) return false;

    // Se o array de permissões do contrato/plano existe (mesmo vazio), validar se a chave está presente
    if (Array.isArray(permissionsArr)) {
      return permissionsArr.includes(key) || permissionsArr.includes('*');
    }

    return false;
  };

  const hasFeature = (key: string) => {
    if (isSuperAdmin) return true;
    if (key === 'produtos') {
      if (hasPermission('produto.criar') || hasPermission('produto.editar') || hasPermission('produto.excluir') || hasPermission('catalogo.criar')) return true;
      if (contract) return !!contract.allow_products || !!featuresObj?.produtos;
      if (defaultPlan) return !!defaultPlan.allow_products || !!featuresObj?.produtos;
      return false;
    }
    return !!featuresObj[key];
  };

  const hasAnyPermission = (prefix: string) => {
    if (isSuperAdmin) return true;
    
    if (!Array.isArray(permissionsArr) || permissionsArr.length === 0) return false;

    // Verifica se alguma permissão do plano começa com o prefixo (ex: "equipe.", "agenda.", "produto.") ou se tem '*'
    if (permissionsArr.includes('*')) return true;
    return permissionsArr.some(p => p.startsWith(prefix) || p.startsWith(`${prefix}.`));
  };

  const getPlanLimit = (key: string): number | 'unlimited' => {
    if (isSuperAdmin) return 'unlimited';
    
    const val = limitsObj[key];
    if (val === undefined || val === null) {
      // Fallback: se não declarou limite, assume 0 (bloqueado)
      return 0;
    }
    if (val === -1 || val === 'unlimited') return 'unlimited';
    
    return Number(val);
  };

  const checkLimit = (key: string, currentUsage: number) => {
    if (isSuperAdmin) return true;
    
    const limit = getPlanLimit(key);
    if (limit === 'unlimited') return true;
    
    return currentUsage < limit;
  };

  const getEffectivePermissions = () => {
    if (isSuperAdmin) return ['*'];
    // Intersecção do plano com a role
    return rolePermissions.filter(p => permissionsArr.includes(p) || permissionsArr.length === 0);
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
    defaultPlan
  };
}
