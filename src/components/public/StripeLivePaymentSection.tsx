import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements, type StripePaymentElement } from "@stripe/stripe-js";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string): Promise<Stripe | null> {
  const key = publishableKey.trim();
  if (!stripePromiseCache.has(key)) {
    stripePromiseCache.set(key, loadStripe(key, { locale: "pt-BR" }));
  }
  return stripePromiseCache.get(key)!;
}

export interface StripeLivePaymentHandle {
  submitAndConfirm: (params: {
    createIntent: () => Promise<{
      clientSecret: string;
      paymentIntentId: string;
      bookingId: string;
      orderNumber: string;
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
  accent: string;
  isDark: boolean;
  cardBackground: string;
  cardBorderColor: string;
  textPrimary: string;
  textSecondary: string;
  onPaymentMethodChange?: (method: "pix" | "card") => void;
}

export const StripeLivePaymentSection = forwardRef<
  StripeLivePaymentHandle,
  StripeLivePaymentSectionProps
>(function StripeLivePaymentSection(
  {
    publishableKey,
    stripeAccountId,
    amountBRL,
    accent,
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

  const [elementReady, setElementReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [fallbackCardOnly, setFallbackCardOnly] = useState(false);

  const resolvedKey =
    publishableKey?.trim() ||
    (import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined)?.trim() ||
    "";

  const amountCents = Math.max(50, Math.round((amountBRL || 0) * 100));

  useEffect(() => {
    let cancelled = false;

    if (!resolvedKey) {
      setMountError("Chave pública do Stripe não configurada.");
      return;
    }

    async function initElements() {
      setElementReady(false);
      setMountError(null);

      try {
        const stripe = await getStripePromise(resolvedKey);
        if (cancelled) return;

        if (!stripe) {
          setMountError("Não foi possível carregar o módulo de pagamento seguro do Stripe.");
          return;
        }

        stripeRef.current = stripe;

        const methods = fallbackCardOnly ? ["card"] : ["card", "pix"];

        const elements = stripe.elements({
          mode: "payment",
          amount: amountCents,
          currency: "brl",
          ...(stripeAccountId ? { onBehalfOf: stripeAccountId } : {}),
          paymentMethodTypes: methods,
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
              ".Tab": {
                border: `1px solid ${cardBorderColor}`,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
                boxShadow: "none",
              },
              ".Tab--selected": {
                borderColor: accent || "#C9963B",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#FFFFFF",
                boxShadow: "none",
              },
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

        paymentEl.on("change", (event) => {
          if (!cancelled && event.value?.type) {
            const selectedType = event.value.type === "pix" ? "pix" : "card";
            onPaymentMethodChange?.(selectedType);
          }
        });

        paymentEl.on("loaderror", (event) => {
          if (cancelled) return;
          if (!fallbackCardOnly) {
            console.warn("[StripeLivePaymentSection] Retrying Payment Element with card only:", event.error?.message);
            setFallbackCardOnly(true);
          } else {
            setMountError(
              event.error?.message ||
                "Não foi possível carregar os métodos de pagamento online deste estabelecimento."
            );
          }
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

    initElements();

    return () => {
      cancelled = true;
      try {
        paymentElementRef.current?.destroy();
      } catch (_) {}
      paymentElementRef.current = null;
      elementsRef.current = null;
    };
  }, [resolvedKey, stripeAccountId, fallbackCardOnly, isDark, accent, cardBackground, cardBorderColor, textPrimary, textSecondary]);

  // Atualizar valor quando o cliente alterna entre Entrada 50% e Total Agora
  useEffect(() => {
    if (elementsRef.current && amountCents >= 50) {
      try {
        elementsRef.current.update({ amount: amountCents });
      } catch (_) {}
    }
  }, [amountCents]);

  useImperativeHandle(ref, () => ({
    async submitAndConfirm({
      createIntent,
      returnUrl,
      customerName,
      customerPhone,
      customerEmail,
    }) {
      const stripe = stripeRef.current;
      const elements = elementsRef.current;

      if (!stripe || !elements) {
        throw new Error("O formulário de pagamento do Stripe ainda está carregando. Aguarde um instante.");
      }

      // 1. Validar os campos preenchidos no Stripe Payment Element antes de criar o agendamento
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Por favor, verifique os dados de pagamento informados.");
      }

      // 2. Criar o agendamento pendente + PaymentIntent Live no backend
      const { clientSecret, paymentIntentId, bookingId, orderNumber } = await createIntent();

      const cleanDigits = (customerPhone || "").replace(/\D/g, "") || "cliente";
      const safeEmail =
        customerEmail && customerEmail.trim().includes("@")
          ? customerEmail.trim()
          : `cliente.${cleanDigits}@navalha.app`;

      const separator = returnUrl.includes("?") ? "&" : "?";
      const finalReturnUrl = `${returnUrl}${separator}order=${encodeURIComponent(orderNumber)}`;

      // 3. Confirmar o pagamento diretamente no Stripe Live (Cartão ou QR Code PIX oficial do Stripe)
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
        // Limpar o booking pendente para liberar o horário na agenda
        await supabase.functions
          .invoke("create-payment-intent", {
            body: { action: "abort_booking", bookingId, paymentIntentId },
          })
          .catch(() => {});

        throw new Error(confirmError.message || "Pagamento recusado. Verifique os dados do cartão ou escolha outro método.");
      }

      if (
        !paymentIntent ||
        (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing")
      ) {
        // Caso o cliente tenha fechado o modal do QR Code PIX ou 3DS sem concluir o pagamento
        await supabase.functions
          .invoke("create-payment-intent", {
            body: { action: "abort_booking", bookingId, paymentIntentId },
          })
          .catch(() => {});

        throw new Error(
          "O pagamento não foi concluído. Conclua o pagamento via PIX ou Cartão para confirmar seu horário."
        );
      }

      // 4. Confirmar o agendamento no banco de dados após aprovação do Stripe Live
      const { data: confirmData, error: confirmFnErr } = await supabase.functions.invoke(
        "create-payment-intent",
        {
          body: {
            action: "confirm_booking",
            bookingId,
            paymentIntentId: paymentIntent.id,
          },
        }
      );

      if (confirmFnErr || confirmData?.error) {
        console.warn("[StripeLivePaymentSection] Aviso ao confirmar booking pós-pagamento:", confirmFnErr || confirmData?.error);
      }

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
      {mountError ? (
        <div
          className="rounded-2xl border p-4 flex items-start gap-2.5 text-xs"
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
        <div className="relative min-h-[140px]">
          {!elementReady && (
            <div
              className="rounded-2xl border p-6 flex flex-col items-center justify-center gap-2 text-xs"
              style={{
                borderColor: cardBorderColor,
                background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                color: textSecondary,
              }}
            >
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
              <span>Carregando métodos de pagamento seguros do Stripe…</span>
            </div>
          )}
          <div
            ref={containerRef}
            className={elementReady ? "block" : "opacity-0 pointer-events-none h-0 overflow-hidden"}
          />
        </div>
      )}

      <div
        className="flex items-center justify-between pt-1 text-[11px]"
        style={{ color: textSecondary }}
      >
        <span className="flex items-center gap-1.5">
          <Lock className="w-3 h-3" style={{ color: accent }} />
          Pagamento criptografado e processado pelo Stripe
        </span>
      </div>
    </div>
  );
});

