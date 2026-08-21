import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGuide, TOUR_STEPS } from '../../contexts/GuideContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Compass, X, ChevronRight, ChevronLeft, Check, Sparkles, ExternalLink, Settings, Calendar, Scissors, Users } from 'lucide-react';

const STEP_ICONS = [
  <Settings className="w-4 h-4" />,
  <Calendar className="w-4 h-4" />,
  <Scissors className="w-4 h-4" />,
  <Users className="w-4 h-4" />,
];

export const SpotlightGuideTour: React.FC = () => {
  const {
    isTourActive,
    tourStep,
    showTourInvite,
    startTour,
    nextTourStep,
    prevTourStep,
    stopTour,
    dismissTourInvite,
  } = useGuide();

  const { theme } = useTheme();
  const navigate = useNavigate();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const currentStep = TOUR_STEPS[tourStep];

  // Update target rect dynamically
  useEffect(() => {
    if (!isTourActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    const interval = setInterval(updateRect, 300);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      clearInterval(interval);
    };
  }, [isTourActive, tourStep, currentStep]);

  // Navigate to screen if requested
  const handleGoToScreen = () => {
    if (tourStep === 0) navigate('/admin/configuracoes');
    if (tourStep === 1) navigate('/admin/agenda');
    if (tourStep === 2) navigate('/admin/servicos');
    if (tourStep === 3) navigate('/admin/equipe');
    stopTour();
  };

  return (
    <>
      {/* ─── 1. Convite Inicial Discreto (Toast) ─────────────────────────── */}
      <AnimatePresence>
        {showTourInvite && !isTourActive && (
          <div className="fixed z-[9999] bottom-6 right-4 sm:right-8 max-w-[92vw] sm:max-w-sm w-full pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="pointer-events-auto rounded-3xl p-5 shadow-2xl border relative overflow-hidden backdrop-blur-xl"
              style={{
                background: theme.cardBg,
                borderColor: `${theme.accent}40`,
                boxShadow: `0 20px 40px -10px rgba(0,0,0,0.45), 0 0 0 1px ${theme.accent}25`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.accent}, #a855f7, #ec4899)`,
                }}
              />

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm"
                    style={{
                      background: `${theme.accent}20`,
                      color: theme.accent,
                    }}
                  >
                    <Compass className="w-4 h-4 animate-spin-slow" />
                  </div>
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      background: `${theme.accent}18`,
                      color: theme.accent,
                      border: `1px solid ${theme.accent}30`,
                    }}
                  >
                    Tour Rápido
                  </span>
                </div>

                <button
                  type="button"
                  onClick={dismissTourInvite}
                  className="p-1 rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ color: theme.textMuted }}
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 my-2">
                <h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                  Quer um tour interativo de 30s? 👋
                </h4>
                <p className="text-xs leading-relaxed font-medium" style={{ color: theme.textSecondary }}>
                  Apresentamos os principais menus para você começar a faturar rapidamente.
                </p>
              </div>

              <div className="pt-3 mt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={dismissTourInvite}
                  className="text-xs font-semibold hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ color: theme.textMuted }}
                >
                  Agora não
                </button>

                <button
                  type="button"
                  onClick={startTour}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-105 active:scale-95"
                  style={{
                    background: theme.btnPrimaryBg || theme.accent,
                    color: theme.btnPrimaryText,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Iniciar Tour</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 2. Spotlight & Balão Ancorado com Seta Animada ───────────────── */}
      <AnimatePresence>
        {isTourActive && targetRect && (
          <div className="fixed inset-0 z-[99999] pointer-events-none">
            {/* Pulsing ring around target element */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute rounded-xl pointer-events-none transition-all duration-300"
              style={{
                top: Math.max(0, targetRect.top - 4),
                left: Math.max(0, targetRect.left - 4),
                width: targetRect.width + 8,
                height: targetRect.height + 8,
                border: `2px solid ${theme.accent}`,
                boxShadow: `0 0 0 4px ${theme.accent}35, 0 0 25px ${theme.accent}70`,
              }}
            />

            {/* Anchored Speech Bubble Card with Arrow (Estilo Referência) */}
            <motion.div
              key={tourStep}
              initial={{ opacity: 0, x: 20, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 15, scale: 0.94 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="absolute pointer-events-auto w-80 sm:w-[380px] rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border transition-all backdrop-blur-2xl"
              style={{
                top: Math.min(
                  window.innerHeight - 260,
                  Math.max(16, targetRect.top - 15)
                ),
                left: Math.min(
                  window.innerWidth - 410,
                  Math.max(16, targetRect.right + 20)
                ),
                background: theme.cardBg,
                borderColor: `${theme.accent}50`,
                boxShadow: `0 24px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px ${theme.accent}30`,
              }}
            >
              {/* Seta indicadora triangular apontando para o item lateral */}
              <div
                className="hidden sm:block absolute -left-2.5 top-7 w-5 h-5 transform rotate-45 border-l border-b"
                style={{
                  background: theme.cardBg,
                  borderColor: `${theme.accent}50`,
                }}
              />

              {/* Top Row: Gradient Icon + Badge + Close button */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  {/* Ícone Redondo em Gradiente */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
                    }}
                  >
                    {STEP_ICONS[tourStep] || <Sparkles className="w-4 h-4" />}
                  </div>

                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white shadow-sm"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    }}
                  >
                    {currentStep.badge}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={stopTour}
                  className="p-1 rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ color: theme.textMuted }}
                  title="Fechar tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5 my-3">
                <h4 className="text-base font-bold leading-tight" style={{ color: theme.textPrimary }}>
                  {currentStep.title}
                </h4>
                <p className="text-xs sm:text-sm leading-relaxed font-medium" style={{ color: theme.textSecondary }}>
                  {currentStep.description}
                </p>
              </div>

              {/* Footer: Pagination Dots & Action Buttons */}
              <div className="pt-3.5 mt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: theme.border }}>
                {/* Dots Pagination (● ○ ○ ○) */}
                <div className="flex items-center gap-1.5">
                  {TOUR_STEPS.map((_, idx) => (
                    <motion.div
                      key={idx}
                      className="h-2 rounded-full transition-all"
                      animate={{
                        width: idx === tourStep ? 18 : 6,
                        backgroundColor: idx === tourStep ? theme.accent : theme.border,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  ))}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-2">
                  {tourStep > 0 && (
                    <button
                      type="button"
                      onClick={prevTourStep}
                      className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-80 transition-opacity cursor-pointer"
                      style={{ borderColor: theme.border, color: theme.textSecondary }}
                    >
                      Anterior
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={nextTourStep}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-105 active:scale-95"
                    style={{
                      background: theme.btnPrimaryBg || theme.accent,
                      color: theme.btnPrimaryText,
                    }}
                  >
                    {tourStep === TOUR_STEPS.length - 1 ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Concluir</span>
                      </>
                    ) : (
                      <>
                        <span>Próximo</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

