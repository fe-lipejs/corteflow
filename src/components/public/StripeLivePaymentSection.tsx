import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements, type StripePaymentElement } from "@stripe/stripe-js";
import {
  Loader2,
  Lock,
  AlertCircle,
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  User,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../integrations/supabase/client";

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string): Promise<Stripe | null> {
  const key = publishableKey.trim();
  if (!stripePromiseCache.has(key)) {
    stripePromiseCache.set(key, loadStripe(key, { locale: "pt-BR" }));
  }
  return stripePromiseCache.get(key)!;
}

const money = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const PixOfficialIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    viewBox="0 0 512 512"
    fill="currentColor"
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g fillRule="evenodd">
      <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l76.693-76.692c5.385-5.404 14.765-5.384 20.15 0l76.989 76.989c14.191 14.172 33.045 21.98 53.12 21.98h15.098l-97.138 97.139c-30.326 30.344-79.505 30.344-109.85 0l-97.415-97.416h9.232zm280.068-271.294c-20.056 0-38.929 7.809-53.12 22l-76.97 76.99c-5.551 5.53-14.6 5.568-20.15-.02l-76.711-76.693c-14.192-14.191-33.046-21.999-53.12-21.999h-9.234l97.416-97.416c30.344-30.344 79.523-30.344 109.867 0l97.138 97.138h-15.116z" />
      <path d="M22.758 200.753l58.024-58.024h31.787c13.84 0 27.384 5.605 37.172 15.394l76.694 76.693c7.178 7.179 16.596 10.768 26.033 10.768 9.417 0 18.854-3.59 26.014-10.75l76.989-76.99c9.787-9.787 23.331-15.393 37.171-15.393h37.654l58.3 58.302c30.343 30.344 30.343 79.523 0 109.867l-58.3 58.303H392.64c-13.84 0-27.384-5.605-37.171-15.394l-76.97-76.99c-13.914-13.894-38.172-13.894-52.066.02l-76.694 76.674c-9.788 9.788-23.332 15.413-37.172 15.413H80.782L22.758 310.62c-30.344-30.345-30.344-79.524 0-109.868" />
    </g>
  </svg>
);

export interface PixQrData {
  data: string;
  image_url_png?: string;
  image_url_svg?: string;
  expires_at?: number;
  hosted_instructions_url?: string;
}

export interface StripeLivePaymentHandle {
  submitAndConfirm: (params: {
    createIntent: (methodType: "pix" | "card") => Promise<{
      clientSecret: string;
      paymentIntentId: string;
      bookingId: string;
      orderNumber: string;
      pixQrData?: PixQrData | null;
    }>;
    returnUrl: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
  }) => Promise<{
    status: string;
    paymentIntentId: string;
    bookingId: string;
    orderNumber: string;
  }>;
}

interface StripeLivePaymentSectionProps {
  publishableKey: string | null | undefined;
  stripeAccountId: string | null | undefined;
  amountBRL: number;
  totalBRL?: number;
  amountDueBRL?: number;
  paymentScopeLabel?: string;
  storeName?: string;
  storeLogoUrl?: string | null;
  serviceName?: string;
  serviceDurationLabel?: string;
  proName?: string;
  dateLabel?: string;
  timeLabel?: string;
  accent: string;
  btnPrimaryText?: string;
  isDark: boolean;
  cardBackground: string;
  cardBorderColor: string;
  textPrimary: string;
  textSecondary: string;
  onPaymentMethodChange?: (method: "pix" | "card") => void;
}

interface ActivePixModalState {
  bookingId: string;
  orderNumber: string;
  paymentIntentId: string;
  clientSecret: string;
  qrData: PixQrData;
  resolve: (res: {
    status: string;
    paymentIntentId: string;
    bookingId: string;
    orderNumber: string;
  }) => void;
  reject: (err: Error) => void;
}

export const StripeLivePaymentSection = forwardRef<
  StripeLivePaymentHandle,
  StripeLivePaymentSectionProps
>(function StripeLivePaymentSection(
  {
    publishableKey,
    stripeAccountId,
    amountBRL,
    totalBRL,
    amountDueBRL,
    paymentScopeLabel,
    storeName,
    storeLogoUrl,
    serviceName,
    serviceDurationLabel,
    proName,
    dateLabel,
    timeLabel,
    accent,
    btnPrimaryText = "#FFFFFF",
    isDark,
    cardBackground,
    cardBorderColor,
    textPrimary,
    textSecondary,
    onPaymentMethodChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);

  const [selectedTab, setSelectedTab] = useState<"pix" | "card">("pix");
  const [elementReady, setElementReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  // Estado do Modal PIX Personalizado com Perfil do Salão + Serviço + Valor
  const [activePixModal, setActivePixModal] = useState<ActivePixModalState | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [checkingPixNow, setCheckingPixNow] = useState(false);
  const [pixCheckFeedback, setPixCheckFeedback] = useState<string | null>(null);

  const resolvedKey =
    publishableKey?.trim() ||
    (import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined)?.trim() ||
    "";

  const amountCents = Math.max(50, Math.round((amountBRL || 0) * 100));

  const handleSelectTab = (tab: "pix" | "card") => {
    setSelectedTab(tab);
    onPaymentMethodChange?.(tab);
  };

  // Inicializar Stripe Elements apenas para Cartão (ou pré-carregar o objeto Stripe)
  useEffect(() => {
    let cancelled = false;

    if (!resolvedKey) {
      setMountError("Chave pública do Stripe não configurada.");
      return;
    }

    async function initStripeAndCardElement() {
      setMountError(null);

      try {
        const stripe = await getStripePromise(resolvedKey);
        if (cancelled) return;

        if (!stripe) {
          setMountError("Não foi possível carregar o módulo de pagamento seguro do Stripe.");
          return;
        }

        stripeRef.current = stripe;

        if (selectedTab !== "card") {
          return;
        }

        setElementReady(false);

        const elements = stripe.elements({
          mode: "payment",
          amount: amountCents,
          currency: "brl",
          ...(stripeAccountId ? { onBehalfOf: stripeAccountId } : {}),
          paymentMethodTypes: ["card"],
          locale: "pt-BR",
          appearance: {
            theme: isDark ? "night" : "stripe",
            variables: {
              colorPrimary: accent || "#C9963B",
              colorBackground: isDark ? "#121417" : "#FFFFFF",
              colorText: textPrimary || (isDark ? "#F8FAFC" : "#0F172A"),
              colorTextSecondary: textSecondary || (isDark ? "#A1A1AA" : "#475569"),
              colorDanger: "#EF4444",
              fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
              borderRadius: "12px",
              spacingUnit: "4px",
            },
            rules: {
              ".Input": {
                border: `1px solid ${cardBorderColor}`,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
                boxShadow: "none",
              },
              ".Input:focus": {
                borderColor: accent || "#C9963B",
                boxShadow: "none",
              },
            },
          },
        });

        elementsRef.current = elements;

        const paymentEl = elements.create("payment", {
          layout: {
            type: "tabs",
            defaultCollapsed: false,
          },
          fields: {
            billingDetails: {
              name: "never",
              email: "never",
              phone: "never",
            },
          },
          wallets: {
            applePay: "auto",
            googlePay: "auto",
          },
        });

        paymentElementRef.current = paymentEl;

        paymentEl.on("ready", () => {
          if (!cancelled) {
            setElementReady(true);
          }
        });

        paymentEl.on("loaderror", (event) => {
          if (cancelled) return;
          setMountError(
            event.error?.message ||
            "Não foi possível carregar o formulário de cartão deste estabelecimento."
          );
        });

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          paymentEl.mount(containerRef.current);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMountError(err?.message || "Erro ao inicializar o Stripe.");
        }
      }
    }

    initStripeAndCardElement();

    return () => {
      cancelled = true;
      try {
        paymentElementRef.current?.destroy();
      } catch (_) { }
      paymentElementRef.current = null;
      elementsRef.current = null;
    };
  }, [
    resolvedKey,
    stripeAccountId,
    selectedTab,
    isDark,
    accent,
    cardBackground,
    cardBorderColor,
    textPrimary,
    textSecondary,
  ]);

  // Atualizar valor no Elements quando o cliente alterna entre Entrada 50% e Total Agora
  useEffect(() => {
    if (elementsRef.current && amountCents >= 50) {
      try {
        elementsRef.current.update({ amount: amountCents });
      } catch (_) { }
    }
  }, [amountCents]);

  // Polling automático a cada 2.5 segundos + detecção instantânea ao voltar do app do banco (focus/visibilitychange)
  useEffect(() => {
    if (!activePixModal) return;

    let stopped = false;
    let inFlight = false;
    const { bookingId, paymentIntentId, orderNumber, resolve } = activePixModal;

    const checkStatus = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const { data } = await supabase.functions.invoke("create-payment-intent", {
          body: {
            action: "check_pix_status",
            bookingId,
            paymentIntentId,
          },
        });

        if (!stopped && data?.confirmed) {
          stopped = true;
          setActivePixModal(null);
          resolve({
            status: "succeeded",
            paymentIntentId,
            bookingId,
            orderNumber: data.order_number || orderNumber,
          });
        }
      } catch (_) {
        // Silencioso durante polling automático
      } finally {
        inFlight = false;
      }
    };

    // Checagem imediata e a cada 2.5s
    checkStatus();
    const intervalId = window.setInterval(checkStatus, 2500);

    // Disparar checagem imediata no milissegundo em que o cliente volta do app do banco para o navegador
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkStatus();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [activePixModal]);

  const handleManualPixCheck = async () => {
    if (!activePixModal || checkingPixNow) return;
    setCheckingPixNow(true);
    setPixCheckFeedback(null);

    try {
      const { bookingId, paymentIntentId, orderNumber, resolve } = activePixModal;
      const { data } = await supabase.functions.invoke("create-payment-intent", {
        body: {
          action: "check_pix_status",
          bookingId,
          paymentIntentId,
        },
      });

      if (data?.confirmed) {
        setActivePixModal(null);
        resolve({
          status: "succeeded",
          paymentIntentId,
          bookingId,
          orderNumber: data.order_number || orderNumber,
        });
      } else {
        setPixCheckFeedback(
          "Ainda estamos aguardando a confirmação do banco. Assim que você concluir o PIX no app do banco, esta tela avançará automaticamente!"
        );
      }
    } catch {
      setPixCheckFeedback("Verificando com o banco... Aguarde alguns segundos.");
    } finally {
      setCheckingPixNow(false);
    }
  };

  const handleCancelPixModal = async () => {
    if (!activePixModal) return;
    const { bookingId, orderNumber, paymentIntentId, resolve, reject } = activePixModal;
    setActivePixModal(null);
    setCopiedPix(false);
    setPixCheckFeedback(null);

    try {
      const { data } = await supabase.functions.invoke("create-payment-intent", {
        body: { action: "abort_booking", bookingId, paymentIntentId },
      });

      // Se o cliente já havia pago no banco antes de clicar no X, honramos o pagamento!
      if (data?.confirmed) {
        resolve({
          status: "succeeded",
          paymentIntentId,
          bookingId,
          orderNumber: data.order_number || orderNumber,
        });
        return;
      }
    } catch (_) { }

    reject(
      new Error(
        "Pagamento PIX cancelado. Clique novamente no botão abaixo quando quiser gerar um novo QR Code PIX."
      )
    );
  };

  const handleCopyPixCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPix(true);
      window.setTimeout(() => setCopiedPix(false), 3500);
    } catch {
      // Fallback copy
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedPix(true);
      window.setTimeout(() => setCopiedPix(false), 3500);
    }
  };

  useImperativeHandle(ref, () => ({
    async submitAndConfirm({
      createIntent,
      returnUrl,
      customerName,
      customerPhone,
      customerEmail,
    }) {
      // ── FLUXO 1: PIX INSTANTÂNEO COM MODAL PERSONALIZADO DO SALÃO ──────────
      if (selectedTab === "pix") {
        const { clientSecret, paymentIntentId, bookingId, orderNumber, pixQrData } =
          await createIntent("pix");

        if (pixQrData && pixQrData.data) {
          setCopiedPix(false);
          setPixCheckFeedback(null);

          return await new Promise<{
            status: string;
            paymentIntentId: string;
            bookingId: string;
            orderNumber: string;
          }>((resolve, reject) => {
            setActivePixModal({
              bookingId,
              orderNumber,
              paymentIntentId,
              clientSecret,
              qrData: pixQrData,
              resolve,
              reject,
            });
          });
        }

        // Fallback caso o Stripe não tenha retornado pixQrData diretamente no backend
        const stripe = stripeRef.current || (await getStripePromise(resolvedKey));
        if (!stripe) {
          throw new Error("Módulo Stripe indisponível no momento.");
        }

        const cleanDigits = (customerPhone || "").replace(/\D/g, "") || "cliente";
        const safeEmail =
          customerEmail && customerEmail.trim().includes("@")
            ? customerEmail.trim()
            : `cliente.${cleanDigits}@navalha.app`;

        const { error: pixErr, paymentIntent } = await stripe.confirmPixPayment(clientSecret, {
          payment_method: {
            billing_details: {
              name: customerName.trim(),
              email: safeEmail,
            },
          },
        });

        if (pixErr || !paymentIntent || paymentIntent.status !== "succeeded") {
          await supabase.functions
            .invoke("create-payment-intent", {
              body: { action: "abort_booking", bookingId, paymentIntentId },
            })
            .catch(() => { });

          throw new Error(
            pixErr?.message ||
            "O pagamento via PIX não foi concluído. Tente novamente para confirmar seu horário."
          );
        }

        await supabase.functions.invoke("create-payment-intent", {
          body: {
            action: "confirm_booking",
            bookingId,
            paymentIntentId: paymentIntent.id,
          },
        });

        return {
          status: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          bookingId,
          orderNumber,
        };
      }

      // ── FLUXO 2: CARTÃO DE CRÉDITO VIA STRIPE PAYMENT ELEMENT LIVE ─────────
      const stripe = stripeRef.current;
      const elements = elementsRef.current;

      if (!stripe || !elements) {
        throw new Error(
          "O formulário de cartão ainda está carregando. Aguarde um segundo e tente novamente."
        );
      }

      // 1. Validar os dados do cartão preenchidos antes de criar o agendamento
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(
          submitError.message || "Por favor, verifique os dados do cartão informados."
        );
      }

      // 2. Criar o agendamento pendente + PaymentIntent Live no backend
      const { clientSecret, paymentIntentId, bookingId, orderNumber } =
        await createIntent("card");

      const cleanDigits = (customerPhone || "").replace(/\D/g, "") || "cliente";
      const safeEmail =
        customerEmail && customerEmail.trim().includes("@")
          ? customerEmail.trim()
          : `cliente.${cleanDigits}@navalha.app`;

      const separator = returnUrl.includes("?") ? "&" : "?";
      const finalReturnUrl = `${returnUrl}${separator}order=${encodeURIComponent(orderNumber)}`;

      // 3. Confirmar o pagamento de Cartão diretamente no Stripe Live
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: finalReturnUrl,
          payment_method_data: {
            billing_details: {
              name: customerName.trim(),
              email: safeEmail,
              phone: customerPhone,
            },
          },
        },
        redirect: "if_required",
      });

      if (confirmError) {
        await supabase.functions
          .invoke("create-payment-intent", {
            body: { action: "abort_booking", bookingId, paymentIntentId },
          })
          .catch(() => { });

        throw new Error(
          confirmError.message ||
          "Pagamento recusado pelo emissor do cartão. Verifique os dados ou pague via PIX."
        );
      }

      if (
        !paymentIntent ||
        (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing")
      ) {
        await supabase.functions
          .invoke("create-payment-intent", {
            body: { action: "abort_booking", bookingId, paymentIntentId },
          })
          .catch(() => { });

        throw new Error(
          "O pagamento com cartão não foi concluído. Tente novamente ou escolha PIX."
        );
      }

      // 4. Confirmar o agendamento no banco de dados após aprovação do Stripe Live
      await supabase.functions.invoke("create-payment-intent", {
        body: {
          action: "confirm_booking",
          bookingId,
          paymentIntentId: paymentIntent.id,
        },
      });

      return {
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
        bookingId,
        orderNumber,
      };
    },
  }));

  return (
    <div className="space-y-3">
      {/* Seletor Minimalista: PIX vs Cartão */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => handleSelectTab("pix")}
          className="relative flex items-center justify-center gap-2.5 h-12 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          style={{
            borderColor: selectedTab === "pix" ? accent : cardBorderColor,
            background:
              selectedTab === "pix"
                ? `${accent}0d`
                : "transparent",
            boxShadow: selectedTab === "pix" ? `0 0 0 1px ${accent}` : "none",
            color: selectedTab === "pix" ? accent : textPrimary,
          }}
        >
          <PixOfficialIcon
            className="w-5 h-5 shrink-0 transition-transform"
            style={{ color: selectedTab === "pix" ? accent : "#00BDAE" }}
          />
          <span>PIX</span>
          {selectedTab === "pix" && (
            <CheckCircle2
              className="w-3.5 h-3.5 absolute top-2 right-2"
              style={{ color: accent }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab("card")}
          className="relative flex items-center justify-center gap-2.5 h-12 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          style={{
            borderColor: selectedTab === "card" ? accent : cardBorderColor,
            background:
              selectedTab === "card"
                ? `${accent}0d`
                : "transparent",
            boxShadow: selectedTab === "card" ? `0 0 0 1px ${accent}` : "none",
            color: selectedTab === "card" ? accent : textPrimary,
          }}
        >
          <CreditCard
            className="w-5 h-5 shrink-0"
            style={{ color: selectedTab === "card" ? accent : textSecondary }}
          />
          <span>Cartão de Crédito</span>
          {selectedTab === "card" && (
            <CheckCircle2
              className="w-3.5 h-3.5 absolute top-2 right-2"
              style={{ color: accent }}
            />
          )}
        </button>
      </div>

      {/* ABA 2: CARTÃO DE CRÉDITO — Formulário Oficial Stripe Live */}
      {selectedTab === "card" && (
        <div className="pt-2">
          {mountError ? (
            <div
              className="rounded-xl border p-3 flex items-start gap-2 text-xs"
              style={{
                borderColor: "rgba(239, 68, 68, 0.35)",
                background: "rgba(239, 68, 68, 0.08)",
                color: "#EF4444",
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{mountError}</span>
            </div>
          ) : (
            <div className="relative min-h-[120px]">
              {!elementReady && (
                <div
                  className="rounded-xl border p-5 flex flex-col items-center justify-center gap-2 text-xs"
                  style={{
                    borderColor: cardBorderColor,
                    background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                    color: textSecondary,
                  }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
                  <span>Carregando dados do cartão…</span>
                </div>
              )}
              <div
                ref={containerRef}
                className={elementReady ? "block" : "opacity-0 pointer-events-none h-0 overflow-hidden"}
              />
            </div>
          )}
        </div>
      )}

      <div
        className="flex items-center justify-center gap-1.5 pt-1 text-[11px] opacity-70"
        style={{ color: textSecondary }}
      >
        <Lock className="w-3 h-3" />
        <span>Pagamento seguro via Stripe</span>
      </div>

      {/* ── MODAL PIX ULTRA-MINIMALISTA (SEM SCROLL) ── */}
      {activePixModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            onClick={handleCancelPixModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Card do Modal */}
          <div
            className="relative w-full max-w-md rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl border flex flex-col"
            style={{
              background: cardBackground,
              borderColor: cardBorderColor,
              color: textPrimary,
            }}
          >
            {/* Cabeçalho Limpo: Logo + Nome do Salão + Pedido */}
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between gap-3"
              style={{
                borderColor: cardBorderColor,
                background: isDark ? "rgba(255,255,255,0.02)" : "#FAFAFA",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {storeLogoUrl ? (
                  <img
                    src={storeLogoUrl}
                    alt={storeName || "Salão"}
                    className="w-9 h-9 rounded-xl object-cover border shrink-0"
                    style={{ borderColor: cardBorderColor }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: accent, color: btnPrimaryText }}
                  >
                    {(storeName || "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate leading-tight" style={{ color: textPrimary }}>
                    {storeName || "Pagamento via PIX"}
                  </p>
                  <p className="text-[11px] font-medium opacity-65 flex items-center gap-1" style={{ color: textSecondary }}>
                    <span>Pedido #{activePixModal.orderNumber}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelPixModal}
                aria-label="Fechar"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer shrink-0"
                style={{
                  background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
                  color: textPrimary,
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conteúdo sem scroll */}
            <div className="p-5 space-y-4">
              {/* Resumo do Serviço Escolhido + Valor */}
              <div
                className="rounded-xl border p-3 flex items-center justify-between gap-3"
                style={{
                  borderColor: cardBorderColor,
                  background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate leading-tight" style={{ color: textPrimary }}>
                    {serviceName || "Serviço agendado"}
                  </p>
                  <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: textSecondary }}>
                    {[proName, dateLabel && timeLabel ? `${dateLabel} às ${timeLabel}` : dateLabel].filter(Boolean).join(" • ")}
                  </p>
                  {typeof amountDueBRL === "number" && amountDueBRL > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                      Restante no salão: <strong style={{ color: textPrimary }}>{money(amountDueBRL)}</strong>
                    </p>
                  )}
                </div>

                <div
                  className="text-right px-2.5 py-1 rounded-lg shrink-0"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider block" style={{ color: accent }}>
                    {paymentScopeLabel || "Pagar Agora"}
                  </span>
                  <span className="text-base font-black leading-tight" style={{ color: accent }}>
                    {money(amountBRL)}
                  </span>
                </div>
              </div>

              {/* QR Code Compacto e Nítido */}
              <div className="flex flex-col items-center text-center">
                {activePixModal.qrData.image_url_png && (
                  <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 inline-flex flex-col items-center">
                    <img
                      src={activePixModal.qrData.image_url_png}
                      alt="QR Code PIX"
                      className="w-36 h-36 object-contain"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-slate-600">
                      <PixOfficialIcon className="w-3.5 h-3.5 text-[#00BDAE]" />
                      <span>Aponte a câmera do seu banco</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Trecho Sutil do Código PIX com Reticências */}
              <div
                onClick={() => handleCopyPixCode(activePixModal.qrData.data)}
                title="Clique para copiar o código PIX"
                className="w-full px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] font-mono cursor-pointer transition-colors"
                style={{
                  borderColor: cardBorderColor,
                  background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                  color: textSecondary,
                }}
              >
                <span className="truncate select-all opacity-75">
                  {activePixModal.qrData.data.slice(0, 34)}...
                </span>
                <span className="text-[10px] font-sans font-bold shrink-0" style={{ color: copiedPix ? "#16A34A" : accent }}>
                  {copiedPix ? "Copiado!" : "Copiar"}
                </span>
              </div>

              {/* Botão de Destaque: Copiar Código PIX */}
              <button
                type="button"
                onClick={() => handleCopyPixCode(activePixModal.qrData.data)}
                className="w-full h-12 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                style={{
                  background: copiedPix ? "#16A34A" : accent,
                  color: copiedPix ? "#FFFFFF" : btnPrimaryText,
                }}
              >
                {copiedPix ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Código PIX Copiado! Cole no seu banco</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Código PIX • {money(amountBRL)}</span>
                  </>
                )}
              </button>

              {/* Confirmação Automática Sutil com botão Já Paguei */}
              <div className="flex items-center justify-between gap-2 pt-1 text-[11px]" style={{ color: textSecondary }}>
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: accent }} />
                  <span>Aguardando confirmação do banco…</span>
                </span>
                <button
                  type="button"
                  onClick={handleManualPixCheck}
                  disabled={checkingPixNow}
                  className="font-bold underline cursor-pointer shrink-0 hover:opacity-80 disabled:opacity-50"
                  style={{ color: accent }}
                >
                  {checkingPixNow ? "Verificando..." : "Já realizei o pagamento"}
                </button>
              </div>

              {pixCheckFeedback && (
                <p className="text-[11px] text-center leading-relaxed" style={{ color: textSecondary }}>
                  {pixCheckFeedback}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
