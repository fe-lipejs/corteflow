import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, CreditCard, Store, X, Loader2 } from 'lucide-react';
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
  const [selectedMode, setSelectedMode] = useState<'both' | 'online_only'>('both');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isLight = theme.id === 'elegant';
  const primaryBtnBg = theme.btnPrimaryBg || theme.accent;
  const primaryBtnText = theme.btnPrimaryText || '#FFFFFF';

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirmChoice(selectedMode === 'online_only');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const options: Array<{
    id: 'both' | 'online_only';
    title: string;
    subtitle: string;
    badge?: string;
    icon: typeof Store;
  }> = [
    {
      id: 'both',
      title: 'No local e online',
      subtitle: 'O cliente escolhe pagar no salão ou antecipar via Pix e cartão.',
      badge: 'Recomendado',
      icon: Store,
    },
    {
      id: 'online_only',
      title: 'Somente online',
      subtitle: 'Exige sinal ou valor total no Mercado Pago para confirmar.',
      icon: CreditCard,
    },
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md"
        onClick={() => {
          if (!loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[440px] rounded-[28px] border overflow-hidden"
          style={{
            background: theme.cardBg,
            borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.1)',
            color: theme.textPrimary,
            boxShadow: isLight
              ? '0 32px 70px -16px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.04)'
              : '0 36px 80px -16px rgba(0, 0, 0, 0.78), 0 0 0 1px rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Glow atmosférico sutil no topo */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-44"
            style={{
              background: `radial-gradient(ellipse 75% 65% at 50% 0%, ${theme.accent}22 0%, transparent 72%)`,
            }}
          />

          {/* Botão fechar minimalista */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40"
            style={{
              background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.07)',
              color: theme.textSecondary,
            }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Conteúdo principal */}
          <div className="relative z-10 px-6 sm:px-7 pt-8 pb-6 space-y-6">
            {/* Hero de conexão Raffros ⇄ Mercado Pago */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative flex items-center justify-center">
                {/* Linha gradiente contínua sob as logos */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-28 h-[1.5px]"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${theme.accent}66 50%, transparent 100%)`,
                  }}
                />

                <div className="relative flex items-center gap-3.5">
                  {/* Raffros App Icon */}
                  <div
                    className="w-[58px] h-[58px] rounded-[18px] overflow-hidden flex items-center justify-center bg-[#0B0B0D] shrink-0"
                    style={{
                      border: isLight
                        ? '1px solid rgba(15, 23, 42, 0.12)'
                        : '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow: isLight
                        ? '0 10px 24px -8px rgba(15, 23, 42, 0.22)'
                        : '0 12px 28px -8px rgba(0, 0, 0, 0.65)',
                    }}
                  >
                    <img
                      src="/icons/logo-raffros.png"
                      alt="Raffros"
                      className="w-full h-full object-cover select-none"
                    />
                  </div>

                  {/* Conector central ⇄ */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.08, duration: 0.25 }}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: theme.cardBg,
                      border: `1.5px solid ${theme.accent}45`,
                      color: theme.accent,
                      boxShadow: isLight
                        ? '0 4px 14px -2px rgba(15, 23, 42, 0.12)'
                        : '0 6px 18px -2px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.25]" />
                  </motion.div>

                  {/* Mercado Pago App Icon */}
                  <div
                    className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center bg-white shrink-0"
                    style={{
                      border: isLight
                        ? '1px solid rgba(15, 23, 42, 0.09)'
                        : '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow: isLight
                        ? '0 10px 24px -8px rgba(0, 158, 227, 0.24)'
                        : '0 12px 28px -8px rgba(0, 0, 0, 0.65)',
                    }}
                  >
                    <MercadoPagoMark className="w-10 h-7" />
                  </div>
                </div>
              </div>

              {/* Status pill + Título cirúrgico */}
              <div className="space-y-2">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: isLight ? 'rgba(16, 185, 129, 0.10)' : 'rgba(16, 185, 129, 0.14)',
                    color: isLight ? '#059669' : '#34D399',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Conexão ativa</span>
                </div>

                <h2
                  className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em] leading-tight"
                  style={{ color: theme.textPrimary }}
                >
                  Pagamentos online ativos
                </h2>

                <p
                  className="text-[13px] leading-relaxed max-w-[320px] mx-auto"
                  style={{ color: theme.textSecondary }}
                >
                  Sua conta do <strong style={{ color: theme.textPrimary }}>Mercado Pago</strong> já está pronta para receber Pix e cartão.
                </p>
              </div>
            </div>

            {/* Seletor minimalista de operação */}
            <div className="space-y-2.5">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.1em] px-1"
                style={{ color: theme.textMuted }}
              >
                Como seus clientes vão pagar?
              </p>

              <div className="space-y-2.5">
                {options.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedMode === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={loading}
                      onClick={() => setSelectedMode(opt.id)}
                      className="w-full p-4 rounded-2xl text-left transition-all duration-200 flex items-center gap-3.5 cursor-pointer disabled:opacity-60"
                      style={{
                        background: isSelected
                          ? `${theme.accent}${isLight ? '0c' : '14'}`
                          : isLight
                            ? '#F8FAFC'
                            : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected
                          ? `1.5px solid ${theme.accent}`
                          : `1.5px solid ${isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)'}`,
                        boxShadow: isSelected
                          ? `0 8px 22px -12px ${theme.accent}70`
                          : 'none',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          background: isSelected
                            ? `${theme.accent}${isLight ? '1a' : '26'}`
                            : isLight
                              ? 'rgba(15, 23, 42, 0.05)'
                              : 'rgba(255, 255, 255, 0.06)',
                          color: isSelected ? theme.accent : theme.textSecondary,
                        }}
                      >
                        <Icon className="w-[18px] h-[18px]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[13.5px] font-bold tracking-[-0.01em]"
                            style={{ color: theme.textPrimary }}
                          >
                            {opt.title}
                          </span>
                          {opt.badge && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: isSelected
                                  ? `${theme.accent}20`
                                  : isLight
                                    ? 'rgba(15, 23, 42, 0.06)'
                                    : 'rgba(255, 255, 255, 0.08)',
                                color: isSelected ? theme.accent : theme.textSecondary,
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs mt-0.5 leading-snug"
                          style={{ color: theme.textSecondary }}
                        >
                          {opt.subtitle}
                        </p>
                      </div>

                      {/* Indicador radio limpo estilo iOS / Spotify */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
                        style={{
                          border: isSelected
                            ? `5px solid ${theme.accent}`
                            : `1.5px solid ${isLight ? 'rgba(15, 23, 42, 0.22)' : 'rgba(255, 255, 255, 0.22)'}`,
                          background: isSelected ? '#FFFFFF' : 'transparent',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA principal + nota leve */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="w-full h-12 rounded-full font-bold text-sm tracking-[-0.01em] flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.985] cursor-pointer disabled:opacity-65"
                style={{
                  background: primaryBtnBg,
                  color: primaryBtnText,
                  boxShadow: `0 12px 26px -10px ${theme.accent}80`,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Confirmar e continuar</span>
                )}
              </button>

              <p
                className="text-center text-[11px]"
                style={{ color: theme.textMuted }}
              >
                Você pode alterar essa escolha quando quiser em Recebimentos.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
