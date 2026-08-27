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
  Star,
  X,
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

/* =========================================================
   HELPERS
========================================================= */

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

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Assinatura() {
  const { tenant, profile } = useAuth();
  const { theme } = useTheme();
  const { features } = usePlanFeatures();
  const queryClient = useQueryClient();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] =
    useState(false);

  const [checkoutLoading, setCheckoutLoading] =
    useState<string | null>(null);

  const [cancelLoading, setCancelLoading] =
    useState(false);

  const [syncing, setSyncing] = useState(false);

  const [syncSuccessMessage, setSyncSuccessMessage] =
    useState<string | null>(null);

  /* =========================================================
     FETCH DATA
  ========================================================= */

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
          .select(
            '*, subscription_contracts(*), plans(*)'
          )
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
                .eq(
                  'tenant_id',
                  tenant.id
                )
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
                activeSub =
                  newActiveSub;

                queryClient.invalidateQueries({
                  queryKey: [
                    'active_subscription_contract',
                  ],
                });

                queryClient.invalidateQueries({
                  queryKey: [
                    'permission_engine',
                  ],
                });

                queryClient.invalidateQueries({
                  queryKey: [
                    'plan_features',
                  ],
                });
              }
            }
          }
        } catch (_) {
          // Sync silencioso
        }
      }

      if (activeSub) {
        setSubscription(
          activeSub as Subscription
        );
      }

      if (planData) {
        /*
         * Remove planos internos/deprecated
         */
        const validPlans =
          planData.filter(
            (p: any) =>
              p.name !==
              'Trial (Período de Teste)' &&
              p.key !== 'expired_tier' &&
              !p.is_trial_plan
          );

        /*
         * Aplica preço personalizado
         */
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

        /*
         * Ordenação:
         * recomendado primeiro,
         * depois preço.
         */
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
    } catch (error) {
      console.error(
        'Erro ao buscar dados de assinatura:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, [tenant, queryClient]);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* =========================================================
     VERIFY CHECKOUT
  ========================================================= */

  useEffect(() => {
    const params =
      new URLSearchParams(
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
            'Pagamento confirmado. Seu plano foi ativado.'
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
            queryKey: [
              'permission_engine',
            ],
          });

          queryClient.invalidateQueries({
            queryKey: [
              'plan_features',
            ],
          });

          await fetchData();
        }
      } catch (error) {
        console.error(
          'Erro ao verificar checkout:',
          error
        );
      } finally {
        setSyncing(false);
      }
    };

    verifySession();
  }, [
    tenant,
    queryClient,
    fetchData,
  ]);

  /* =========================================================
     SYNC STRIPE
  ========================================================= */

  const handleSyncWithStripe =
    async () => {
      if (!tenant) return;

      try {
        setSyncing(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error(
            'Não autenticado'
          );
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
            'Erro ao sincronizar'
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
            queryKey: [
              'permission_engine',
            ],
          });

          queryClient.invalidateQueries({
            queryKey: [
              'plan_features',
            ],
          });

          await fetchData();
        } else {
          alert(
            data.message ||
            'Nenhuma assinatura ativa encontrada no Stripe.'
          );
        }
      } catch (error: any) {
        console.error(error);

        alert(
          `Erro: ${error.message}`
        );
      } finally {
        setSyncing(false);
      }
    };

  /* =========================================================
     CUSTOMER PORTAL
  ========================================================= */

  const handleOpenCustomerPortal =
    async () => {
      try {
        setPortalLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error(
            'Não autenticado'
          );
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
              returnUrl:
                window.location.href,
            }),
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
            'Erro ao abrir portal'
          );
        }

        if (data.url) {
          window.location.href =
            data.url;
        }
      } catch (error: any) {
        console.error(
          'Portal error:',
          error
        );

        alert(
          `Erro ao abrir portal de pagamentos: ${error.message}`
        );
      } finally {
        setPortalLoading(false);
      }
    };

  /* =========================================================
     CANCEL SUBSCRIPTION
  ========================================================= */

  const handleCancelSubscription =
    async () => {
      const confirmed = confirm(
        'Tem certeza que deseja cancelar sua assinatura? O acesso continuará até o final do período atual.'
      );

      if (!confirmed) return;

      setCancelLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error(
            'Não autenticado'
          );
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
            await res
              .json()
              .catch(() => ({}));

          throw new Error(
            errData.error ||
            'Erro ao cancelar assinatura'
          );
        }

        alert(
          'Assinatura cancelada com sucesso. Seu acesso continua até o final do período atual.'
        );

        setSubscription(
          (prev) =>
            prev
              ? {
                ...prev,
                status:
                  'canceled',
              }
              : null
        );

        queryClient.invalidateQueries({
          queryKey: [
            'active_subscription_contract',
          ],
        });

        queryClient.invalidateQueries({
          queryKey: [
            'permission_engine',
          ],
        });

        queryClient.invalidateQueries({
          queryKey: [
            'plan_features',
          ],
        });

        await fetchData();
      } catch (error: any) {
        console.error(error);

        alert(
          `Erro: ${error.message}`
        );
      } finally {
        setCancelLoading(false);
      }
    };

  /* =========================================================
     CHECKOUT
  ========================================================= */

  const handleCheckout =
    async (planId: string) => {
      if (!tenant) return;

      try {
        setCheckoutLoading(planId);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error(
            'Não autenticado'
          );
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
          window.location.href =
            url;
        }
      } catch (error: any) {
        console.error(
          'Checkout error:',
          error
        );

        alert(
          `Erro ao iniciar assinatura: ${error.message}`
        );
      } finally {
        setCheckoutLoading(null);
      }
    };

  /* =========================================================
     FORMATTERS
  ========================================================= */

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

  /* =========================================================
     LOADING
  ========================================================= */

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
            className="text-xs"
            style={{
              color: theme.textMuted,
            }}
          >
            Carregando assinatura...
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     SUBSCRIPTION STATE
  ========================================================= */

  const isTrialExpired =
    features.subscription_status ===
    'trial_expired';

  const isTrial =
    features.is_trial &&
    !isTrialExpired;

  const hasActivePlan =
    features.is_active &&
    !isTrialExpired;

  /* =========================================================
     CURRENCY
  ========================================================= */

  const displayCurrency =
    tenant?.language === 'en'
      ? 'USD'
      : ['es', 'fr', 'de'].includes(
        tenant?.language || ''
      )
        ? 'EUR'
        : 'BRL';

  /* =========================================================
     TRIAL
  ========================================================= */

  const configuredTrialPlan =
    plans.find(
      (p) =>
        (p as any).is_trial_plan ||
        p.is_default ||
        p.trial_days > 0
    );

  const activeTrialDays =
    configuredTrialPlan?.trial_days ||
    7;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <header className="mb-7">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1"
          style={{
            color: theme.textMuted,
          }}
        >
          Minha assinatura
        </p>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="font-serif text-3xl font-bold tracking-tight"
              style={{
                color: theme.textPrimary,
              }}
            >
              Planos & Assinatura
            </h1>

            <p
              className="text-sm mt-1"
              style={{
                color: theme.textSecondary,
              }}
            >
              Tudo para manter seu negócio organizado.
            </p>
          </div>

          {hasActivePlan &&
            !isTrial &&
            subscription?.stripe_subscription_id && (
              <button
                onClick={
                  handleOpenCustomerPortal
                }
                disabled={
                  portalLoading
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:-translate-y-[1px]"
                style={{
                  borderColor:
                    theme.border,
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

      {/* =====================================================
          SUCCESS
      ===================================================== */}

      {syncSuccessMessage && (
        <div
          className="mb-5 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
          style={{
            background:
              'rgba(16,185,129,0.08)',
            borderColor:
              'rgba(16,185,129,0.25)',
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
            className="text-emerald-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          TRIAL EXPIRED
      ===================================================== */}

      {isTrialExpired && (
        <div
          className="mb-5 flex items-center gap-3 px-4 py-3.5 rounded-xl border"
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
              Seu período de teste terminou
            </p>

            <p
              className="text-xs mt-0.5"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Escolha um plano para continuar usando o Raffros.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          CANCELED
      ===================================================== */}

      {subscription?.status ===
        'canceled' && (
          <div
            className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl border"
            style={{
              background:
                'rgba(245,158,11,0.07)',
              borderColor:
                'rgba(245,158,11,0.22)',
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />

            <div>
              <p className="text-xs font-bold text-amber-600">
                Assinatura cancelada
              </p>

              <p className="text-xs mt-0.5 leading-5 text-amber-700/80">
                Seu acesso continua até{' '}
                <strong>
                  {formatDate(
                    subscription.current_period_end ||
                    subscription.trial_ends_at
                  )}
                </strong>
                . Nenhuma nova cobrança será realizada.
              </p>
            </div>
          </div>
        )}

      {/* =====================================================
          CURRENT PLAN
      ===================================================== */}

      {hasActivePlan &&
        !isTrial &&
        subscription?.stripe_subscription_id && (
          <div
            className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 rounded-2xl border"
            style={{
              background:
                theme.cardBg,
              borderColor:
                theme.border,
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `${theme.accent}12`,
                color: theme.accent,
              }}
            >
              <Crown className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2
                  className="text-sm font-bold"
                  style={{
                    color:
                      theme.textPrimary,
                  }}
                >
                  {features.plan_name}
                </h2>

                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
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
                Próxima cobrança em{' '}
                {formatDate(
                  subscription.current_period_end
                )}
              </p>
            </div>
          </div>
        )}

      {/* =====================================================
          TRIAL MINI BANNER
      ===================================================== */}

      {isTrial && (
        <div
          className="mb-7 flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            background:
              'rgba(0,200,83,0.055)',
            borderColor:
              'rgba(0,200,83,0.18)',
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-[#00c853]/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#00c853]" />
          </div>

          <div className="flex-1">
            <p
              className="text-xs font-bold"
              style={{
                color:
                  theme.textPrimary,
              }}
            >
              Seu teste gratuito está ativo
            </p>

            <p
              className="text-[11px] mt-0.5"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Você não paga nada hoje. Escolha seu plano e continue aproveitando o Raffros.
            </p>
          </div>

          <span className="hidden sm:block text-[10px] font-bold text-[#00a844] whitespace-nowrap">
            {activeTrialDays} dias grátis
          </span>
        </div>
      )}

      {/* =====================================================
          PLANS INTRO
      ===================================================== */}

      <div className="text-center mb-7">
        <h2
          className="font-serif text-2xl sm:text-3xl font-bold tracking-tight"
          style={{
            color: theme.textPrimary,
          }}
        >
          {hasActivePlan && !isTrial
            ? 'Seu plano, do seu jeito.'
            : 'Escolha seu plano.'}
        </h2>

        <p
          className="text-xs sm:text-sm mt-1.5"
          style={{
            color:
              theme.textSecondary,
          }}
        >
          {hasActivePlan && !isTrial
            ? 'Faça upgrade quando seu negócio crescer.'
            : 'Comece simples. Cresça quando precisar.'}
        </p>
      </div>

      {/* =====================================================
          PLANS
      ===================================================== */}

      {plans.length === 0 ? (
        <div
          className="py-14 text-center rounded-2xl border"
          style={{
            background:
              theme.cardBg,
            borderColor:
              theme.border,
          }}
        >
          <Crown
            className="w-7 h-7 mx-auto mb-3"
            style={{
              color: theme.accent,
            }}
          />

          <h3
            className="font-bold text-sm"
            style={{
              color:
                theme.textPrimary,
            }}
          >
            Nenhum plano disponível
          </h3>

          <p
            className="text-xs mt-1 max-w-sm mx-auto"
            style={{
              color:
                theme.textSecondary,
            }}
          >
            Os planos ainda não foram configurados.
          </p>

          {profile?.role ===
            'super_admin' && (
              <a
                href="/platform/plans"
                className="inline-flex mt-4 px-4 py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background:
                    theme.accentGradient,
                  color:
                    theme.btnPrimaryText,
                }}
              >
                Ir para Planos
              </a>
            )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center justify-center gap-5 px-2">

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
              /* =================================================
                 PLAN STATE
              ================================================= */

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

              /* =================================================
                 CONTRACT OVERRIDE
              ================================================= */

              let planToDisplay =
                plan;

              const contracts =
                subscription?.subscription_contracts;

              if (
                isCurrent &&
                contracts &&
                !Array.isArray(
                  contracts
                )
              ) {
                const contract =
                  contracts as any;

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

              if (
                isCurrent &&
                Array.isArray(
                  contracts
                ) &&
                contracts.length > 0
              ) {
                const contract =
                  contracts[0] as any;

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

              /* =================================================
                 PRICE
              ================================================= */

              const planPriceObj =
                planToDisplay.plan_prices?.find(
                  (p: any) =>
                    p.currency ===
                    displayCurrency
                ) ||
                planToDisplay.plan_prices?.[0];

              /* =================================================
                 FEATURES
              ================================================= */

              let displayFeatures =
                getDisplayFeatures(
                  planToDisplay
                );

              /*
               * Mantém o card curto.
               * Se o banco tiver muitos recursos,
               * mostramos somente os primeiros.
               */

              if (
                displayFeatures.length >
                4
              ) {
                displayFeatures =
                  displayFeatures.slice(
                    0,
                    4
                  );
              }

              if (
                displayFeatures.length ===
                0
              ) {
                displayFeatures = [
                  'Agenda online completa',
                  'Clientes e profissionais',
                  'Serviços e atendimento',
                  'Gestão financeira',
                ];
              }

              /* =================================================
                 PROFESSIONAL LIMIT
              ================================================= */

              const limitsObj =
                planToDisplay.limits ||
                {};

              const maxProf =
                limitsObj.profissionais ??
                planToDisplay.max_professionals;

              const displayMaxProf =
                maxProf ===
                  'unlimited' ||
                  maxProf === -1 ||
                  maxProf === 999
                  ? 'Profissionais ilimitados'
                  : `Até ${maxProf} ${maxProf === 1
                    ? 'profissional'
                    : 'profissionais'
                  }`;

              /*
               * Só adiciona se ainda couber.
               */
              if (
                !displayFeatures.some(
                  (f) =>
                    f
                      .toLowerCase()
                      .includes(
                        'profissional'
                      )
                )
              ) {
                displayFeatures.push(
                  displayMaxProf
                );
              }

              /* =================================================
                 STUDIO
              ================================================= */

              const isStudio =
                plan.key ===
                'studio_tier';

              /*
               * Recomendado:
               * prioriza Studio.
               */
              const isRecommended =
                isStudio ||
                Boolean(
                  plan.is_default
                );

              const isLoading =
                checkoutLoading ===
                plan.id;

              /* =================================================
                 CARD
              ================================================= */

              return (
                <div
                  key={plan.id}
                  className={`
                    relative flex flex-col
                    w-full max-w-[320px]
                    rounded-3xl
                    transition-all duration-300
                    ${isStudio
                      ? 'lg:scale-[1.025] z-10'
                      : 'z-0'}
                  `}
                  style={{
                    background:
                      theme.cardBg,

                    border: `1px solid ${isStudio
                        ? theme.accent
                        : theme.border
                      }`,

                    boxShadow: isStudio
                      ? `0 18px 45px -18px ${theme.accent}45`
                      : '0 8px 25px rgba(15,23,42,0.06)',
                  }}
                >

                  {/* ==========================================
                      GREEN RECOMMENDED BADGE
                  ========================================== */}

                  {isRecommended && (
                    <div
                      className="
                        absolute
                        top-0
                        right-0
                        bg-[#00c853]
                        text-white
                        text-[9px]
                        font-bold
                        px-4
                        py-1.5
                        rounded-tr-3xl
                        rounded-bl-xl
                        uppercase
                        tracking-[0.12em]
                        shadow-sm
                      "
                    >
                      Recomendado
                    </div>
                  )}

                  {/* ==========================================
                      CARD CONTENT
                  ========================================== */}

                  <div className="px-7 pt-7 pb-6">

                    {/* ----------------------------------------
                        PLAN NAME
                    ---------------------------------------- */}

                    <div className="text-center">

                      <div className="flex items-center justify-center gap-2 mb-2">

                        {isStudio ? (
                          <Star
                            className="w-5 h-5 fill-amber-500 text-amber-500"
                          />
                        ) : (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              background:
                                theme.accent,
                            }}
                          />
                        )}

                        <h3
                          className="text-[21px] font-bold tracking-tight"
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

                      <p
                        className="text-[12px] leading-relaxed max-w-[230px] min-h-[36px] mx-auto"
                        style={{
                          color:
                            theme.textSecondary,
                        }}
                      >
                        {planToDisplay.description ||
                          'Tudo que você precisa para administrar seu negócio.'}
                      </p>

                    </div>

                    {/* ----------------------------------------
                        PRICE
                    ---------------------------------------- */}

                    <div className="text-center mt-5 mb-5">

                      {planPriceObj ? (
                        tenant?.status ===
                          'trial' ? (
                          <>
                            <div className="flex items-center justify-center gap-2">

                              <span
                                className="text-[42px] font-black tracking-[-0.045em]"
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
                                className="
                                  text-[9px]
                                  font-bold
                                  uppercase
                                  tracking-wider
                                  px-2
                                  py-1
                                  rounded-full
                                "
                                style={{
                                  background:
                                    '#00c85315',
                                  color:
                                    '#00a844',
                                }}
                              >
                                {activeTrialDays}{' '}
                                dias grátis
                              </span>

                            </div>

                            <p
                              className="text-[11px] mt-1.5"
                              style={{
                                color:
                                  theme.textMuted,
                              }}
                            >
                              Depois{' '}
                              {money(
                                planPriceObj.amount,
                                displayCurrency
                              )}
                              /mês
                            </p>
                          </>
                        ) : (
                          <div>
                            <span
                              className="text-[42px] font-black tracking-[-0.045em]"
                              style={{
                                color:
                                  theme.textPrimary,
                              }}
                            >
                              {money(
                                planPriceObj.amount,
                                displayCurrency
                              ).replace(
                                /\,\d\d$/,
                                ''
                              )}
                            </span>

                            <span
                              className="text-[12px] ml-1"
                              style={{
                                color:
                                  theme.textMuted,
                              }}
                            >
                              /mês
                            </span>
                          </div>
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

                    {/* ----------------------------------------
                        FEATURES
                    ---------------------------------------- */}

                    <div
                      className="border-t pt-5 mb-5"
                      style={{
                        borderColor:
                          theme.border,
                      }}
                    >
                      <div className="space-y-2.5">

                        {displayFeatures.map(
                          (
                            item: string,
                            index: number
                          ) => (
                            <div
                              key={`${item}-${index}`}
                              className="flex items-center gap-2.5"
                            >
                              <div
                                className="
                                  w-4 h-4
                                  rounded-full
                                  flex
                                  items-center
                                  justify-center
                                  shrink-0
                                "
                                style={{
                                  background:
                                    isStudio
                                      ? '#00c85315'
                                      : `${theme.accent}12`,
                                }}
                              >
                                <CheckCircle2
                                  className="w-3 h-3"
                                  style={{
                                    color:
                                      isStudio
                                        ? '#00c853'
                                        : theme.accent,
                                  }}
                                />
                              </div>

                              <span
                                className="text-[12px] leading-5"
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

                      </div>
                    </div>

                    {/* ----------------------------------------
                        CTA
                    ---------------------------------------- */}

                    <button
                      onClick={() =>
                        !plan.is_default &&
                        !isCurrent &&
                        handleCheckout(
                          plan.id
                        )
                      }
                      disabled={
                        isLoading ||
                        isCurrent ||
                        plan.is_default
                      }
                      className="
                        w-full
                        py-3.5
                        px-4
                        rounded-xl
                        text-[13px]
                        font-bold
                        flex
                        items-center
                        justify-center
                        gap-2
                        transition-all
                        duration-200
                        hover:-translate-y-[1px]
                        active:scale-[0.98]
                        disabled:opacity-70
                      "
                      style={{
                        background: isCurrent
                          ? `${theme.accent}12`
                          : isStudio
                            ? '#0f172a'
                            : theme.id ===
                              'elegant'
                              ? '#F1F5F9'
                              : 'rgba(255,255,255,0.08)',

                        color: isCurrent
                          ? theme.accent
                          : isStudio
                            ? '#ffffff'
                            : theme.textPrimary,

                        border: isCurrent
                          ? `1px solid ${theme.accent}35`
                          : isStudio
                            ? 'none'
                            : `1px solid ${theme.border}`,

                        boxShadow:
                          isStudio &&
                            !isCurrent
                            ? '0 8px 20px rgba(15,23,42,0.15)'
                            : 'none',
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        '✓ Plano Atual'
                      ) : plan.is_default ? (
                        'Plano Básico'
                      ) : tenant?.status ===
                        'trial' ? (
                        `Começar ${activeTrialDays} Dias Grátis`
                      ) : (
                        'Assinar agora'
                      )}
                    </button>

                    {/* ----------------------------------------
                        MICRO COPY
                    ---------------------------------------- */}

                    <p
                      className="text-[10px] text-center mt-3"
                      style={{
                        color:
                          theme.textMuted,
                      }}
                    >
                      {tenant?.status ===
                        'trial'
                        ? 'Sem cobrança hoje · Cancele quando quiser'
                        : 'Sem fidelidade · Cancele quando quiser'}
                    </p>

                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* =====================================================
          TRUST
      ===================================================== */}

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-7">
        <div
          className="flex items-center gap-1.5 text-[10px]"
          style={{
            color:
              theme.textMuted,
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Pagamento seguro
        </div>

        <div
          className="text-[10px]"
          style={{
            color:
              theme.textMuted,
          }}
        >
          Sem fidelidade
        </div>

        <div
          className="text-[10px]"
          style={{
            color:
              theme.textMuted,
          }}
        >
          Cancele quando quiser
        </div>
      </div>

      {/* =====================================================
          FAQ — MINIMALISTA
      ===================================================== */}

      <div className="mt-12 max-w-2xl mx-auto">

        <div className="text-center mb-5">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{
              color:
                theme.textMuted,
            }}
          >
            Dúvidas
          </p>

          <h3
            className="font-serif text-xl font-bold mt-1"
            style={{
              color:
                theme.textPrimary,
            }}
          >
            Tudo simples por aqui.
          </h3>
        </div>

        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{
            background:
              theme.cardBg,
            borderColor:
              theme.border,
          }}
        >

          <div className="px-5 py-4">
            <p
              className="text-xs font-bold"
              style={{
                color:
                  theme.textPrimary,
              }}
            >
              Posso cancelar quando quiser?
            </p>

            <p
              className="text-[11px] leading-5 mt-1"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Sim. Não existe fidelidade. O acesso continua até o final do período já pago.
            </p>
          </div>

          <div className="px-5 py-4">
            <p
              className="text-xs font-bold"
              style={{
                color:
                  theme.textPrimary,
              }}
            >
              Como funciona o teste gratuito?
            </p>

            <p
              className="text-[11px] leading-5 mt-1"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Você começa com acesso completo durante o período de teste. A cobrança só acontece depois desse período.
            </p>
          </div>

          <div className="px-5 py-4">
            <p
              className="text-xs font-bold"
              style={{
                color:
                  theme.textPrimary,
              }}
            >
              O pagamento é seguro?
            </p>

            <p
              className="text-[11px] leading-5 mt-1"
              style={{
                color:
                  theme.textSecondary,
              }}
            >
              Sim. O processamento dos pagamentos é realizado pelo Stripe.
            </p>
          </div>

        </div>
      </div>

      {/* =====================================================
          ADMIN SYNC — DISCRETO
      ===================================================== */}

      {profile?.role ===
        'super_admin' && (
          <div className="flex justify-center mt-6">
            <button
              onClick={
                handleSyncWithStripe
              }
              disabled={syncing}
              className="text-[10px] font-medium opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1.5"
              style={{
                color:
                  theme.textMuted,
              }}
            >
              {syncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldCheck className="w-3 h-3" />
              )}

              Sincronizar assinatura
            </button>
          </div>
        )}

    </div>
  );
}