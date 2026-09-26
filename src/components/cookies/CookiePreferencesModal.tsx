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
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0A0A0A] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-white"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF9D2E]/10 border border-[#FF9D2E]/20 flex items-center justify-center text-[#FF9D2E] shadow-sm">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Preferências de Cookies</h3>
                <p className="text-xs text-zinc-400">Transparência e conformidade com a LGPD & GDPR</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-none text-xs text-zinc-400">
            <p className="leading-relaxed">
              Utilizamos cookies e armazenamento local estritamente necessários para permitir o funcionamento da autenticação e das reservas, além de preferências para aprimorar sua experiência. Você pode personalizar suas escolhas abaixo.
            </p>

            {/* Category 1: Necessários */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Estritamente Necessários</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Sempre Ativo
                </span>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Essenciais para a segurança, login autenticado no Supabase e integridade dos agendamentos. Sem eles, o sistema não funciona.
              </p>
            </div>

            {/* Category 2: Preferências */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Sliders className="w-4 h-4 text-[#FF9D2E]" />
                  <span>Preferências de Interface</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences}
                    onChange={(e) => setPreferences(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF9D2E]"></div>
                </label>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Lembram seu idioma de navegação (Português, Inglês, Francês, etc.) e tema escuro/claro escolhido.
              </p>
            </div>

            {/* Category 3: Estatísticas & Desempenho */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Cookie className="w-4 h-4 text-[#FF9D2E]" />
                  <span>Estatísticas & Desempenho</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statistics}
                    onChange={(e) => setStatistics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF9D2E]"></div>
                </label>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Ajudam a mensurar a velocidade de carregamento e estabilidade técnica da plataforma.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/5 bg-[#050505] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRejectNonEssential}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-semibold transition-all text-center cursor-pointer"
            >
              Rejeitar Não Essenciais
            </button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveCustom}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                Salvar Escolhas
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#FF9D2E] hover:bg-[#e68d29] text-black text-xs font-bold transition-all shadow-md shadow-[#FF9D2E]/25 hover:shadow-lg hover:shadow-[#FF9D2E]/30 cursor-pointer"
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

