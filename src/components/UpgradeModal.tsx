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
        backdrop-blur-[5px]
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
          shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          backdrop-blur-2xl
        "
        style={{
          background: theme.id !== 'elegant' ? 'radial-gradient(130% 130% at 50% 0%, rgba(39, 39, 42, 0.9) 0%, rgba(9, 9, 11, 0.95) 100%)' : theme.cardBg,
          borderColor: theme.border,
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
            "
            style={{
              background: theme.id === 'elegant' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)'
            }}
          >
            <Check
              className="h-3 w-3"
              style={{
                color: theme.id === 'elegant' ? '#059669' : '#10b981'
              }}
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
            py-3.5
            text-[12px]
            font-bold
            shadow-lg
            transition-all
            hover:opacity-90
            active:scale-[0.97]
          "
          style={{
            background: theme.id !== 'elegant' ? '#FFFFFF' : '#0f172a',
            color: theme.id !== 'elegant' ? '#000000' : '#FFFFFF',
            boxShadow: theme.id !== 'elegant' ? '0 10px 30px rgba(255, 255, 255, 0.15)' : (theme.shadowAccent || '0 10px 25px rgba(15,23,42,0.16)')
          }}
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