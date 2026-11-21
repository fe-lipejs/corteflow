import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Check, CreditCard, Store, ShieldCheck, X, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { MercadoPagoMark } from '../icons/MercadoPagoLogo';

interface StripeActivatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmChoice: (disableLocal: boolean) => Promise<void>;
}

export default function StripeActivatedModal({
  isOpen,
  onClose,
  onConfirmChoice,
}: StripeActivatedModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChoice = async (disableLocal: boolean) => {
    setLoading(true);
    try {
      await onConfirmChoice(disableLocal);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
          style={{
            background: theme.cardBg,
            borderColor: theme.border,
            color: theme.textPrimary,
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="absolute top-4 right-4 p-2 rounded-xl transition-opacity hover:opacity-75 cursor-pointer z-10"
            style={{ color: theme.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header with celebration banner */}
          <div className="p-6 sm:p-8 pb-4 text-center space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-center gap-2.5 mx-auto">
              <div
                className="w-14 h-14 rounded-2xl border overflow-hidden flex items-center justify-center shadow-md shrink-0 bg-black"
                style={{ borderColor: theme.border }}
              >
                <img
                  src="/icons/logo-raffros.png"
                  alt="Raffros"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center">
                <div className="w-4 h-px border-t border-dashed" style={{ borderColor: theme.border }} />
                <div
                  className="w-7 h-7 rounded-full border flex items-center justify-center shadow-sm"
                  style={{
                    background: `${theme.accent}18`,
                    borderColor: `${theme.accent}45`,
                    color: theme.accent,
                  }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div className="w-4 h-px border-t border-dashed" style={{ borderColor: theme.border }} />
              </div>

              <div
                className="w-14 h-14 rounded-2xl border flex items-center justify-center shadow-md shrink-0"
                style={{
                  background: '#009EE318',
                  borderColor: '#009EE340',
                }}
              >
                <MercadoPagoMark className="w-10 h-7" />
              </div>
            </div>

            <div className="space-y-1">
              <span
                className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border inline-block"
                style={{
                  background: `${theme.accent}12`,
                  borderColor: `${theme.accent}25`,
                  color: theme.accent,
                }}
              >
                Conta Conectada
              </span>
              <h2
                className="text-xl sm:text-2xl font-black tracking-tight"
                style={{ color: theme.textPrimary }}
              >
                Pagamentos Online Ativados! 🎉
              </h2>
            </div>

            <p
              className="text-xs sm:text-sm max-w-md mx-auto leading-relaxed"
              style={{ color: theme.textSecondary }}
            >
              Sua conta do <strong style={{ color: theme.textPrimary }}>Mercado Pago</strong> foi conectada com sucesso e os pagamentos online (Pix e cartão — entrada ou 100% antecipado) já estão liberados para seus clientes.
            </p>
          </div>

          {/* Highlight card & Choice */}
          <div className="px-6 sm:px-8 py-4 space-y-4">
            <div
              className="p-4 rounded-2xl border space-y-2"
              style={{
                background: theme.inputBg,
                borderColor: theme.border,
              }}
            >
              <div
                className="flex items-center gap-2 text-xs font-bold"
                style={{ color: theme.textPrimary }}
              >
                <ShieldCheck
                  className="w-4 h-4 shrink-0"
                  style={{ color: theme.accent }}
                />
                <span>O pagamento no local também continua habilitado.</span>
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: theme.textSecondary }}
              >
                Como você deseja operar seus agendamentos a partir de agora?
              </p>
            </div>

            {/* Action Options */}
            <div className="space-y-3 pt-1">
              {/* Option 1: Keep local enabled */}
              <button
                type="button"
                onClick={() => handleChoice(false)}
                disabled={loading}
                className="w-full p-4 rounded-2xl border text-left transition-all group flex items-start justify-between gap-3 shadow-md cursor-pointer hover:opacity-95 disabled:opacity-60"
                style={{
                  borderColor: `${theme.accent}60`,
                  background: `${theme.accent}12`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2 rounded-xl mt-0.5 shrink-0"
                    style={{
                      background: `${theme.accent}20`,
                      color: theme.accent,
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Store className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4
                      className="text-xs sm:text-sm font-bold"
                      style={{ color: theme.accent }}
                    >
                      Manter pagamento no local e online
                    </h4>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: theme.textSecondary }}
                    >
                      O cliente pode escolher entre pagar no salão ou antecipar online.
                    </p>
                  </div>
                </div>
                <CheckCircle2
                  className="w-5 h-5 shrink-0 mt-1"
                  style={{ color: theme.accent }}
                />
              </button>

              {/* Option 2: Disable local (Online only) */}
              <button
                type="button"
                onClick={() => handleChoice(true)}
                disabled={loading}
                className="w-full p-4 rounded-2xl border text-left transition-all group flex items-start justify-between gap-3 cursor-pointer hover:opacity-90 disabled:opacity-60"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2 rounded-xl mt-0.5 shrink-0"
                    style={{
                      background: `${theme.accent}10`,
                      color: theme.textSecondary,
                    }}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4
                      className="text-xs sm:text-sm font-bold"
                      style={{ color: theme.textPrimary }}
                    >
                      Desativar pagamento no local
                    </h4>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: theme.textSecondary }}
                    >
                      Exigir sempre pagamento online (sinal ou total) para confirmar a reserva.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div
            className="p-4 sm:px-8 border-t text-center text-[11px]"
            style={{
              background: theme.inputBg,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            Você pode alterar essas opções a qualquer momento nesta aba.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
