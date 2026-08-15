import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, CreditCard, Store, ShieldCheck, X } from 'lucide-react';

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
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-white relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 p-2 text-[#666] hover:text-white rounded-xl transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header with celebration banner */}
          <div className="p-6 sm:p-8 pb-4 text-center space-y-3 relative overflow-hidden">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
                Conta Conectada
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Pagamentos Online Ativados! 🎉
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-[#aaa] max-w-md mx-auto leading-relaxed">
              Sua conta Stripe foi configurada com sucesso e os pagamentos online (entrada ou 100% antecipado) já estão liberados para seus clientes.
            </p>
          </div>

          {/* Highlight card & Choice */}
          <div className="px-6 sm:px-8 py-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#151515] border border-[#262626] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ddd]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>O pagamento no local também continua habilitado.</span>
              </div>
              <p className="text-xs text-[#888] leading-relaxed">
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
                className="w-full p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all group flex items-start justify-between gap-3 shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-emerald-400 group-hover:text-emerald-300">
                      Manter pagamento no local e online
                    </h4>
                    <p className="text-[11px] text-emerald-200/70 mt-0.5">
                      O cliente pode escolher entre pagar no salão ou antecipar online.
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
              </button>

              {/* Option 2: Disable local (Online only) */}
              <button
                type="button"
                onClick={() => handleChoice(true)}
                disabled={loading}
                className="w-full p-4 rounded-2xl border border-[#333] hover:border-[#555] bg-[#141414] hover:bg-[#1a1a1a] text-left transition-all group flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#222] text-[#aaa] group-hover:text-white mt-0.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-white">
                      Desativar pagamento no local
                    </h4>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      Exigir sempre pagamento online (sinal ou total) para confirmar a reserva.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="p-4 sm:px-8 bg-[#0a0a0a] border-t border-[#1f1f1f] text-center text-[11px] text-[#666]">
            Você pode alterar essas opções a qualquer momento nesta aba.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
