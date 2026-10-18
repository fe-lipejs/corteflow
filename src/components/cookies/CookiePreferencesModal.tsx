import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Cookie, Sliders, Check } from 'lucide-react';

export interface CookiePreferences {
  necessary: boolean; // Always true
  preferences: boolean; // Visual theme, UI choices
  statistics: boolean; // Usage metrics, performance
  timestamp: string;
}

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: CookiePreferences) => void;
  currentPreferences?: CookiePreferences | null;
}

export default function CookiePreferencesModal({
  isOpen,
  onClose,
  onSave,
  currentPreferences,
}: CookiePreferencesModalProps) {
  const [preferences, setPreferences] = useState(
    currentPreferences?.preferences ?? true
  );
  const [statistics, setStatistics] = useState(
    currentPreferences?.statistics ?? true
  );

  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences.preferences);
      setStatistics(currentPreferences.statistics);
    }
  }, [currentPreferences]);

  const handleSaveCustom = () => {
    onSave({
      necessary: true,
      preferences,
      statistics,
      timestamp: new Date().toISOString(),
    });
    onClose();
  };

  const handleAcceptAll = () => {
    onSave({
      necessary: true,
      preferences: true,
      statistics: true,
      timestamp: new Date().toISOString(),
    });
    onClose();
  };

  const handleRejectNonEssential = () => {
    onSave({
      necessary: true,
      preferences: false,
      statistics: false,
      timestamp: new Date().toISOString(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#040E20]/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] text-white relative"
          style={{
            background: 'linear-gradient(160deg, #041033 0%, #071F63 45%, #0B329B 80%, #1249D6 100%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 40px 100px rgba(0, 0, 0, 0.70), 0 0 50px rgba(252, 118, 29, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          }}
        >
          {/* Header */}
          <div
            className="p-6 border-b flex items-center justify-between"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.10)',
            }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(252, 118, 29, 0.25), rgba(255, 135, 56, 0.10))',
                  border: '1px solid rgba(255, 135, 56, 0.35)',
                  color: '#FF8738',
                  boxShadow: '0 0 20px rgba(252, 118, 29, 0.25)',
                }}
              >
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Preferências de Cookies
                </h3>
                <p className="text-xs text-white/60">
                  Transparência e total conformidade com a LGPD &amp; GDPR
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-none text-xs text-white/75">
            <p className="leading-relaxed text-white/80">
              Utilizamos cookies e armazenamento local para garantir o funcionamento seguro da plataforma, memorizar suas preferências e aprimorar a sua experiência. Você pode personalizar suas escolhas abaixo.
            </p>

            {/* Categoria 1: Necessários */}
            <div
              className="p-4.5 rounded-2xl space-y-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold text-white text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Estritamente Necessários</span>
                </div>
                <span
                  className="text-[10px] uppercase font-extrabold px-3 py-1 rounded-full text-emerald-400"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.30)',
                  }}
                >
                  Sempre Ativo
                </span>
              </div>
              <p className="text-white/60 leading-relaxed text-xs">
                Essenciais para a segurança, autenticação de sessão no Supabase e integridade dos agendamentos. Sem eles, o sistema não funciona.
              </p>
            </div>

            {/* Categoria 2: Preferências */}
            <div
              className="p-4.5 rounded-2xl space-y-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold text-white text-sm">
                  <Sliders className="w-4 h-4 text-[#FF8738]" />
                  <span>Preferências de Interface</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences}
                    onChange={(e) => setPreferences(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#FC761D]"></div>
                </label>
              </div>
              <p className="text-white/60 leading-relaxed text-xs">
                Lembram seu idioma de navegação (Português, Inglês, Francês, etc.) e preferências visuais.
              </p>
            </div>

            {/* Categoria 3: Estatísticas & Desempenho */}
            <div
              className="p-4.5 rounded-2xl space-y-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold text-white text-sm">
                  <Cookie className="w-4 h-4 text-[#FF8738]" />
                  <span>Estatísticas &amp; Desempenho</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statistics}
                    onChange={(e) => setStatistics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#FC761D]"></div>
                </label>
              </div>
              <p className="text-white/60 leading-relaxed text-xs">
                Ajudam a mensurar a velocidade de carregamento e estabilidade técnica da plataforma.
              </p>
            </div>
          </div>

          {/* Footer Actions — Pill Buttons estilo Landing Page */}
          <div
            className="p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{
              background: 'rgba(11, 41, 88, 0.85)',
              borderColor: 'rgba(255, 255, 255, 0.10)',
            }}
          >
            <button
              type="button"
              onClick={handleRejectNonEssential}
              className="w-full sm:w-auto h-10 px-5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all text-center cursor-pointer"
            >
              Rejeitar Não Essenciais
            </button>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveCustom}
                className="flex-1 sm:flex-initial h-10 px-5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
              >
                Salvar Escolhas
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-initial h-10 px-6 rounded-full bg-[#FC761D] hover:bg-[#FF8738] text-white text-xs font-black tracking-tight transition-all shadow-[0_8px_24px_rgba(255,135,56,0.38)] hover:shadow-[0_12px_28px_rgba(255,135,56,0.50)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
