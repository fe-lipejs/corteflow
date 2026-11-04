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

const PixDiamondIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M16.59 8.59L12 4 7.41 8.59 4 12l3.41 3.41L12 20l4.59-4.59L20 12l-3.41-3.41zM12 6.83l2.59 2.58c-.39.39-1.02.39-1.41 0L12 8.24l-1.18 1.17c-.39.39-1.02.39-1.41 0L12 6.83zm-5.17 5.17l2.58-2.59c.39.39.39 1.02 0 1.41L8.24 12l1.17 1.18c.39.39.39 1.02 0 1.41L6.83 12zm5.17 5.17l-2.59-2.58c.39-.39 1.02-.39 1.41 0L12 15.76l1.18-1.17c.39-.39 1.02-.39 1.41 0L12 17.17zm5.17-5.17l-2.58 2.59c-.39-.39-.39-1.02 0-1.41L15.76 12l-1.17-1.18c-.39-.39-.39-1.02 0-1.41L17.17 12z" />
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
      } catch (_) {}
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
      } catch (_) {}
    }
  }, [amountCents]);

  // Polling automático a cada 2.5 segundos enquanto o Modal PIX estiver aberto
  useEffect(() => {
    if (!activePixModal) return;

    let stopped = false;
    const { bookingId, paymentIntentId, orderNumber, resolve } = activePixModal;

    const checkStatus = async () => {
      if (stopped) return;
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
      } catch (_) {}
    };

    const intervalId = window.setInterval(checkStatus, 2500);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
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
    const { bookingId, paymentIntentId, reject } = activePixModal;
    setActivePixModal(null);
    setCopiedPix(false);
    setPixCheckFeedback(null);

    await supabase.functions
      .invoke("create-payment-intent", {
        body: { action: "abort_booking", bookingId, paymentIntentId },
      })
      .catch(() => {});

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
            .catch(() => {});

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
          .catch(() => {});

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
          .catch(() => {});

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
          <PixDiamondIcon
            className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 transition-transform"
            style={{ color: selectedTab === "pix" ? accent : "#00BDAE" }}
          />
          <span>PIX Instantâneo</span>
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

      {/* ── MODAL PIX PERSONALIZADO COM PERFIL DO SALÃO, SERVIÇO E VALOR EXATO ── */}
      {activePixModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            onClick={handleCancelPixModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Card do Modal */}
          <div
            className="relative w-full max-w-md rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl border flex flex-col max-h-[92vh]"
            style={{
              background: cardBackground,
              borderColor: cardBorderColor,
              color: textPrimary,
            }}
          >
            {/* Cabeçalho com Perfil do Salão (Logo + Nome + Selo PIX Seguro) */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between gap-3"
              style={{
                borderColor: cardBorderColor,
                background: isDark ? `${accent}12` : `${accent}0a`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {storeLogoUrl ? (
                  <img
                    src={storeLogoUrl}
                    alt={storeName || "Salão"}
                    className="w-11 h-11 rounded-2xl object-cover border shrink-0 shadow-sm"
                    style={{ borderColor: `${accent}40` }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0"
                    style={{ background: accent, color: btnPrimaryText }}
                  >
                    {(storeName || "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-extrabold truncate" style={{ color: textPrimary }}>
                    {storeName || "Pagamento do Agendamento"}
                  </p>
                  <p
                    className="text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: accent }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>PIX Oficial • Pedido #{activePixModal.orderNumber}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelPixModal}
                aria-label="Fechar"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer shrink-0"
                style={{
                  background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
                  color: textPrimary,
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Rolável */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Resumo do Serviço Escolhido + Valor em Destaque */}
              <div
                className="rounded-2xl border p-3.5 space-y-2.5"
                style={{
                  borderColor: cardBorderColor,
                  background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block"
                      style={{ color: textSecondary }}
                    >
                      Serviço escolhido
                    </span>
                    <p className="text-sm font-extrabold leading-snug" style={{ color: textPrimary }}>
                      {serviceName || "Serviço agendado"}
                    </p>
                    <div
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] font-medium"
                      style={{ color: textSecondary }}
                    >
                      {proName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" style={{ color: accent }} />
                          {proName}
                        </span>
                      )}
                      {dateLabel && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" style={{ color: accent }} />
                          {dateLabel} {timeLabel ? `às ${timeLabel}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Valor do PIX em destaque */}
                  <div
                    className="text-right px-3 py-1.5 rounded-xl shrink-0"
                    style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider block"
                      style={{ color: accent }}
                    >
                      {paymentScopeLabel || "Pagar Agora"}
                    </span>
                    <span className="text-base sm:text-lg font-black" style={{ color: accent }}>
                      {money(amountBRL)}
                    </span>
                  </div>
                </div>

                {typeof amountDueBRL === "number" && amountDueBRL > 0 && (
                  <div
                    className="flex items-center justify-between pt-2 border-t text-[11px]"
                    style={{ borderColor: cardBorderColor, color: textSecondary }}
                  >
                    <span>Valor total: {money(totalBRL || amountBRL + amountDueBRL)}</span>
                    <span>
                      Restante no salão: <strong style={{ color: textPrimary }}>{money(amountDueBRL)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code PIX Oficial do Stripe Live */}
              <div className="flex flex-col items-center text-center">
                {activePixModal.qrData.image_url_png ? (
                  <div className="bg-white p-3.5 rounded-2xl shadow-md border border-slate-200 inline-flex flex-col items-center">
                    <img
                      src={activePixModal.qrData.image_url_png}
                      alt="QR Code PIX"
                      className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                    />
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-slate-600">
                      <PixDiamondIcon className="w-3.5 h-3.5 text-[#00BDAE]" />
                      <span>Escaneie com o app do seu banco</span>
                    </div>
                  </div>
                ) : null}

                <p className="text-xs font-medium mt-3" style={{ color: textSecondary }}>
                  Ou copie o código <strong>PIX Copia e Cola</strong> abaixo e cole no seu banco:
                </p>
              </div>

              {/* Campo + Botão de Copiar PIX Copia e Cola */}
              <div className="space-y-2.5">
                <div
                  className="rounded-xl border px-3 py-2.5 text-[11px] font-mono break-all select-all max-h-16 overflow-y-auto"
                  style={{
                    borderColor: cardBorderColor,
                    background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                    color: textSecondary,
                  }}
                >
                  {activePixModal.qrData.data}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyPixCode(activePixModal.qrData.data)}
                  className="w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                  style={{
                    background: copiedPix ? "#16A34A" : accent,
                    color: copiedPix ? "#FFFFFF" : btnPrimaryText,
                  }}
                >
                  {copiedPix ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Código PIX Copiado! Agora cole no app do banco</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código PIX • {money(amountBRL)}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status em tempo real de confirmação automática */}
              <div
                className="rounded-2xl border p-3 flex flex-col gap-2"
                style={{
                  borderColor: cardBorderColor,
                  background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: textPrimary }}>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: accent }} />
                    <span>Aguardando confirmação automática do pagamento…</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualPixCheck}
                    disabled={checkingPixNow}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center gap-1 disabled:opacity-50"
                    style={{
                      borderColor: `${accent}50`,
                      color: accent,
                      background: `${accent}10`,
                    }}
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingPixNow ? "animate-spin" : ""}`} />
                    <span>Já paguei</span>
                  </button>
                </div>

                {pixCheckFeedback && (
                  <p className="text-[11px] leading-relaxed" style={{ color: textSecondary }}>
                    {pixCheckFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
