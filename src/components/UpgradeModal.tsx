import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Check, AlertTriangle, Clock, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { PERMISSION_UPGRADE_MESSAGES } from '../constants/permissionsDictionary';
import { usePermissionEngine } from '../hooks/usePermissionEngine';

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
  const engine = usePermissionEngine();

  const featureKey = typeof feature === 'string' ? feature : '';
  const friendlyName = PERMISSION_UPGRADE_MESSAGES[featureKey] || featureKey || 'este recurso';

  const subStatus = engine.subscriptionStatus;

  // Determina conteúdo contextual baseado no status real da assinatura
  let badgeText = 'Recomendado';
  let badgeBg = '#00c853';
  let IconComponent: any = Star;
  let iconColor = '#f59e0b';
  let titleText = 'Plano Studio';
  let headlineText = 'Seu negócio, sem limitações.';
  let displayMessage: React.ReactNode = message;
  let ctaText = 'Experimentar gratuitamente';
  let showTrialPerk = false;
  let showPrice = false;

  if (subStatus === 'canceled') {
    badgeText = 'Assinatura Cancelada';
    badgeBg = '#ef4444';
    IconComponent = ShieldAlert;
    iconColor = '#ef4444';
    titleText = 'Acesso Interrompido';
    headlineText = 'Sua assinatura foi cancelada.';
    displayMessage = message || 'Sua assinatura anterior foi cancelada e o acesso às ferramentas de gestão foi interrompido. Para reativar seu salão agora mesmo, escolha um dos nossos planos.';
    ctaText = 'Reativar Minha Assinatura';
    showTrialPerk = false;
    showPrice = false;
  } else if (subStatus === 'trial_expired') {
    badgeText = 'Teste Concluído';
    badgeBg = '#f59e0b';
    IconComponent = Clock;
    iconColor = '#f59e0b';
    titleText = 'Período de Teste Finalizado';
    headlineText = 'Seus 7 dias grátis chegaram ao fim.';
    displayMessage = message || 'Esperamos que você tenha gostado da plataforma! Para continuar utilizando a agenda, equipe, clientes e financeiro sem restrições, assine um plano.';
    ctaText = 'Escolher um Plano';
    showTrialPerk = false;
    showPrice = false;
  } else if (subStatus === 'past_due' || subStatus === 'unpaid') {
    badgeText = 'Fatura Pendente';
    badgeBg = '#f43f5e';
    IconComponent = AlertTriangle;
    iconColor = '#f43f5e';
    titleText = 'Pagamento Pendente';
    headlineText = 'Regularize sua assinatura.';
    displayMessage = message || 'Identificamos uma pendência no processamento do pagamento da sua assinatura. Regularize para desbloquear o acesso imediato ao seu painel.';
    ctaText = 'Regularizar Fatura';
    showTrialPerk = false;
    showPrice = false;
  } else if (subStatus === 'no_subscription') {
    badgeText = 'Ativação Necessária';
    badgeBg = '#3b82f6';
    IconComponent = Sparkles;
    iconColor = '#3b82f6';
    titleText = 'Ative seu Salão';
    headlineText = 'Escolha um plano para começar.';
    displayMessage = message || 'Você ainda não possui uma assinatura vinculada. Selecione um plano para liberar todos os recursos do sistema.';
    ctaText = 'Ver Planos Disponíveis';
    showTrialPerk = false;
    showPrice = false;
  } else if (featureKey.startsWith('limit.')) {
    const limitType = featureKey.split('.')[1];
    const limitValue = engine.getPlanLimit(limitType);
    badgeText = 'Limite Atingido';
    badgeBg = '#f59e0b';
    IconComponent = Star;
    iconColor = '#f59e0b';
    titleText = 'Capacidade do Plano';
    headlineText = 'Seu negócio está crescendo!';
    ctaText = 'Fazer Upgrade de Plano';
    showTrialPerk = false;
    showPrice = false;

    if (!message && limitValue !== 'unlimited') {
      const singular: Record<string, string> = { profissionais: 'profissional', servicos: 'serviço', produtos: 'produto' };
      const plural: Record<string, string> = { profissionais: 'profissionais', servicos: 'serviços', produtos: 'produtos' };
      const itemName = limitValue === 1 ? (singular[limitType] || limitType) : (plural[limitType] || limitType);
      
      displayMessage = (
        <>
          Você atingiu o limite de <span className="font-bold" style={{ color: theme.textPrimary }}>{limitValue} {itemName}</span> do seu plano atual. Faça o upgrade para expandir seu salão.
        </>
      );
    }
  } else {
    // Feature Gate de recurso superior
    badgeText = 'Recurso Exclusivo';
    badgeBg = '#00c853';
    IconComponent = Star;
    iconColor = '#f59e0b';
    titleText = 'Plano Studio ou Business';
    headlineText = 'Seu negócio, sem limitações.';
    displayMessage = message || `Libere ${friendlyName} e aproveite a experiência completa do sistema.`;
    ctaText = 'Conhecer Planos & Upgrade';
    showTrialPerk = false;
    showPrice = false;
  }

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
      className={`
          fixed inset-0 z-[999]
          md:pl-[250px]
          flex items-center justify-center
          p-4
          ${theme.id === 'elegant' ? 'bg-black/45' : 'bg-black/50'}
          backdrop-blur-[5px]
          animate-fade-in
        `}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="
          relative
          w-full
          max-w-[340px]
          rounded-3xl
          border
          p-7
          text-center
          shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          backdrop-blur-2xl
        "
        style={{
          background: theme.id !== 'elegant' ? 'radial-gradient(130% 130% at 50% 0%, rgba(39, 39, 42, 0.95) 0%, rgba(9, 9, 11, 0.98) 100%)' : theme.cardBg,
          borderColor: theme.border,
        }}
      >
        {/* Badge */}
        <div
          className="
            absolute
            top-0
            right-0
            text-white
            text-[9px]
            font-bold
            px-4
            py-1.5
            rounded-tr-3xl
            rounded-bl-xl
            uppercase
            tracking-wider
            shadow-sm
          "
          style={{ background: badgeBg }}
        >
          {badgeText}
        </div>

        {/* Ícone e Título do Plano */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <IconComponent
            className="h-5 w-5"
            style={{ color: iconColor }}
          />

          <h3
            id="upgrade-modal-title"
            className="text-[20px] font-bold tracking-tight"
            style={{
              color: theme.textPrimary,
            }}
          >
            {titleText}
          </h3>
        </div>

        {/* Headline */}
        <h4
          className="
            mt-3.5
            text-[15px]
            font-bold
            tracking-[-0.02em]
          "
          style={{
            color: theme.textPrimary,
          }}
        >
          {headlineText}
        </h4>

        {/* Contexto */}
        <p
          className="
            mt-2.5
            px-2
            text-[12px]
            leading-[18px]
          "
          style={{
            color: theme.textSecondary,
          }}
        >
          {displayMessage}
        </p>

        {/* Trial Perk (se aplicável) */}
        {showTrialPerk && (
          <div className="mt-4 flex items-center justify-center gap-2">
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
        )}

        {/* Preço (se aplicável) */}
        {showPrice && (
          <div className="mt-3">
            <div className="flex items-baseline justify-center gap-1">
              <span
                className="
                  text-[24px]
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
        )}

        {/* CTA - Utiliza a cor de destaque (accent) do tema selecionado */}
        <button
          type="button"
          onClick={handleAction}
          className="
            mt-5
            w-full
            rounded-xl
            py-3.5
            text-[13px]
            font-bold
            shadow-lg
            transition-all
            hover:opacity-95
            hover:brightness-105
            active:scale-[0.97]
            cursor-pointer
          "
          style={{
            background: theme.btnPrimaryBg || theme.accent,
            color: theme.btnPrimaryText || '#FFFFFF',
            boxShadow: `0 10px 25px color-mix(in srgb, ${theme.accent} 35%, transparent)`
          }}
        >
          {ctaText}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="
            mt-3
            text-[13px]
            font-medium
            hover:underline
            cursor-pointer
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