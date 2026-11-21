import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { usePlanFeatures } from '../../hooks/usePlanFeatures';
import { useQueryClient } from '@tanstack/react-query';
import { MercadoPagoMark, MercadoPagoHorizontalLogo } from '../../components/icons/MercadoPagoLogo';
import toast from 'react-hot-toast';
import {
  Crown,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Lock,
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
  original_amount?: number;
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

function formatPlanDescription(plan: Plan): string {
  const raw = plan.description?.trim() || '';
  if (!raw || raw.toLowerCase().includes('barbeiro')) {
    if (plan.key === 'solo_tier' || plan.name?.toLowerCase() === 'solo') {
      return 'Ideal para profissionais independentes, salões de beleza e esmalterias. Agenda, clientes e financeiro.';
    }
    return 'Tudo o que você precisa para administrar seu negócio com excelência.';
  }
  return raw;
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

  const [stripeMode, setStripeMode] = useState<'test' | 'live' | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenant) return;

    try {
      const [
        { data: subsData },
        { data: planData },
        { data: customPricingData },
        { data: publicConfigData },
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

        supabase.rpc('get_public_stripe_config'),
      ]);

      if (publicConfigData && typeof publicConfigData === 'object' && 'mode' in publicConfigData) {
        setStripeMode((publicConfigData as any).mode);
      }

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
          const { data: syncData } = await supabase.functions.invoke('sync-stripe-subscription');

          if (syncData?.synced) {
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
        } catch (_) {
          // Não bloqueia a tela caso a sincronização falhe.
        }
      }

      if (activeSub) {
        setSubscription(activeSub as any);
      }

      if (planData) {
        const validPlans = planData
          .filter(
            (p: any) =>
              p.name !== 'Trial (Período de Teste)' &&
              p.key !== 'expired_tier' &&
              p.key !== 'fallback_tier' &&
              !p.key?.includes('fallback') &&
              !p.name?.toLowerCase().includes('fallback') &&
              !p.name?.toLowerCase().includes('cancelado') &&
              !p.is_trial_plan
          )
          .sort((a: any, b: any) => {
            const aPrice = a.plan_prices?.find((p: any) => p.currency === 'BRL')?.amount || 0;
            const bPrice = b.plan_prices?.find((p: any) => p.currency === 'BRL')?.amount || 0;
            return aPrice - bPrice;
          });

        // Verifica se existe um preço promocional salvo enquanto o salão estava no plano de Trial
        // (cujo plan_id não está entre os planos pagos validPlans)
        const validPlanIds = new Set(validPlans.map((vp: any) => vp.id));
        const fallbackTrialCustomPrice = customPricingData?.find(
          (cp: any) => cp.amount_override > 0 && !validPlanIds.has(cp.plan_id)
        );
        const fallbackTargetPlanId =
          activeSub?.plan_id && validPlanIds.has(activeSub.plan_id)
            ? activeSub.plan_id
            : validPlans[0]?.id;

        const plansWithCustomPrices = validPlans.map((plan: any) => {
          const directCustomPrice = customPricingData?.find(
            (cp: any) => cp.plan_id === plan.id && cp.amount_override > 0
          );

          const customPrice =
            directCustomPrice ||
            (fallbackTrialCustomPrice && plan.id === fallbackTargetPlanId
              ? fallbackTrialCustomPrice
              : null);

          if (customPrice && plan.plan_prices) {
            const brlIndex = plan.plan_prices.findIndex(
              (p: any) => p.currency === 'BRL'
            );

            if (brlIndex >= 0) {
              plan.original_amount = plan.plan_prices[brlIndex].amount;
              plan.plan_prices[brlIndex].amount = Number(customPrice.amount_override);
            } else {
              plan.plan_prices.push({
                currency: 'BRL',
                amount: Number(customPrice.amount_override),
              });
            }

            plan.is_custom_price = true;
          }

          return plan;
        });

        setPlans(plansWithCustomPrices);
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
   * Confirmação do checkout (Mercado Pago).
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const sessionId = params.get('session_id');
    const paymentId = params.get('payment_id') || params.get('collection_id');
    const preferenceId = params.get('preference_id');
    const planId = params.get('plan_id');
    const mpStatus = params.get('mp_status') || params.get('status') || params.get('collection_status');

    if (!tenant) return;

    if (mpStatus === 'failure' || mpStatus === 'rejected') {
      toast.error('O pagamento não foi concluído. Você pode escolher um plano e tentar novamente.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!sessionId && !paymentId && mpStatus !== 'approved') return;

    const verifySession = async () => {
      try {
        setSyncing(true);

        const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-checkout-session', {
          body: {
            sessionId: sessionId || paymentId || undefined,
            paymentId: paymentId || undefined,
            preferenceId: preferenceId || undefined,
            planId: planId || undefined,
          },
        });

        if (!verifyErr && verifyData?.success) {
          setSyncSuccessMessage(
            'Pagamento confirmado no Mercado Pago! Seu plano já está ativo.'
          );

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          queryClient.invalidateQueries({
            queryKey: ['active_subscription_contract'],
          });
          queryClient.invalidateQueries({
            queryKey: ['permission_engine'],
          });
          queryClient.invalidateQueries({
            queryKey: ['plan_features'],
          });
          queryClient.invalidateQueries({
            queryKey: ['tenant-account-state'],
          });
          queryClient.invalidateQueries({
            queryKey: ['tenants'],
          });

          await fetchData();
        } else if (verifyData?.pending) {
          toast(verifyData.message || 'Pagamento em processamento no Mercado Pago.', { icon: '⏳' });
        } else if (verifyData?.error) {
          toast.error(verifyData.error);
        }
      } catch (e) {
        console.error('Erro ao verificar checkout Mercado Pago:', e);
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

      const { data, error: invokeErr } = await supabase.functions.invoke('sync-stripe-subscription');

      if (invokeErr) {
        throw new Error(
          invokeErr.message ||
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
        toast.error(
          data.message ||
          'Nenhuma assinatura ativa encontrada no Stripe.'
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      setPortalLoading(true);

      const { data, error: invokeErr } = await supabase.functions.invoke('create-portal-session', {
        body: { returnUrl: window.location.href },
      });

      if (invokeErr || data?.error) {
        throw new Error(
          invokeErr?.message ||
          data?.error ||
          'Erro ao abrir portal do cliente'
        );
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);

      toast.error(
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
      const { data: cancelData, error: invokeErr } = await supabase.functions.invoke('cancel-subscription');

      if (invokeErr || cancelData?.error) {
        throw new Error(
          invokeErr?.message ||
          cancelData?.error ||
          'Erro ao cancelar assinatura'
        );
      }

      toast.success(
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
      toast.error(`Erro: ${err.message}`);
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

      const { data, error: invokeErr } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planId,
          returnUrl: window.location.href,
        },
      });

      if (invokeErr || data?.error) {
        let detailedErr = data?.error;
        if (!detailedErr && (invokeErr as any)?.context) {
          try {
            const errJson = await (invokeErr as any).context.json();
            detailedErr = errJson?.error;
          } catch {
            // fallback para mensagem padrão
          }
        }
        throw new Error(detailedErr || invokeErr?.message || 'Erro ao criar sessão de checkout');
      }

      const url = data?.url;

      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error(
        'Checkout error:',
        err
      );

      toast.error(
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
      className="w-full min-w-0 max-w-5xl mx-auto pb-10 px-0 sm:px-6 animate-fade-in overflow-x-hidden"
    >
      {/* ======================================================
          HEADER MINIMALISTA
      ====================================================== */}

      <header className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: theme.textMuted }}
          >
            Minha conta
          </p>

          <div className="flex items-center gap-2">
            {stripeMode === 'test' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                Modo Teste
              </span>
            )}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold"
              style={{
                background: theme.cardBg,
                borderColor: theme.border,
                color: theme.textSecondary,
              }}
            >
              <MercadoPagoMark className="w-4 h-3 shrink-0" />
              <span>Mercado Pago</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="font-serif text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: theme.textPrimary }}
            >
              Escolha seu plano
            </h1>

            <p
              className="text-xs sm:text-sm mt-1 flex items-center gap-1.5"
              style={{ color: theme.textSecondary }}
            >
              {isTrial ? (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: theme.accent }}
                  />
                  <span>{activeTrialDays} dias grátis ativos • Sem fidelidade</span>
                </>
              ) : (
                <span>Cobrança mensal simples • Cancele quando quiser</span>
              )}
            </p>
          </div>

          {hasActivePlan &&
            !isTrial &&
            subscription?.status !== 'canceled' && (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:shadow-sm disabled:opacity-60 cursor-pointer"
                style={{
                  borderColor: theme.border,
                  background: theme.cardBg,
                  color: theme.textSecondary,
                }}
              >
                {cancelLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}

                Cancelar assinatura
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
          className="mb-4 px-4 py-2.5 rounded-xl border flex items-center gap-3 text-xs transition-all shadow-sm"
          style={{
            background: theme.cardBg,
            borderColor: theme.border,
          }}
        >
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shrink-0 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <AlertTriangle className="w-3.5 h-3.5" />
            Teste Finalizado
          </span>
          <p className="truncate min-w-0 flex-1" style={{ color: theme.textSecondary }}>
            Seu período de teste terminou. Escolha um plano para continuar.
          </p>
        </div>
      )}

      {subscription?.status === 'canceled' && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all shadow-sm"
          style={{
            background: theme.cardBg,
            borderColor: theme.border,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider shrink-0 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
              <Clock className="w-3.5 h-3.5" />
              Cancelada
            </span>
            <p className="truncate" style={{ color: theme.textSecondary }}>
              Seu acesso continua ativo até <strong style={{ color: theme.textPrimary }}>{formatDate(subscription.current_period_end || subscription.trial_ends_at)}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ======================================================
          CURRENT ACTIVE PLAN
      ====================================================== */}

      {hasActivePlan &&
        !isTrial && (
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
                {subscription?.current_period_end &&
                new Date(subscription.current_period_end).getFullYear() > new Date().getFullYear() + 10
                  ? 'Assinatura vitalícia ativa'
                  : subscription?.stripe_subscription_id
                    ? `Próxima cobrança: ${formatDate(subscription.current_period_end)}`
                    : subscription?.current_period_end
                      ? `Válido até: ${formatDate(subscription.current_period_end)}`
                      : 'Assinatura ativa'}
              </p>
            </div>
          </div>
        )}

      {/* ======================================================
          PLANS
      ====================================================== */}

      <section>

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
          <div className="flex flex-col lg:flex-row justify-center items-stretch gap-6 max-w-5xl mx-auto w-full min-w-0">
            {plans
              .filter((plan) => {
                if (
                  plan.key === 'fallback_tier' ||
                  plan.key?.includes('fallback') ||
                  plan.name?.toLowerCase().includes('fallback') ||
                  plan.name?.toLowerCase().includes('cancelado')
                ) {
                  return false;
                }

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
                const contract = Array.isArray(contracts)
                  ? contracts[0]
                  : contracts;

                if (
                  (isCurrent || (plan.is_custom_price && contract?.features?._custom_override)) &&
                  contract
                ) {
                  const customOrContractAmount =
                    plan.is_custom_price
                      ? (plan.plan_prices?.find((p) => p.currency === displayCurrency)?.amount ?? contract.price_amount)
                      : (contract.price_amount > 0 ? contract.price_amount : (plan.plan_prices?.find((p) => p.currency === displayCurrency)?.amount ?? 0));

                  planToDisplay = {
                    ...plan,
                    max_professionals: Math.max(
                      Number(contract.max_professionals || 0),
                      Number(plan.max_professionals || 1)
                    ),
                    allow_products: Boolean(
                      contract.allow_products || plan.allow_products
                    ),
                    features: {
                      ...(plan.features || {}),
                      ...(contract.features || {}),
                    },
                    permissions:
                      contract.permissions && Array.isArray(contract.permissions) && contract.permissions.length > 0
                        ? contract.permissions
                        : plan.permissions,
                    limits: {
                      ...(plan.limits || {}),
                      ...(contract.limits || {}),
                    },
                    plan_prices: [
                      {
                        currency: contract.currency || displayCurrency,
                        amount: customOrContractAmount,
                      },
                    ],
                  };
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
                      rounded-2xl transition-all duration-300
                      ${isRecommended
                        ? 'lg:scale-[1.03] z-10'
                        : 'hover:-translate-y-0.5'
                      }
                    `}
                    style={{
                      background:
                        theme.id === 'elegant'
                          ? '#FFFFFF'
                          : theme.cardBg,

                      border:
                        isRecommended
                          ? `1.5px solid ${theme.accent}`
                          : theme.id === 'elegant'
                            ? '1px solid rgba(15, 23, 42, 0.10)'
                            : `1px solid ${theme.border}`,

                      boxShadow:
                        isRecommended
                          ? `0 18px 40px -16px ${theme.accent}35, 0 4px 12px rgba(0,0,0,0.06)`
                          : theme.id === 'elegant'
                            ? '0 8px 24px -8px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)'
                            : '0 14px 30px -14px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {/* ==========================================
                        RECOMMENDED BADGE
                    ========================================== */}

                    {isRecommended && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.12em] shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                        style={{
                          background: theme.btnPrimaryBg || theme.accent,
                          color: theme.btnPrimaryText,
                        }}
                      >
                        <Star
                          className="w-2.5 h-2.5"
                          style={{ fill: theme.btnPrimaryText, color: theme.btnPrimaryText }}
                        />

                        Recomendado
                      </div>
                    )}

                    {/* ==========================================
                        CARD CONTENT
                    ========================================== */}

                    <div className="p-5 sm:p-6 pt-6 flex-1 flex flex-col">
                      {/* Plan name */}

                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h3
                          className="text-lg font-bold tracking-tight"
                          style={{
                            color: theme.textPrimary,
                          }}
                        >
                          {planToDisplay.name}
                        </h3>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isCurrent && (
                            <span
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${theme.accent}15`,
                                color: theme.accent,
                              }}
                            >
                              Atual
                            </span>
                          )}
                          {plan.is_custom_price && (
                            <span
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                              style={{
                                background: `${theme.accent}12`,
                                color: theme.accent,
                                borderColor: `${theme.accent}35`,
                              }}
                            >
                              Promoção
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}

                      <p
                        className="text-xs leading-5 line-clamp-2 min-h-[40px]"
                        style={{
                          color: theme.textSecondary,
                        }}
                      >
                        {formatPlanDescription(planToDisplay)}
                      </p>

                      {/* ======================================
                          PRICE CARD BLOCK
                      ====================================== */}

                      <div
                        className="my-4 p-4 rounded-xl border"
                        style={{
                          background:
                            theme.id === 'elegant'
                              ? '#F8FAFC'
                              : 'rgba(255,255,255,0.03)',
                          borderColor:
                            theme.id === 'elegant'
                              ? 'rgba(15, 23, 42, 0.06)'
                              : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        {planPriceObj ? (
                          <>
                            {plan.is_custom_price &&
                              plan.original_amount &&
                              plan.original_amount > planPriceObj.amount && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="text-xs line-through opacity-60 font-medium"
                                    style={{ color: theme.textSecondary }}
                                  >
                                    De {money(plan.original_amount, displayCurrency).replace(/,00$/, '')}
                                  </span>
                                  <span
                                    className="text-[10px] font-bold"
                                    style={{ color: theme.accent }}
                                  >
                                    Desconto exclusivo
                                  </span>
                                </div>
                              )}
                            <div className="flex items-baseline gap-1">
                              <span
                                className="text-[36px] leading-none font-black tracking-[-0.04em]"
                                style={{
                                  color: theme.textPrimary,
                                }}
                              >
                                {money(
                                  planPriceObj.amount,
                                  displayCurrency
                                ).replace(
                                  /,00$/,
                                  ''
                                )}
                              </span>

                              <span
                                className="text-xs font-semibold"
                                style={{
                                  color: theme.textSecondary,
                                }}
                              >
                                /mês
                              </span>
                            </div>
                          </>
                        ) : (
                          <span
                            className="text-sm font-semibold"
                            style={{
                              color: theme.textMuted,
                            }}
                          >
                            Preço sob consulta
                          </span>
                        )}
                      </div>

                      {/* ======================================
                          VALUE — CIRÚRGICO
                      ====================================== */}

                      <div className="flex-1">
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
                                    color: theme.accent,
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
                                  'profissiona'
                                )
                          ) && (
                              <div className="flex items-start gap-2.5">
                                <CheckCircle2
                                  className="w-4 h-4 shrink-0 mt-0.5"
                                  style={{
                                    color: theme.accent,
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
                                ? (theme.btnPrimaryBg || theme.accent)
                                : theme.id === 'elegant'
                                  ? '#FFFFFF'
                                  : 'rgba(255,255,255,0.06)',

                          color:
                            isCurrent
                              ? theme.accent
                              : isRecommended
                                ? theme.btnPrimaryText
                                : theme.textPrimary,

                          border:
                            isCurrent
                              ? `1px solid ${theme.accent}35`
                              : isRecommended
                                ? 'none'
                                : theme.id === 'elegant'
                                  ? '1px solid #CBD5E1'
                                  : `1px solid ${theme.border}`,

                          boxShadow:
                            isRecommended && !isCurrent
                              ? `0 8px 20px -6px ${theme.accent}55`
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

                      {!isCurrent && (
                        <div className="mt-3 flex items-center justify-center gap-1.5">
                          {tenant?.status === 'trial' ? (
                            <>
                              <ShieldCheck
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: theme.accent }}
                              />
                              <span
                                className="text-[10px] font-medium"
                                style={{ color: theme.textMuted }}
                              >
                                R$ 0 hoje • Cancele em 1 clique
                              </span>
                            </>
                          ) : (
                            <>
                              <Lock
                                className="w-3 h-3 shrink-0"
                                style={{ color: theme.accent }}
                              />
                              <span
                                className="text-[10px] font-medium"
                                style={{ color: theme.textMuted }}
                              >
                                Ambiente seguro • Sem fidelidade
                              </span>
                            </>
                          )}
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
        <div className="mt-10 flex justify-center">
          <div
            className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-5 px-5 py-3.5 rounded-2xl border shadow-xs text-center"
            style={{
              background: theme.cardBg,
              borderColor: theme.border,
            }}
          >
            <MercadoPagoHorizontalLogo
              darkBg={theme.id !== 'elegant'}
              className="h-7 w-auto shrink-0"
            />

            <span
              className="hidden sm:inline-block w-px h-5"
              style={{ background: theme.border }}
            />

            <div className="inline-flex items-center gap-3.5 sm:gap-4 flex-wrap justify-center">
              <span className="flex items-center gap-1.5 text-[10px] font-medium">
                <ShieldCheck
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: theme.accent }}
                />
                <span style={{ color: theme.textMuted }}>
                  Ambiente criptografado
                </span>
              </span>

              <span
                className="w-1 h-1 rounded-full"
                style={{ background: theme.border }}
              />

              <span className="flex items-center gap-1.5 text-[10px] font-medium">
                <Lock
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: theme.accent }}
                />
                <span style={{ color: theme.textMuted }}>
                  Pix instantâneo e Cartão
                </span>
              </span>

              <span
                className="w-1 h-1 rounded-full"
                style={{ background: theme.border }}
              />

              <span className="flex items-center gap-1.5 text-[10px] font-medium">
                <CheckCircle2
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: theme.accent }}
                />
                <span style={{ color: theme.textMuted }}>
                  Sem fidelidade • Cancele quando quiser
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
