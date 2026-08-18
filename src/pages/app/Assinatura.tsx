import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { usePlanFeatures } from '../../hooks/usePlanFeatures';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, ExternalLink, CheckCircle, Zap, Clock, AlertTriangle, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  max_professionals: number;
  allow_products: boolean;
  trial_days: number;
  is_default?: boolean;
  features: any;
  permissions?: any;
  limits?: any;
  plan_prices: Array<{ currency: string; amount: number }>;
  is_custom_price?: boolean;
}

interface Subscription {
  id: string;
  status: string;
  plan_id: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  subscription_contracts?: any;
}

function getDisplayFeatures(plan: Plan): string[] {
  if (!plan.features) return [];
  const f = plan.features;
  if (Array.isArray(f)) return f;
  if (f.display_features && Array.isArray(f.display_features)) return f.display_features;
  return [];
}

function getFeatureFlags(plan: Plan): Record<string, boolean> {
  const permissions = Array.isArray(plan.permissions) ? plan.permissions : [];
  
  return {
    agenda: permissions.some((p: string) => p.startsWith('agenda.')) || plan.features?.agenda,
    equipe: permissions.some((p: string) => p.startsWith('equipe.')) || plan.features?.equipe,
    catalogo: permissions.some((p: string) => p.startsWith('catalogo.') || p.startsWith('servico.')) || plan.features?.servicos,
    produtos: permissions.some((p: string) => p.startsWith('produto.')) || plan.allow_products || plan.features?.produtos,
    clientes: permissions.some((p: string) => p.startsWith('clientes.')) || plan.features?.clientes,
    financeiro: permissions.some((p: string) => p.startsWith('financeiro.')) || plan.features?.financeiro,
    relatorios: permissions.some((p: string) => p.startsWith('relatorios.')) || plan.features?.relatorios,
    configuracoes: permissions.some((p: string) => p.startsWith('configuracoes.')) || plan.features?.configuracoes,
  };
}

const FEATURE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  equipe: 'Equipe',
  servicos: 'Serviços',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  produtos: 'Produtos',
};

export default function Assinatura() {
  const { tenant, profile } = useAuth();
  const { theme } = useTheme();
  const { features } = usePlanFeatures();
  const queryClient = useQueryClient();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenant) return;
    try {
      const [{ data: subsData }, { data: planData }, { data: customPricingData }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, subscription_contracts(*), plans(*)')
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false }),
        supabase.from('plans').select('*, plan_prices(*)').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('custom_pricing').select('*').eq('tenant_id', tenant.id)
      ]);

      let activeSub = subsData?.find((s: any) => s.status === 'active' || s.status === 'trialing') ||
                      subsData?.find((s: any) => s.status === 'trial') ||
                      subsData?.find((s: any) => s.status === 'past_due') ||
                      subsData?.[0] || null;

      // Auto-sync em background com Stripe caso a assinatura não esteja ativa no banco local
      if ((!activeSub || activeSub.status !== 'active') && tenant) {
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
                .select('*, subscription_contracts(*), plans(*)')
                .eq('tenant_id', tenant.id)
                .order('updated_at', { ascending: false });

              const newActiveSub = refreshedSubs?.find((s: any) => s.status === 'active' || s.status === 'trialing');
              if (newActiveSub) {
                activeSub = newActiveSub;
                queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
                queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
                queryClient.invalidateQueries({ queryKey: ['plan_features'] });
              }
            }
          }
        } catch (_) {}
      }

      if (activeSub) setSubscription(activeSub as any);
      
      if (planData) {
        const plansWithCustomPrices = planData.map((plan: any) => {
          const customPrice = customPricingData?.find(cp => cp.plan_id === plan.id);
          if (customPrice && plan.plan_prices) {
            const brlPriceIndex = plan.plan_prices.findIndex((p: any) => p.currency === 'BRL');
            if (brlPriceIndex >= 0) {
              plan.plan_prices[brlPriceIndex].amount = customPrice.amount_override;
            } else {
              plan.plan_prices.push({ currency: 'BRL', amount: customPrice.amount_override });
            }
            plan.is_custom_price = true;
          }
          return plan;
        });

        const sortedPlans = plansWithCustomPrices.sort((a: any, b: any) => {
          if (a.is_default) return -1;
          if (b.is_default) return 1;
          
          const aPrice = a.plan_prices?.find((p: any) => p.currency === 'BRL')?.amount || 0;
          const bPrice = b.plan_prices?.find((p: any) => p.currency === 'BRL')?.amount || 0;
          return aPrice - bPrice;
        });

        setPlans(sortedPlans);
      }
    } catch (e) {
      console.error('Erro ao buscar dados de assinatura:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant, queryClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId && tenant) {
      const verifySession = async () => {
        try {
          setSyncing(true);
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ sessionId })
          });

          if (res.ok) {
            setSyncSuccessMessage('🎉 Pagamento confirmado com sucesso! Seu plano foi ativado.');
            window.history.replaceState({}, document.title, window.location.pathname);
            queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
            queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
            queryClient.invalidateQueries({ queryKey: ['plan_features'] });
            await fetchData();
          }
        } catch (e) {
          console.error('Erro ao verificar sessão do Stripe:', e);
        } finally {
          setSyncing(false);
        }
      };
      verifySession();
    }
  }, [tenant, queryClient, fetchData]);

  const handleSyncWithStripe = async () => {
    if (!tenant) return;
    try {
      setSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar com Stripe');

      if (data.synced) {
        setSyncSuccessMessage('✅ Assinatura sincronizada com sucesso diretamente do Stripe!');
        queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
        queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
        queryClient.invalidateQueries({ queryKey: ['plan_features'] });
        await fetchData();
      } else {
        alert(data.message || 'Nenhuma assinatura ativa encontrada no Stripe.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ returnUrl: window.location.href })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir portal do cliente');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      alert(`Erro ao abrir portal de pagamentos: ${err.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? O cancelamento ocorrerá ao final do período já pago e você não será mais cobrado.')) return;
    
    setCancelLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao cancelar assinatura');
      }

      alert('Assinatura cancelada com sucesso. Você terá acesso até o final do período atual.');
      
      setSubscription(prev => prev ? { ...prev, status: 'canceled' } : null);
      queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
      queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
      queryClient.invalidateQueries({ queryKey: ['plan_features'] });
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    if (!tenant) return;
    try {
      setCheckoutLoading(planId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          planId,
          returnUrl: window.location.href,
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro na API: ${res.status} ${errorText}`);
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert(`Erro ao iniciar assinatura: ${err.message}`);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const money = (amount: number, currency: string) => {
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
          <span className="text-sm" style={{ color: theme.textMuted }}>Carregando planos...</span>
        </div>
      </div>
    );
  }

  const isTrialExpired = features.subscription_status === 'trial_expired';
  const isTrial = features.is_trial && !isTrialExpired;
  const hasActivePlan = features.is_active && !isTrialExpired;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Minha Assinatura</p>
        <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Planos & Faturamento</h1>
      </header>

      {/* Sync Success Alert */}
      {syncSuccessMessage && (
        <div className="p-4 rounded-2xl border flex items-center justify-between gap-3 bg-emerald-500/10 border-emerald-500/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm font-semibold text-emerald-300">{syncSuccessMessage}</p>
          </div>
          <button onClick={() => setSyncSuccessMessage(null)} className="text-xs text-emerald-400 hover:underline">
            Fechar
          </button>
        </div>
      )}

      {/* Trial expired banner */}
      {isTrialExpired && (
        <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ background: `${theme.warning}10`, borderColor: `${theme.warning}30` }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.warning }} />
          <div>
            <p className="font-bold text-sm" style={{ color: theme.warning }}>Seu período de teste encerrou</p>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              Para continuar usando o sistema, escolha um dos planos abaixo.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Canceled Banner */}
      {subscription?.status === 'canceled' && (
        <div className="p-5 rounded-2xl border flex items-start gap-3 bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-400">Assinatura Cancelada</p>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Sua assinatura foi cancelada com sucesso. Seu plano permanecerá <strong>ativo até {formatDate(subscription?.current_period_end || subscription?.trial_ends_at)}</strong> para você usufruir de todo o período já faturado.
            </p>
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-1">
              ✓ Nenhuma nova cobrança será realizada no seu cartão de crédito.
            </p>
          </div>
        </div>
      )}

      {/* Trial active banner */}
      {isTrial && (
        <div className="p-4 rounded-2xl border flex items-start gap-3" style={{ background: `${theme.info}10`, borderColor: `${theme.info}30` }}>
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.info }} />
          <div>
            <p className="font-bold text-sm" style={{ color: theme.info }}>
              Você está no período de teste — encerra em {formatDate(subscription?.trial_ends_at || null)}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              Escolha um plano para continuar depois do trial. Não haverá cobrança até o encerramento do período de teste.
            </p>
          </div>
        </div>
      )}

      {/* Current plan summary if active subscription */}
      {hasActivePlan && !isTrial && subscription?.stripe_subscription_id && (
        <div className="p-6 rounded-3xl border glass-card flex flex-col md:flex-row items-center gap-6" style={{ borderColor: theme.border }}>
          <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center shrink-0"
            style={{ background: theme.inputBg, borderColor: theme.accent, color: theme.accent, boxShadow: theme.shadowAccent }}>
            <Crown className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{features.plan_name}</h2>
            <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
              Assinatura ativa • Próxima cobrança: {formatDate(subscription.current_period_end)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center justify-center gap-2 px-5 py-2.5 border rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }}
              onClick={handleOpenCustomerPortal}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" style={{ color: theme.accent }} />}
              {portalLoading ? 'Abrindo Portal...' : 'Portal de Pagamento'}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-base font-bold mb-4" style={{ color: theme.textPrimary }}>
          {hasActivePlan && !isTrial ? 'Alterar Plano' : 'Escolha seu plano'}
        </h2>

        {plans.length === 0 ? (
          <div className="text-center py-16 border rounded-2xl" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${theme.accent}20` }}>
              <Crown className="w-8 h-8" style={{ color: theme.accent }} />
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: theme.textPrimary }}>Nenhum plano disponível</h3>
            <p className="text-sm max-w-sm mx-auto" style={{ color: theme.textSecondary }}>
              Os planos ainda não foram configurados. Se você é o administrador da plataforma,
              acesse o painel Admin para criar os planos.
            </p>
            {profile?.role === 'super_admin' && (
              <a
                href="/admin/planos"
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-xl font-bold text-sm"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Ir para Admin → Planos
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.filter(plan => {
              // Ocultar Plano Gratuito se o usuário tiver uma assinatura paga ativa
              const hasActivePaidPlan = subscription && (subscription.status === 'active' || subscription.status === 'trialing') && plans.some(p => p.id === subscription.plan_id && !p.is_default);
              
              if (plan.is_default && hasActivePaidPlan) {
                return false;
              }
              return true;
            }).map((plan) => {
              const isCanceled = subscription?.status === 'canceled';
              const hasActiveSub = subscription && subscription.status !== 'canceled';
              const isCurrent = hasActiveSub 
                ? subscription.plan_id === plan.id 
                : Boolean(plan.is_default);
              
              // Se for o plano atual e existir um contrato, o contrato manda nos limites e preço!
              let planToDisplay = plan;
              if (isCurrent && subscription?.subscription_contracts && !Array.isArray(subscription.subscription_contracts)) {
                const contract = subscription.subscription_contracts as any;
                planToDisplay = {
                  ...plan,
                  max_professionals: contract.max_professionals,
                  allow_products: contract.allow_products,
                  features: contract.features,
                  permissions: contract.permissions,
                  limits: contract.limits,
                  plan_prices: [{ currency: contract.currency, amount: contract.price_amount }]
                };
              } else if (isCurrent && subscription?.subscription_contracts && Array.isArray(subscription.subscription_contracts) && subscription.subscription_contracts.length > 0) {
                const contract = subscription.subscription_contracts[0] as any;
                planToDisplay = {
                  ...plan,
                  max_professionals: contract.max_professionals,
                  allow_products: contract.allow_products,
                  features: contract.features,
                  permissions: contract.permissions,
                  limits: contract.limits,
                  plan_prices: [{ currency: contract.currency, amount: contract.price_amount }]
                };
              }

              const brlPrice = planToDisplay.plan_prices?.find((p: any) => p.currency === 'BRL');
              const displayFeatures = getDisplayFeatures(planToDisplay);
              const flags = getFeatureFlags(planToDisplay);
              
              const limitsObj = planToDisplay.limits || {};
              const maxProf = limitsObj.profissionais ?? planToDisplay.max_professionals;
              const displayMaxProf = maxProf === 'unlimited' || maxProf === -1 || maxProf === 999 
                ? 'Ilimitados' 
                : `Até ${maxProf} ${maxProf === 1 ? 'profissional' : 'profissionais'}`;

              const isLoading = checkoutLoading === plan.id;

              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border flex flex-col overflow-hidden transition-all"
                  style={{
                    borderColor: isCurrent ? theme.accent : theme.border,
                    background: theme.cardBg,
                    boxShadow: isCurrent ? theme.shadowAccent : 'none',
                  }}
                >
                  {/* Plan header */}
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-xl font-bold" style={{ color: theme.textPrimary }}>{planToDisplay.name}</h3>
                      {isCurrent && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full flex flex-col items-end" style={{ background: `${theme.accent}20`, color: theme.accent }}>
                          <span>Plano Atual</span>
                          {subscription?.subscription_contracts && (
                            <span className="text-[10px] opacity-70">Contrato Preservado</span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>{planToDisplay.description}</p>

                    {/* Price */}
                    <div className="mb-4">
                      {brlPrice ? (
                        <div className="flex flex-col gap-1">
                          {plan.is_custom_price && (
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                              ✨ Preço Especial
                            </span>
                          )}
                          <div className="flex items-end gap-1">
                            <span className="text-3xl font-black" style={{ color: theme.textPrimary }}>
                              {money(brlPrice.amount, 'BRL')}
                            </span>
                            <span className="text-sm mb-1" style={{ color: theme.textMuted }}>/mês</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: theme.textMuted }}>Preço sob consulta</span>
                      )}
                    </div>

                    {/* Trial */}
                    <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {planToDisplay.trial_days} dias de teste grátis
                    </p>

                    {/* Feature flags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {Object.entries(flags).map(([key, enabled]) => (
                        <span
                          key={key}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all"
                          style={{
                            borderColor: enabled ? `${theme.success}30` : theme.border,
                            color: enabled ? theme.success : theme.textMuted,
                            background: enabled ? `${theme.success}12` : `${theme.border}30`,
                          }}
                        >
                          {enabled ? '✓' : '✕'} {FEATURE_LABELS[key]}
                        </span>
                      ))}
                    </div>

                    {/* Limits */}
                    <div className="text-sm font-medium flex items-center gap-2" style={{ color: theme.textPrimary }}>
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: `${theme.accent}20`, color: theme.accent }}>👥</span>
                      <span>{displayMaxProf}</span>
                    </div>

                    {/* Display features bullets */}
                    {displayFeatures.length > 0 && (
                      <ul className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: theme.border }}>
                        {displayFeatures.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: theme.textSecondary }}>
                            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: theme.accent }} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => !plan.is_default ? handleCheckout(plan.id) : null}
                      disabled={isLoading || isCurrent || plan.is_default}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:opacity-95 cursor-pointer"
                      style={{
                        background: isCurrent ? theme.bgHover : (plan.is_default ? theme.bgHover : theme.accentGradient),
                        color: isCurrent ? theme.textSecondary : (plan.is_default ? theme.textMuted : theme.btnPrimaryText),
                        boxShadow: isCurrent || plan.is_default ? 'none' : theme.shadowAccent,
                      }}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : isCurrent ? (
                        'Plano Atual'
                      ) : plan.is_default ? (
                        'Seu Plano Básico' // If it's not current, but it's default, they can't explicitly 'checkout' to it, they must cancel.
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Assinar este plano
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAQ section */}
      <div className="p-6 rounded-2xl border" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <h3 className="font-bold mb-4" style={{ color: theme.textPrimary }}>Dúvidas frequentes</h3>
        <div className="space-y-4 text-sm" style={{ color: theme.textSecondary }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: theme.textPrimary }}>Posso cancelar quando quiser?</p>
            <p>Sim. Não há fidelidade. O acesso continua ativo até o fim do período já pago.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: theme.textPrimary }}>Formas de pagamento aceitas?</p>
            <p>Cartão de crédito e débito via Stripe. Processamento 100% seguro.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: theme.textPrimary }}>Meus dados ficam seguros?</p>
            <p>Sim. Os dados ficam isolados por salão via Row Level Security no Supabase.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
