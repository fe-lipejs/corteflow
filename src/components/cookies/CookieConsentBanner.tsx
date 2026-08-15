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
            <div className="bg-[#0f0f0f]/95 backdrop-blur-xl border border-[#2a2a2a] p-5 sm:p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#C9963B]/10 border border-[#C9963B]/20 flex items-center justify-center text-[#C9963B] shrink-0 mt-0.5">
                  <Cookie className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Privacidade e Cookies
                  </h4>
                  <p className="text-xs text-[#999] leading-relaxed">
                    Usamos cookies necessários para manter sua sessão segura e lembrar suas preferências de tema e idioma. Você pode aceitar todos ou personalizar seus consentimentos conforme a LGPD.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-semibold text-[#888] hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Preferências
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-[#333] hover:bg-[#1a1a1a] text-[#aaa] hover:text-white text-xs font-bold transition-all text-center"
                  >
                    Apenas Necessários
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#C9963B] hover:bg-[#d8a346] text-black text-xs font-bold transition-all shadow-md text-center"
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
