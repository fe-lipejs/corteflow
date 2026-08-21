import { usePermissionEngine } from './usePermissionEngine';

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
  custom_colors: boolean;
  online_payments: boolean;
  whatsapp_reminders: boolean;
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

const NO_PLAN_FEATURES: PlanFeatures = {
  agenda: false,
  clientes: false,
  equipe: false,
  servicos: false,
  produtos: false,
  financeiro: false,
  relatorios: false,
  custom_colors: false,
  online_payments: false,
  whatsapp_reminders: false,
  configuracoes: true,
  assinatura: true,
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

export function usePlanFeatures(): { features: PlanFeatures; isLoading: boolean } {
  // Consome a nova engine por baixo dos panos para evitar refetch duplo
  const engine = usePermissionEngine();

  if (engine.isLoading) {
    return { features: NO_PLAN_FEATURES, isLoading: true };
  }

  const sub = engine.subscription;
  const defaultPlan = engine.defaultPlan;
  
  let featuresObj: PlanFeatures = { ...NO_PLAN_FEATURES };

  // Se o super admin estiver logado, a engine assume que a subcription is null mas hasFeature retorna true.
  // Vamos tratar o fallback para super admin:
  if (engine.hasFeature('super_admin_override')) { 
     // engine treats super_admin automatically, but let's just map explicitly for PlanFeatures
  }

  // Helper para mapear status
  let subStatus = sub?.status || null;
  const isTrial = subStatus === 'trial' || subStatus === 'trialing';
  let isActive = subStatus === 'active' || isTrial || subStatus === 'past_due';
  
  if (!sub && defaultPlan) {
    subStatus = 'canceled';
    isActive = true;
  }
  
  // Trial expirado lido do banco
  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const trialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
  if (subStatus === 'trial' && trialExpired) {
    subStatus = 'trial_expired';
    isActive = false;
  }

  featuresObj = {
    agenda: engine.hasFeature('agenda'),
    clientes: engine.hasFeature('clientes'),
    equipe: engine.hasFeature('equipe'),
    servicos: engine.hasFeature('servicos'),
    produtos: engine.hasFeature('produtos'),
    financeiro: engine.hasFeature('financeiro'),
    relatorios: engine.hasFeature('relatorios'),
    custom_colors: engine.hasFeature('custom_colors'),
    online_payments: engine.hasFeature('online_payments'),
    whatsapp_reminders: engine.hasFeature('whatsapp_reminders'),
    configuracoes: true, // Sempre true para poder acessar settings
    assinatura: true,    // Sempre true para assinar
    
    // Limits convertidos de volta para max_professionals para não quebrar a tela antiga
    max_professionals: engine.getPlanLimit('profissionais') === 'unlimited' ? 999 : (engine.getPlanLimit('profissionais') as number),
    allow_products: engine.hasFeature('produtos'), // Ou se tivermos allow_products, usamos
    
    plan_key: sub?.plans?.key || defaultPlan?.key || null,
    plan_name: sub?.plans?.name || defaultPlan?.name || null,
    
    subscription_status: subStatus,
    trial_ends_at: sub?.trial_ends_at || null,
    grace_period_ends_at: sub?.grace_period_ends_at || null,
    suspension_reason: sub?.suspension_reason || null,
    canceled_at: sub?.canceled_at || null,
    
    is_trial: isTrial,
    is_active: isActive,
    has_subscription: !!sub || !!defaultPlan,
  };

  return { features: featuresObj, isLoading: false };
}

