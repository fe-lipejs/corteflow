import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

export interface PlanFeatures {
  // Core
  agenda: boolean;
  clientes: boolean;
  equipe: boolean;
  servicos: boolean;
  // Advanced
  produtos: boolean;
  financeiro: boolean;
  relatorios: boolean;
  configuracoes: boolean;
  assinatura: boolean;
  // Limits
  max_professionals: number;
  allow_products: boolean;
  // Plan info
  plan_key: string | null;
  plan_name: string | null;
}

const DEFAULT_FEATURES: PlanFeatures = {
  agenda: true,
  clientes: true,
  equipe: true,
  servicos: true,
  produtos: false,
  financeiro: false,
  relatorios: false,
  configuracoes: true,
  assinatura: true,
  max_professionals: 1,
  allow_products: false,
  plan_key: null,
  plan_name: null,
};

// Features available by plan key
const PLAN_FEATURE_MAP: Record<string, Partial<PlanFeatures>> = {
  starter: {
    agenda: true,
    clientes: true,
    equipe: true,
    servicos: true,
    produtos: false,
    financeiro: false,
    relatorios: false,
    allow_products: false,
  },
  growth: {
    agenda: true,
    clientes: true,
    equipe: true,
    servicos: true,
    produtos: true,
    financeiro: true,
    relatorios: true,
    allow_products: true,
  },
  pro: {
    agenda: true,
    clientes: true,
    equipe: true,
    servicos: true,
    produtos: true,
    financeiro: true,
    relatorios: true,
    allow_products: true,
  },
  premium: {
    agenda: true,
    clientes: true,
    equipe: true,
    servicos: true,
    produtos: true,
    financeiro: true,
    relatorios: true,
    allow_products: true,
  },
  enterprise: {
    agenda: true,
    clientes: true,
    equipe: true,
    servicos: true,
    produtos: true,
    financeiro: true,
    relatorios: true,
    allow_products: true,
  },
};

export function usePlanFeatures(): { features: PlanFeatures; isLoading: boolean } {
  const { tenantId, role } = useAuth();

  const { data: features = DEFAULT_FEATURES, isLoading } = useQuery({
    queryKey: ['plan_features', tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 min cache
    queryFn: async () => {
      // super_admin always has all features
      if (role === 'super_admin') {
        return {
          ...DEFAULT_FEATURES,
          produtos: true,
          financeiro: true,
          relatorios: true,
          allow_products: true,
          max_professionals: 999,
          plan_key: 'super_admin',
          plan_name: 'Super Admin',
        } as PlanFeatures;
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, plans (key, name, max_professionals, allow_products)')
        .eq('tenant_id', tenantId!)
        .in('status', ['active', 'trial'])
        .order('status', { ascending: false }) // 'active' before 'trial'
        .limit(1)
        .maybeSingle();

      if (!sub) return DEFAULT_FEATURES;

      const plan = (sub as any).plans;
      if (!plan) return DEFAULT_FEATURES;

      const planKey = plan.key as string;
      const planFeatures = PLAN_FEATURE_MAP[planKey] ?? {};

      return {
        ...DEFAULT_FEATURES,
        ...planFeatures,
        max_professionals: plan.max_professionals ?? 1,
        allow_products: plan.allow_products ?? false,
        plan_key: planKey,
        plan_name: plan.name,
      } as PlanFeatures;
    }
  });

  return { features, isLoading };
}
