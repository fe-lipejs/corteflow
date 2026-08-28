import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { usePlanFeatures } from '../../hooks/usePlanFeatures';
import { useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

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
  plan_prices: Array<{
    currency: string;
    amount: number;
  }>;
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

  if (
    f.display_features &&
    Array.isArray(f.display_features)
  ) {
    return f.display_features;
  }

  return [];
}

export default function Assinatura() {
  const { tenant, profile } = useAuth();
  const { theme } = useTheme();
  const { features } = usePlanFeatures();
  const queryClient = useQueryClient();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] =
    useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [cancelLoading, setCancelLoading] =
    useState(false);

  const [syncSuccessMessage, setSyncSuccessMessage] =
    useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenant) return;

    try {
      const [
        { data: subsData },
        { data: planData },
        { data: customPricingData },
      ] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, subscription_contracts(*), plans(*)')
          .eq('tenant_id', tenant.id)
          .order('updated_at', {
            ascending: false,
          }),

        supabase
          .from('plans')
          .select('*, plan_prices(*)')
          .eq('active', true)
          .order('sort_order', {
            ascending: true,
          }),

        supabase
          .from('custom_pricing')
          .select('*')
          .eq('tenant_id', tenant.id),
      ]);

      let activeSub =
        subsData?.find(
          (s: any) =>
            s.status === 'active' ||
            s.status === 'trialing'
        ) ||
        subsData?.find(
          (s: any) => s.status === 'trial'
        ) ||
        subsData?.find(
          (s: any) => s.status === 'past_due'
        ) ||
        subsData?.[0] ||
        null;

      /*
       * Sincronização automática com Stripe.
       */
      if (
        (!activeSub ||
          activeSub.status !== 'active') &&
        tenant
      ) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            const syncRes = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );

            const syncData = await syncRes.json();

            if (syncData.synced) {
              const {
                data: refreshedSubs,
              } = await supabase
                .from('subscriptions')
                .select(
                  '*, subscription_contracts(*), plans(*)'
                )
                .eq('tenant_id', tenant.id)
                .order('updated_at', {
                  ascending: false,
                });

              const newActiveSub =
                refreshedSubs?.find(
                  (s: any) =>
                    s.status === 'active' ||
                    s.status === 'trialing'
                );

              if (newActiveSub) {
                activeSub = newActiveSub;

                queryClient.invalidateQueries({
                  queryKey: [
                    'active_subscription_contract',
                  ],
                });

                queryClient.invalidateQueries({
                  queryKey: ['permission_engine'],
                });

                queryClient.invalidateQueries({
                  queryKey: ['plan_features'],
                });
              }
            }
          }
        } catch (_) {
          // Não bloqueia a tela caso a sincronização falhe.
        }
      }

      if (activeSub) {
        setSubscription(activeSub as any);
      }

      if (planData) {
        const validPlans = planData.filter(
          (p: any) =>
            p.name !== 'Trial (Período de Teste)' &&
            p.key !== 'expired_tier' &&
            !p.is_trial_plan
        );

        const plansWithCustomPrices =
          validPlans.map((plan: any) => {
            const customPrice =
              customPricingData?.find(
                (cp: any) =>
                  cp.plan_id === plan.id
              );

            if (
              customPrice &&
              plan.plan_prices
            ) {
              const brlIndex =
                plan.plan_prices.findIndex(
                  (p: any) =>
                    p.currency === 'BRL'
                );

              if (brlIndex >= 0) {
                plan.plan_prices[
                  brlIndex
                ].amount =
                  customPrice.amount_override;
              } else {
                plan.plan_prices.push({
                  currency: 'BRL',
                  amount:
                    customPrice.amount_override,
                });
              }

              plan.is_custom_price = true;
            }

            return plan;
          });

        const sortedPlans =
          plansWithCustomPrices.sort(
            (a: any, b: any) => {
              if (a.is_default) return -1;
              if (b.is_default) return 1;

              const aPrice =
                a.plan_prices?.find(
                  (p: any) =>
                    p.currency === 'BRL'
                )?.amount || 0;

              const bPrice =
                b.plan_prices?.find(
                  (p: any) =>
                    p.currency === 'BRL'
                )?.amount || 0;

              return aPrice - bPrice;
            }
          );

        setPlans(sortedPlans);
      }
    } catch (e) {
      console.error(
        'Erro ao buscar dados de assinatura:',
        e
      );
    } finally {
      setLoading(false);
    }
  }, [tenant, queryClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /*
   * Confirmação do checkout.
   */
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const sessionId =
      params.get('session_id');

    if (!sessionId || !tenant) return;

    const verifySession = async () => {
      try {
        setSyncing(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              sessionId,
            }),
          }
        );

        if (res.ok) {
          setSyncSuccessMessage(
            'Pagamento confirmado. Seu plano já está ativo.'
          );

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          queryClient.invalidateQueries({
            queryKey: [
              'active_subscription_contract',
            ],
          });

          queryClient.invalidateQueries({
            queryKey: ['permission_engine'],
          });

          queryClient.invalidateQueries({
            queryKey: ['plan_features'],
          });

          await fetchData();
        }
      } catch (e) {
        console.error(
          'Erro ao verificar checkout:',
          e
        );
      } finally {
        setSyncing(false);
      }
    };

    verifySession();
  }, [tenant, queryClient, fetchData]);

  const handleSyncWithStripe = async () => {
    if (!tenant) return;

    try {
      setSyncing(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Não autenticado');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          'Erro ao sincronizar com Stripe'
        );
      }

      if (data.synced) {
        setSyncSuccessMessage(
          'Assinatura sincronizada com sucesso.'
        );

        queryClient.invalidateQueries({
          queryKey: [
            'active_subscription_contract',
          ],
        });

        queryClient.invalidateQueries({
          queryKey: ['permission_engine'],
        });

        queryClient.invalidateQueries({
          queryKey: ['plan_features'],
        });

        await fetchData();
      } else {
        alert(
          data.message ||
          'Nenhuma assinatura ativa encontrada no Stripe.'
        );
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Não autenticado');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            returnUrl: window.location.href,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          'Erro ao abrir portal do cliente'
        );
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);

      alert(
        `Erro ao abrir portal de pagamentos: ${err.message}`
      );
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = confirm(
      'Tem certeza que deseja cancelar sua assinatura? O acesso continuará disponível até o final do período atual.'
    );

    if (!confirmed) return;

    setCancelLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Não autenticado');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const errData =
          await res.json().catch(() => ({}));

        throw new Error(
          errData.error ||
          'Erro ao cancelar assinatura'
        );
      }

      alert(
        'Assinatura cancelada com sucesso. Você continuará com acesso até o final do período atual.'
      );

      setSubscription((prev) =>
        prev
          ? {
            ...prev,
            status: 'canceled',
          }
          : null
      );

      queryClient.invalidateQueries({
        queryKey: [
          'active_subscription_contract',
        ],
      });

      queryClient.invalidateQueries({
        queryKey: ['permission_engine'],
      });

      queryClient.invalidateQueries({
        queryKey: ['plan_features'],
      });

      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCheckout = async (
    planId: string
  ) => {
    if (!tenant) return;

    try {
      setCheckoutLoading(planId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Não autenticado');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            planId,
            returnUrl:
              window.location.href,
          }),
        }
      );

      if (!res.ok) {
        const errorText =
          await res.text();

        throw new Error(
          `Erro na API: ${res.status} ${errorText}`
        );
      }

      const { url } =
        await res.json();

      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error(
        'Checkout error:',
        err
      );

      alert(
        `Erro ao iniciar assinatura: ${err.message}`
      );
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatDate = (
    dateStr: string | null
  ) => {
    if (!dateStr) return '—';

    return new Date(
      dateStr
    ).toLocaleDateString(
      'pt-BR',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    );
  };

  const money = (
    amount: number,
    currency: string
  ) => {
    const locale =
      currency === 'BRL'
        ? 'pt-BR'
        : 'en-US';

    return new Intl.NumberFormat(
      locale,
      {
        style: 'currency',
        currency,
      }
    ).format(amount);
  };

  if (loading) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="w-7 h-7 animate-spin"
            style={{
              color: theme.accent,
            }}
          />

          <span
            className="text-sm"
            style={{
              color: theme.textMuted,
            }}
          >
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  const isTrialExpired =
    features.subscription_status ===
    'trial_expired';

  const isTrial =
    features.is_trial &&
    !isTrialExpired;

  const hasActivePlan =
    features.is_active &&
    !isTrialExpired;

  const displayCurrency =
    tenant?.language === 'en'
      ? 'USD'
      : ['es', 'fr', 'de'].includes(
        tenant?.language || ''
      )
        ? 'EUR'
        : 'BRL';

  const configuredTrialPlan =
    plans.find(
      (p) =>
        (p as any).is_trial_plan ||
        p.is_default ||
        p.trial_days > 0
    );

  const activeTrialDays =
    configuredTrialPlan?.trial_days || 7;

  return (
    <div
      className="max-w-5xl mx-auto pb-10 px-4 sm:px-6 animate-fade-in"
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="mb-8">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
          style={{
            color: theme.textMuted,
          }}
        >
          Minha conta
        </p>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="font-serif text-3xl font-bold tracking-tight"
              style={{
                color: theme.textPrimary,
              }}
            >
              Assinatura
            </h1>

            <p
              className="text-sm mt-1"
              style={{
                color: theme.textSecondary,
              }}
            >
              Seu negócio merece uma operação à altura.
            </p>
          </div>

          {hasActivePlan &&
            !isTrial &&
            subscription?.stripe_subscription_id && (
              <button
                onClick={
                  handleOpenCustomerPortal
                }
                disabled={portalLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:shadow-sm disabled:opacity-60"
                style={{
                  borderColor: theme.border,
                  background:
                    theme.cardBg,
                  color:
                    theme.textPrimary,
                }}
              >
                {portalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink
                    className="w-3.5 h-3.5"
                    style={{
                      color:
                        theme.accent,
                    }}
                  />
                )}

                Gerenciar assinatura
              </button>
            )}
        </div>
      </header>

      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {syncSuccessMessage && (
        <div
          className="mb-6 px-4 py-3 rounded-xl border flex items-center justify-between gap-3"
          style={{
            background:
              'rgba(16,185,129,0.08)',
            borderColor:
              'rgba(16,185,129,0.20)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />

            <span className="text-xs font-semibold text-emerald-600">
              {syncSuccessMessage}
            </span>
          </div>

          <button
            onClick={() =>
              setSyncSuccessMessage(null)
            }
            className="text-[11px] text-emerald-600 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ======================================================
          STATUS
      ====================================================== */}

      {isTrialExpired && (
        <div
          className="mb-6 px-4 py-3.5 rounded-xl border flex items-center gap-3"
          style={{
            background: `${theme.warning}08`,
            borderColor: `${theme.warning}25`,
          }}
        >
          <AlertTriangle
            className="w-4 h-4 shrink-0"
            style={{
              color: theme.warning,
            }}
          />

          <div>
            <p
              className="text-xs font-bold"
              style={{
                color: theme.warning,
              }}
            >
              Seu período de teste terminou.
            </p>

            <p
              className="text-xs mt-0.5"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Escolha um plano para continuar.
            </p>
          </div>
        </div>
      )}

      {subscription?.status ===
        'canceled' && (
          <div
            className="mb-6 px-4 py-3.5 rounded-xl border flex items-center gap-3"
            style={{
              background:
                'rgba(245,158,11,0.07)',
              borderColor:
                'rgba(245,158,11,0.20)',
            }}
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />

            <div>
              <p className="text-xs font-bold text-amber-600">
                Assinatura cancelada
              </p>

              <p className="text-xs mt-0.5 text-amber-700/80">
                Seu acesso continua até{' '}
                <strong>
                  {formatDate(
                    subscription.current_period_end ||
                    subscription.trial_ends_at
                  )}
                </strong>
                .
              </p>
            </div>
          </div>
        )}

      {/* ======================================================
          CURRENT ACTIVE PLAN
      ====================================================== */}

      {hasActivePlan &&
        !isTrial &&
        subscription?.stripe_subscription_id && (
          <div
            className="mb-10 rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{
              background:
                theme.cardBg,
              borderColor:
                theme.border,
              boxShadow:
                '0 8px 30px rgba(15,23,42,0.05)',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  `${theme.accent}12`,
                color:
                  theme.accent,
              }}
            >
              <Crown className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color:
                    theme.textMuted,
                }}
              >
                Plano atual
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h2
                  className="text-lg font-bold"
                  style={{
                    color:
                      theme.textPrimary,
                  }}
                >
                  {features.plan_name}
                </h2>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ativo
                </span>
              </div>

              <p
                className="text-xs mt-0.5"
                style={{
                  color:
                    theme.textSecondary,
                }}
              >
                Próxima cobrança:{' '}
                {formatDate(
                  subscription.current_period_end
                )}
              </p>
            </div>
          </div>
        )}

      {/* ======================================================
          TRIAL — ULTRA COMPACT
      ====================================================== */}

      {isTrial && (
        <div
          className="mb-8 rounded-2xl border overflow-hidden"
          style={{
            background: theme.cardBg,
            borderColor:
              `${theme.accent}30`,
            boxShadow:
              `0 10px 35px -15px ${theme.accent}30`,
          }}
        >
          <div className="px-5 py-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  theme.accentGradient,
                color:
                  theme.btnPrimaryText,
              }}
            >
              <Sparkles className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      `${theme.accent}15`,
                    color:
                      theme.accent,
                  }}
                >
                  Teste ativo
                </span>

                <span
                  className="text-[10px]"
                  style={{
                    color:
                      theme.textMuted,
                  }}
                >
                  {activeTrialDays} dias grátis
                </span>
              </div>

              <p
                className="text-xs mt-1"
                style={{
                  color:
                    theme.textSecondary,
                }}
              >
                Você não paga nada durante o teste.
                Cancele quando quiser.
              </p>
            </div>

            <ShieldCheck className="ml-auto w-4 h-4 shrink-0 text-emerald-500" />
          </div>
        </div>
      )}

      {/* ======================================================
          PLANS
      ====================================================== */}

      <section>
        <div className="text-center mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
            style={{
              color: theme.accent,
            }}
          >
            Escolha seu próximo nível
          </p>

          <h2
            className="font-serif text-3xl font-bold tracking-tight"
            style={{
              color:
                theme.textPrimary,
            }}
          >
            Um plano que acompanha seu negócio.
          </h2>

          <p
            className="text-xs mt-2"
            style={{
              color:
                theme.textSecondary,
            }}
          >
            Simples. Completo. Sem fidelidade.
          </p>
        </div>

        {plans.length === 0 ? (
          <div
            className="text-center py-14 rounded-2xl border"
            style={{
              borderColor:
                theme.border,
              background:
                theme.cardBg,
            }}
          >
            <Crown
              className="w-7 h-7 mx-auto mb-3"
              style={{
                color: theme.accent,
              }}
            />

            <h3
              className="font-bold"
              style={{
                color:
                  theme.textPrimary,
              }}
            >
              Nenhum plano disponível
            </h3>

            {profile?.role ===
              'super_admin' && (
                <a
                  href="/platform/plans"
                  className="inline-flex mt-4 px-5 py-2.5 rounded-xl text-xs font-bold"
                  style={{
                    background:
                      theme.accentGradient,
                    color:
                      theme.btnPrimaryText,
                  }}
                >
                  Ir para planos
                </a>
              )}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row justify-center items-stretch gap-5 max-w-4xl mx-auto">
            {plans
              .filter((plan) => {
                const hasActivePaidPlan =
                  subscription &&
                  (
                    subscription.status ===
                    'active' ||
                    subscription.status ===
                    'trialing'
                  ) &&
                  plans.some(
                    (p) =>
                      p.id ===
                      subscription.plan_id &&
                      !p.is_default
                  );

                if (
                  plan.is_default &&
                  hasActivePaidPlan
                ) {
                  return false;
                }

                return true;
              })
              .map((plan) => {
                const isCanceled =
                  subscription?.status ===
                  'canceled';

                const hasActiveSub =
                  subscription &&
                  !isCanceled;

                const isCurrent =
                  hasActiveSub
                    ? subscription.plan_id ===
                    plan.id
                    : Boolean(
                      plan.is_default
                    );

                /*
                 * Contrato atual sempre
                 * prevalece sobre o plano.
                 */
                let planToDisplay = plan;

                const contracts =
                  subscription?.subscription_contracts;

                if (
                  isCurrent &&
                  contracts
                ) {
                  const contract =
                    Array.isArray(
                      contracts
                    )
                      ? contracts[0]
                      : contracts;

                  if (contract) {
                    planToDisplay = {
                      ...plan,
                      max_professionals:
                        contract.max_professionals,
                      allow_products:
                        contract.allow_products,
                      features:
                        contract.features,
                      permissions:
                        contract.permissions,
                      limits:
                        contract.limits,
                      plan_prices: [
                        {
                          currency:
                            contract.currency,
                          amount:
                            contract.price_amount,
                        },
                      ],
                    };
                  }
                }

                const planPriceObj =
                  planToDisplay.plan_prices?.find(
                    (p) =>
                      p.currency ===
                      displayCurrency
                  ) ||
                  planToDisplay
                    .plan_prices?.[0];

                const displayFeatures =
                  getDisplayFeatures(
                    planToDisplay
                  );

                const limits =
                  planToDisplay.limits ||
                  {};

                const maxProf =
                  limits.profissionais ??
                  planToDisplay.max_professionals;

                const professionalText =
                  maxProf === 'unlimited' ||
                    maxProf === -1 ||
                    maxProf === 999
                    ? 'Profissionais ilimitados'
                    : `Até ${maxProf} ${maxProf === 1
                      ? 'profissional'
                      : 'profissionais'
                    }`;

                const isLoading =
                  checkoutLoading ===
                  plan.id;

                const isStudio =
                  plan.key ===
                  'studio_tier';

                /*
                 * Destaque principal.
                 */
                const isRecommended =
                  isStudio;

                /*
                 * Apenas 3 benefícios.
                 * O restante fica oculto para
                 * não transformar o card em
                 * uma tabela de especificações.
                 */
                const visibleFeatures =
                  displayFeatures.length >
                    0
                    ? displayFeatures.slice(
                      0,
                      3
                    )
                    : [
                      'Agenda online completa',
                      'Gestão de clientes',
                      professionalText,
                    ];

                return (
                  <div
                    key={plan.id}
                    className={`
                      relative flex flex-col w-full lg:w-[300px]
                      rounded-3xl
                      transition-all duration-300
                      ${isRecommended
                        ? 'lg:scale-[1.035] z-10'
                        : 'hover:-translate-y-1'
                      }
                    `}
                    style={{
                      background:
                        theme.cardBg,

                      border:
                        isRecommended
                          ? `1.5px solid ${theme.accent}80`
                          : `1px solid ${theme.border}`,

                      boxShadow:
                        isRecommended
                          ? `0 15px 40px -15px ${theme.accent}25`
                          : '0 10px 30px -18px rgba(15,23,42,0.18)',
                    }}
                  >
                    {/* ==========================================
                        RECOMMENDED BADGE
                    ========================================== */}

                    {isRecommended && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.12em] shadow-md flex items-center gap-1.5 whitespace-nowrap"
                        style={{
                          background: '#00c853',
                          color: theme.id !== 'elegant' ? '#000000' : '#FFFFFF',
                        }}
                      >
                        <Star
                          className="w-3 h-3"
                          style={{ fill: theme.id !== 'elegant' ? '#000000' : '#FFFFFF', color: theme.id !== 'elegant' ? '#000000' : '#FFFFFF' }}
                        />

                        Recomendado
                      </div>
                    )}

                    {/* ==========================================
                        CARD CONTENT
                    ========================================== */}

                    <div className="p-6 pt-7">
                      {/* Plan name */}

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p
                            className="text-[9px] font-bold uppercase tracking-[0.16em]"
                            style={{
                              color:
                                theme.textMuted,
                            }}
                          >
                            Plano
                          </p>

                          <h3
                            className="text-xl font-bold mt-0.5"
                            style={{
                              color:
                                theme.textPrimary,
                            }}
                          >
                            {
                              planToDisplay.name
                            }
                          </h3>
                        </div>

                        {isCurrent && (
                          <span
                            className="text-[9px] font-bold px-2 py-1 rounded-full"
                            style={{
                              background:
                                `${theme.accent}12`,
                              color:
                                theme.accent,
                            }}
                          >
                            Atual
                          </span>
                        )}
                      </div>

                      {/* Description */}

                      <p
                        className="text-xs leading-5 min-h-[40px]"
                        style={{
                          color:
                            theme.textSecondary,
                        }}
                      >
                        {planToDisplay.description ||
                          'Tudo o que você precisa para administrar seu negócio.'}
                      </p>

                      {/* ======================================
                          PRICE — PROTAGONISTA
                      ====================================== */}

                      <div className="mt-5 mb-5">
                        {planPriceObj ? (
                          tenant?.status ===
                            'trial' ? (
                            <>
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="text-[38px] leading-none font-black tracking-[-0.045em]"
                                  style={{
                                    color:
                                      theme.textPrimary,
                                  }}
                                >
                                  {money(
                                    0,
                                    displayCurrency
                                  )}
                                </span>

                                <span
                                  className="text-[10px] font-bold"
                                  style={{
                                    color:
                                      theme.accent,
                                  }}
                                >
                                  hoje
                                </span>
                              </div>

                              <p
                                className="text-xs mt-2"
                                style={{
                                  color:
                                    theme.textSecondary,
                                }}
                              >
                                Depois do trial:{' '}
                                <strong
                                  style={{
                                    color:
                                      theme.textPrimary,
                                  }}
                                >
                                  {money(
                                    planPriceObj.amount,
                                    displayCurrency
                                  )}
                                  /mês
                                </strong>
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-1">
                                <span
                                  className="text-[40px] leading-none font-black tracking-[-0.05em]"
                                  style={{
                                    color:
                                      theme.textPrimary,
                                  }}
                                >
                                  {money(
                                    planPriceObj.amount,
                                    displayCurrency
                                  ).replace(
                                    /,\d\d$/,
                                    ''
                                  )}
                                </span>

                                <span
                                  className="text-xs font-semibold"
                                  style={{
                                    color:
                                      theme.textSecondary,
                                  }}
                                >
                                  /mês
                                </span>
                              </div>

                              <p
                                className="text-[10px] mt-2"
                                style={{
                                  color:
                                    theme.textMuted,
                                }}
                              >
                                Cobrança mensal. Sem
                                fidelidade.
                              </p>
                            </>
                          )
                        ) : (
                          <span
                            className="text-sm font-semibold"
                            style={{
                              color:
                                theme.textMuted,
                            }}
                          >
                            Preço sob consulta
                          </span>
                        )}
                      </div>

                      {/* ======================================
                          VALUE — CIRÚRGICO
                      ====================================== */}

                      <div
                        className="pt-4 border-t"
                        style={{
                          borderColor:
                            theme.border,
                        }}
                      >
                        <div className="space-y-2.5">
                          {visibleFeatures.map(
                            (
                              item: string,
                              index: number
                            ) => (
                              <div
                                key={index}
                                className="flex items-start gap-2.5"
                              >
                                <CheckCircle2
                                  className="w-4 h-4 shrink-0 mt-0.5"
                                  style={{
                                    color:
                                      isRecommended
                                        ? '#00c853'
                                        : theme.accent,
                                  }}
                                />

                                <span
                                  className="text-xs leading-5 font-medium"
                                  style={{
                                    color:
                                      theme.textPrimary,
                                  }}
                                >
                                  {item}
                                </span>
                              </div>
                            )
                          )}

                          {!visibleFeatures.some(
                            (item) =>
                              item
                                .toLowerCase()
                                .includes(
                                  'profissional'
                                )
                          ) && (
                              <div className="flex items-start gap-2.5">
                                <CheckCircle2
                                  className="w-4 h-4 shrink-0 mt-0.5"
                                  style={{
                                    color:
                                      isRecommended
                                        ? '#00c853'
                                        : theme.accent,
                                  }}
                                />

                                <span
                                  className="text-xs leading-5 font-medium"
                                  style={{
                                    color:
                                      theme.textPrimary,
                                  }}
                                >
                                  {
                                    professionalText
                                  }
                                </span>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* ======================================
                          CTA
                      ====================================== */}

                      <button
                        onClick={() =>
                          !plan.is_default &&
                            !isCurrent
                            ? handleCheckout(
                              plan.id
                            )
                            : null
                        }
                        disabled={
                          isLoading ||
                          isCurrent ||
                          plan.is_default
                        }
                        className="w-full mt-6 py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:cursor-default"
                        style={{
                          background:
                            isCurrent
                              ? `${theme.accent}12`
                              : isRecommended
                                ? '#fff'
                                : theme.id === 'elegant'
                                  ? '#F1F5F9'
                                  : 'rgba(255,255,255,0.07)',

                          color:
                            isCurrent
                              ? theme.accent
                              : isRecommended
                                ? (theme.id !== 'elegant' ? '#000000' : '#FFFFFF')
                                : theme.textPrimary,

                          border:
                            isCurrent
                              ? `1px solid ${theme.accent}35`
                              : isRecommended
                                ? 'none'
                                : `1px solid ${theme.border}`,

                          boxShadow:
                            isRecommended && !isCurrent
                              ? '#fffff' || '0 10px 25px rgba(15,23,42,0.16)'
                              : 'none',
                        }}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrent ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Plano atual
                          </>
                        ) : tenant?.status ===
                          'trial' ? (
                          <>
                            Começar grátis
                            <span className="opacity-60">
                              →
                            </span>
                          </>
                        ) : (
                          <>
                            Escolher plano
                            <span className="opacity-60">
                              →
                            </span>
                          </>
                        )}
                      </button>

                      {/* ======================================
                          TRUST LINE
                      ====================================== */}

                      {!isCurrent &&
                        tenant?.status ===
                        'trial' && (
                          <div className="flex items-center justify-center gap-1.5 mt-3">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />

                            <span
                              className="text-[9px]"
                              style={{
                                color:
                                  theme.textMuted,
                              }}
                            >
                              R$ 0 hoje • Cancele em
                              1 clique
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ======================================================
          MINI TRUST FOOTER
      ====================================================== */}

      {plans.length > 0 && (
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-5 flex-wrap justify-center">
            <span className="flex items-center gap-1.5 text-[10px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />

              <span
                style={{
                  color:
                    theme.textMuted,
                }}
              >
                Pagamento seguro
              </span>
            </span>

            <span
              className="w-1 h-1 rounded-full"
              style={{
                background:
                  theme.border,
              }}
            />

            <span
              className="text-[10px] font-medium"
              style={{
                color:
                  theme.textMuted,
              }}
            >
              Sem fidelidade
            </span>

            <span
              className="w-1 h-1 rounded-full"
              style={{
                background:
                  theme.border,
              }}
            />

            <span
              className="text-[10px] font-medium"
              style={{
                color:
                  theme.textMuted,
              }}
            >
              Cancele quando quiser
            </span>
          </div>
        </div>
      )}
    </div>
  );
}