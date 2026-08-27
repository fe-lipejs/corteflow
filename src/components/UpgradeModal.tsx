import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface UpgradeModalProps {
  feature?: string | boolean;
  onClose?: () => void;
  message?: string;
}

export function UpgradeModal({ feature, onClose, message }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // If a specific message is passed (e.g., from FeatureGate), use it.
  // Otherwise, use a default feature-based message.
  let displayMessage = message || '';
  if (!displayMessage) {
    if (typeof feature === 'string' && feature) {
      displayMessage = `A funcionalidade de ${feature} é exclusiva de planos superiores. Faça o upgrade para desbloquear o acesso total.`;
    } else {
      displayMessage = 'Este recurso é exclusivo de planos superiores. Faça o upgrade para desbloquear o acesso total.';
    }
  }

  const handleAction = () => {
    if (onClose) onClose();
    navigate('/admin/assinatura');
  };

  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="fixed inset-0 z-[35] md:pl-[250px] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-fade-in">
      <div 
        className="relative bg-white rounded-3xl p-8 max-w-[340px] w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.1)] border" 
        style={{ borderColor: theme.border, background: theme.cardBg }}
      >
        {/* Recommended Badge */}
        <div className="absolute top-0 right-0 bg-[#00c853] text-white text-[10px] font-bold px-4 py-1.5 rounded-tr-3xl rounded-bl-xl uppercase tracking-wider shadow-sm">
          Recomendado
        </div>

        {/* Title Block */}
        <div className="flex flex-col items-center justify-center gap-1 mt-3 mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
              Plano Studio
            </h3>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[13px] font-medium leading-relaxed mb-4 px-2" style={{ color: theme.textSecondary }}>
          7 dias grátis. Cancele quando quiser.
        </p>

        {/* Dynamic Context Message */}
        {displayMessage && (
          <div className="mb-6 p-3 rounded-xl border text-left" style={{ background: theme.bg, borderColor: theme.border }}>
            <p className="text-xs font-semibold leading-relaxed" style={{ color: theme.textPrimary }}>
              <span className="text-red-500 mr-1.5 font-bold">Bloqueado:</span>
              {displayMessage}
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAction}
          className="w-full py-3.5 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl font-bold transition-all transform active:scale-95 shadow-lg shadow-slate-900/20"
        >
          Assinar Agora (R$ 0,00 Hoje)
        </button>
        
        {/* Dismiss Link */}
        <button 
          onClick={handleDismiss}
          className="mt-5 text-[13px] font-medium hover:underline transition-colors"
          style={{ color: theme.textMuted }}
        >
          Pular para Visão Geral
        </button>
      </div>
    </div>
  );
}
