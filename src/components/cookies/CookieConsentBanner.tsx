import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, SlidersHorizontal } from 'lucide-react';
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
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    if (!isLandingPage) {
      setShowBanner(false);
      return;
    }
    const stored = getStoredCookiePreferences();
    if (stored) {
      setPreferences(stored);
      setShowBanner(false);
    } else {
      // Delay suave para entrada premium sem assustar o visitante
      const timer = setTimeout(() => setShowBanner(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isLandingPage]);

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

  if (!isLandingPage) {
    return null;
  }

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
                background: '#18181D',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75)',
              }}
            >
              {/* Brilho neon magenta de fundo sutil */}
              <div
                aria-hidden="true"
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 30, 138, 0.28), transparent 70%)',
                  filter: 'blur(35px)',
                }}
              />

              <div className="flex items-start gap-3.5 relative z-10">
                {/* Ícone de Cookie Estilizado */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 30, 138, 0.22), rgba(255, 30, 138, 0.08))',
                    border: '1px solid rgba(255, 30, 138, 0.40)',
                    color: '#FF1E8A',
                    boxShadow: '0 0 20px rgba(255, 30, 138, 0.20)',
                  }}
                >
                  <Cookie className="w-5 h-5" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em]"
                      style={{ color: '#FF1E8A' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF1E8A] shadow-[0_0_8px_#FF1E8A]" />
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
                  className="px-3.5 py-2 rounded-full text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 hover:border-white/20"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF1E8A]" />
                  Preferências
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all text-center cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Apenas Necessários
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex-1 sm:flex-initial h-10 px-5 sm:px-6 rounded-full bg-[#FF1E8A] hover:bg-[#E01177] text-white text-xs font-black tracking-tight transition-all text-center cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
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
