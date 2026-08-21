import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, SlidersHorizontal } from 'lucide-react';
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
      // Delay slightly for smooth page entry
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
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-4 inset-x-4 sm:left-6 sm:right-auto sm:max-w-xl z-50 pointer-events-auto"
          >
            <div className="bg-white/95 backdrop-blur-xl border border-[#E2E8F0] p-5 sm:p-6 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] text-[#0F172A] space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#DE870D]/10 border border-[#DE870D]/20 flex items-center justify-center text-[#DE870D] shrink-0 mt-0.5 shadow-sm">
                  <Cookie className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    Privacidade e Cookies
                  </h4>
                  <p className="text-xs text-[#475569] leading-relaxed font-normal">
                    Usamos cookies necessários para manter sua sessão segura e lembrar suas preferências de tema e idioma. Você pode aceitar todos ou personalizar seus consentimentos conforme a LGPD.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Preferências
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] text-xs font-bold transition-all text-center cursor-pointer shadow-sm"
                  >
                    Apenas Necessários
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#DE870D] hover:bg-[#C77507] text-white text-xs font-bold transition-all shadow-md shadow-[#DE870D]/25 hover:shadow-lg hover:shadow-[#DE870D]/30 text-center cursor-pointer"
                  >
                    Aceitar Todos
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preferences Modal (Can be triggered via banner or footer link) */}
      <CookiePreferencesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveFromModal}
        currentPreferences={preferences}
      />
    </>
  );
}

