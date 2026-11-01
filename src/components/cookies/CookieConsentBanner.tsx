import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, SlidersHorizontal, ArrowRight, Check } from 'lucide-react';
import CookiePreferencesModal, { type CookiePreferences } from './CookiePreferencesModal';

const STORAGE_KEY = 'navalha_cookie_preferences_v1';

export function getStoredCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCookiePreferences(prefs: CookiePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Could not save cookie preferences:', e);
  }
}

export default function CookieConsentBanner() {
  const [hasChecked, setHasChecked] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const stored = getStoredCookiePreferences();
    if (stored) {
      setPreferences(stored);
      setShowBanner(false);
    } else {
      // Delay suave para entrada premium sem assustar o visitante
      const timer = setTimeout(() => setShowBanner(true), 1200);
      return () => clearTimeout(timer);
    }
    setHasChecked(true);
  }, []);

  const handleAcceptAll = () => {
    const all: CookiePreferences = {
      necessary: true,
      preferences: true,
      statistics: true,
      timestamp: new Date().toISOString(),
    };
    saveCookiePreferences(all);
    setPreferences(all);
    setShowBanner(false);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly: CookiePreferences = {
      necessary: true,
      preferences: false,
      statistics: false,
      timestamp: new Date().toISOString(),
    };
    saveCookiePreferences(essentialOnly);
    setPreferences(essentialOnly);
    setShowBanner(false);
  };

  const handleSaveFromModal = (prefs: CookiePreferences) => {
    saveCookiePreferences(prefs);
    setPreferences(prefs);
    setShowBanner(false);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed bottom-4 inset-x-4 sm:left-6 sm:bottom-6 sm:right-auto sm:max-w-xl z-50 pointer-events-auto"
          >
            <div
              className="p-5 sm:p-6 rounded-[28px] text-white space-y-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(18, 108, 153, 0.94) 0%, rgba(18, 108, 153, 0.90) 50%, rgba(18, 108, 153, 0.85) 100%)',
                backdropFilter: 'blur(28px) saturate(190%)',
                WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                boxShadow: '0 30px 80px rgba(4, 18, 48, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              }}
            >
              {/* Brilho âmbar de fundo sutil */}
              <div
                aria-hidden="true"
                className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 149, 186, 0.20), transparent 70%)',
                  filter: 'blur(35px)',
                }}
              />

              <div className="flex items-start gap-3.5 relative z-10">
                {/* Ícone de Cookie Estilizado */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 149, 186, 0.25), rgba(255, 149, 186, 0.10))',
                    border: '1px solid rgba(255, 149, 186, 0.35)',
                    color: '#FF95BA',
                    boxShadow: 'none',
                  }}
                >
                  <Cookie className="w-5 h-5" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em]"
                      style={{ color: '#FF95BA' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF95BA]" />
                      Privacidade &amp; LGPD
                    </span>
                  </div>

                  <h4 className="text-[15px] sm:text-base font-extrabold text-white tracking-[-0.025em] leading-tight">
                    Controle de Cookies e Privacidade
                  </h4>

                  <p className="text-xs sm:text-[13px] text-white/75 leading-relaxed font-normal">
                    Usamos cookies necessários para manter sua sessão segura e lembrar suas preferências de idioma e tema. Seus dados estão protegidos de acordo com a LGPD.
                  </p>
                </div>
              </div>

              {/* Linha de Ações: Pill Buttons na mesma pegada da Landing Page */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 relative z-10">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="px-3.5 py-2 rounded-full text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 hover:border-white/20"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF95BA]" />
                  Preferências
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all text-center cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Apenas Necessários
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex-1 sm:flex-initial h-10 px-5 sm:px-6 rounded-full bg-[#FF95BA] hover:bg-[#FF95BA] text-black text-xs font-black tracking-tight transition-all text-center cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Aceitar Todos
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Preferências */}
      <CookiePreferencesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveFromModal}
        currentPreferences={preferences}
      />
    </>
  );
}
