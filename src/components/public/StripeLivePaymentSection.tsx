import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Loader2,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  X,
} from "lucide-react";
import { supabase } from "../../integrations/supabase/client";

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
      checkoutUrl?: string | null;
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
  publishableKey?: string | null;
  stripeAccountId?: string | null;
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
    amountBRL,
    amountDueBRL,
    paymentScopeLabel,
    storeName,
    storeLogoUrl,
    serviceName,
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
  const [selectedTab, setSelectedTab] = useState<"pix" | "card">("pix");

  // Estado do Modal PIX Personalizado (QR Code nativo do Mercado Pago)
  const [activePixModal, setActivePixModal] = useState<ActivePixModalState | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [checkingPixNow, setCheckingPixNow] = useState(false);
  const [pixCheckFeedback, setPixCheckFeedback] = useState<string | null>(null);

  const handleSelectTab = (tab: "pix" | "card") => {
    setSelectedTab(tab);
    onPaymentMethodChange?.(tab);
  };

  // Polling automático a cada 2.5s enquanto modal PIX está aberto
  const startPixPolling = (modalState: ActivePixModalState) => {
    let stopped = false;
    let inFlight = false;
    const { bookingId, paymentIntentId, orderNumber, resolve } = modalState;

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
          cleanup();
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

    const intervalId = window.setInterval(checkStatus, 2500);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkStatus();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const cleanup = () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };

    checkStatus();
    return cleanup;
  };

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
          "Pagamento ainda pendente no Mercado Pago. Conclua o PIX no aplicativo do seu banco; assim que compensar, a confirmação é automática."
        );
      }
    } catch {
      setPixCheckFeedback("Verificando pagamento com o Mercado Pago... Aguarde alguns segundos.");
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

      if (data?.confirmed) {
        resolve({
          status: "succeeded",
          paymentIntentId,
          bookingId,
          orderNumber: data.order_number || orderNumber,
        });
        return;
      }
    } catch (_) {}

    reject(
      new Error(
        "Pagamento PIX cancelado. Toque novamente no botão abaixo quando quiser gerar um novo QR Code PIX."
      )
    );
  };

  const handleCopyPixCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedPix(true);
      window.setTimeout(() => setCopiedPix(false), 3500);
    } catch {
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
    async submitAndConfirm({ createIntent }) {
      // ── FLUXO 1: PIX TRANSPARENTE (QR CODE MERCADO PAGO NA TELA) ───────────
      if (selectedTab === "pix") {
        const { clientSecret, paymentIntentId, bookingId, orderNumber, pixQrData, checkoutUrl } =
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
            let stopPolling: (() => void) | null = null;
            const modalState: ActivePixModalState = {
              bookingId,
              orderNumber,
              paymentIntentId,
              clientSecret,
              qrData: pixQrData,
              resolve: (res) => {
                stopPolling?.();
                resolve(res);
              },
              reject: (err) => {
                stopPolling?.();
                reject(err);
              },
            };
            setActivePixModal(modalState);
            stopPolling = startPixPolling(modalState);
          });
        }

        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          return { status: "redirecting", paymentIntentId, bookingId, orderNumber };
        }

        throw new Error("Não foi possível gerar o QR Code PIX no Mercado Pago.");
      }

      // ── FLUXO 2: CARTÃO DE CRÉDITO VIA CHECKOUT SEGURO DO MERCADO PAGO ──────
      const { paymentIntentId, bookingId, orderNumber, checkoutUrl } = await createIntent("card");

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return { status: "redirecting", paymentIntentId, bookingId, orderNumber };
      }

      throw new Error("Não foi possível abrir o checkout de cartão no Mercado Pago.");
    },
  }));

  return (
    <div className="space-y-3">
      {/* Seletor Minimalista: PIX vs Cartão de Crédito */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => handleSelectTab("pix")}
          className="relative flex items-center justify-center gap-2.5 h-12 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          style={{
            borderColor: selectedTab === "pix" ? accent : cardBorderColor,
            background: selectedTab === "pix" ? `${accent}0d` : "transparent",
            boxShadow: selectedTab === "pix" ? `0 0 0 1px ${accent}` : "none",
            color: selectedTab === "pix" ? accent : textPrimary,
          }}
        >
          <PixOfficialIcon
            className="w-5 h-5 shrink-0 transition-transform"
            style={{ color: selectedTab === "pix" ? accent : textSecondary }}
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
            background: selectedTab === "card" ? `${accent}0d` : "transparent",
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

      {/* ── MODAL PIX ULTRA-MINIMALISTA (SEM SCROLL) ── */}
      {activePixModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={handleCancelPixModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

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

              {/* QR Code */}
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

              {/* Código PIX */}
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
