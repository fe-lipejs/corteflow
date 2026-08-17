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

      const { data: sub } = await supabase
        .from('subscriptions')
        .select(`
          status,
          trial_ends_at,
          current_period_end,
          grace_period_ends_at,
          suspension_reason,
          canceled_at,
          subscription_contracts (
            max_professionals,
            allow_products,
            features,
            permissions,
            limits
          ),
          plans (
            key,
            name,
            max_professionals,
            allow_products,
            features,
            permissions,
            limits
          )
        `)
        .eq('tenant_id', tenantId!)
        .in('status', ['active', 'trialing', 'trial', 'past_due', 'canceled'])
        .order('status', { ascending: false }) // active first
        .limit(1)
        .maybeSingle();

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
  const sub = subData?.sub;
  const defaultPlan = subData?.defaultPlan;
  const contract = sub?.subscription_contracts;

  // Resolve active sources (Contract or Default Plan)
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
      featuresObj = contract.features || {};
      permissionsArr = Array.isArray(contract.permissions) ? contract.permissions : [];
      limitsObj = contract.limits || {};
      
      // Retrocompatibility parsing for limits if max_professionals is used
      if (!limitsObj.profissionais && contract.max_professionals) {
        limitsObj.profissionais = contract.max_professionals;
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
  const hasFeature = (key: string) => {
    if (isSuperAdmin) return true;
    if (key === 'produtos') {
      if (contract) return !!contract.allow_products;
      if (defaultPlan) return !!defaultPlan.allow_products;
      return false;
    }
    return !!featuresObj[key];
  };

  const hasPermission = (key: string) => {
    if (isSuperAdmin) return true;
    
    // The role must have it
    const roleHasIt = rolePermissions.includes(key) || rolePermissions.includes('*');
    if (!roleHasIt) return false;

    // AND the plan must allow it
    // Se o array de permissões do contrato for vazio, fallback para true 
    // temporariamente dependendo da estratégia, para não quebrar legados que 
    // ainda não tem permissions no JSONB.
    if (permissionsArr.length === 0) return true; 

    return permissionsArr.includes(key) || permissionsArr.includes('*');
  };

  const hasAnyPermission = (prefix: string) => {
    if (isSuperAdmin) return true;
    
    // Se não há permissões restritas no plano, o legado tem acesso (a regra acima já trata o fallback).
    if (permissionsArr.length === 0) return true;

    // Verifica se alguma permissão do plano começa com o prefixo (ex: "equipe.")
    return permissionsArr.some(p => p.startsWith(prefix));
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
