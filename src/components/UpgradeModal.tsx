import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface UpgradeModalProps {
  feature?: string | boolean;
  onClose?: () => void;
  message?: string;
}

export function UpgradeModal({
  feature,
  onClose,
  message,
}: UpgradeModalProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const featureName =
    typeof feature === 'string' && feature
      ? feature
      : 'este recurso';

  const handleAction = () => {
    onClose?.();
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
    <div
      className="
        fixed inset-0 z-[35]
        md:pl-[250px]
        flex items-center justify-center
        p-4
        bg-black/70
        backdrop-blur-[0px]
        animate-fade-in
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="
          relative
          w-full
          max-w-[330px]
          rounded-3xl
          border
          p-7
          text-center
          shadow-[0_20px_50px_rgba(0,0,0,0.1)]
        "
        style={{
          borderColor: theme.border,
          background: theme.cardBg,
        }}
      >
        {/* Badge */}
        <div
          className="
            absolute
            top-0
            right-0
            bg-[#00c853]
            text-white
            text-[9px]
            font-bold
            px-4
            py-1.5
            rounded-tr-3xl
            rounded-bl-xl
            uppercase
            tracking-wider
          "
        >
          Recomendado
        </div>

        {/* Plano */}
        <div className="mt-1 flex items-center justify-center gap-2">
          <Star
            className="h-5 w-5 fill-amber-500 text-amber-500"
          />

          <h3
            id="upgrade-modal-title"
            className="text-[22px] font-bold tracking-tight"
            style={{
              color: theme.textPrimary,
            }}
          >
            Plano Studio
          </h3>
        </div>

        {/* Headline */}
        <h4
          className="
            mt-4
            text-[16px]
            font-bold
            tracking-[-0.02em]
          "
          style={{
            color: theme.textPrimary,
          }}
        >
          Seu negócio, sem limitações.
        </h4>

        {/* Contexto */}
        <p
          className="
            mt-2
            px-3
            text-[11px]
            leading-[17px]
          "
          style={{
            color: theme.textSecondary,
          }}
        >
          Libere {featureName} e aproveite a experiência
          completa do Raffros.
        </p>

        {/* Trial */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <div
            className="
              flex
              h-5
              w-5
              items-center
              justify-center
              rounded-full
              bg-emerald-50
            "
          >
            <Check
              className="h-3 w-3 text-emerald-600"
              strokeWidth={2.8}
            />
          </div>

          <span
            className="text-[11px] font-semibold"
            style={{
              color: theme.textPrimary,
            }}
          >
            7 dias grátis
          </span>
        </div>

        {/* Preço */}
        <div className="mt-4">
          <div className="flex items-baseline justify-center gap-1">
            <span
              className="
                text-[26px]
                font-bold
                tracking-[-0.04em]
              "
              style={{
                color: theme.textPrimary,
              }}
            >
              R$ 0,00
            </span>

            <span
              className="text-[10px]"
              style={{
                color: theme.textSecondary,
              }}
            >
              hoje
            </span>
          </div>


        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleAction}
          className="
            mt-4
            w-full
            rounded-xl
            bg-[#0f172a]
            py-3.5
            text-[12px]
            font-bold
            text-white
            shadow-lg
            shadow-slate-900/20
            transition-all
            hover:bg-[#1e293b]
            active:scale-[0.97]
          "
        >
          Experimentar gratuitamente
        </button>

        {/* Segurança */}
        <p
          className="mt-2 text-[9px]"
          style={{
            color: theme.textMuted,
          }}
        >
        </p>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="
            mt-3
            text-[14px]
            font-medium
            hover:underline
          "
          style={{
            color: theme.textMuted,
          }}
        >
          Continuar por enquanto
        </button>
      </div>
    </div>
  );
}