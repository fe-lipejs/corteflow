import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Sparkles, Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import type { PlanFeatures } from '../hooks/usePlanFeatures';
import { useTheme } from '../contexts/ThemeContext';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  /** Custom upgrade message */
  message?: string;
  /** Show a compact inline lock instead of full screen */
  inline?: boolean;
}

function UpgradeScreen({ message }: { message?: string }) {
  const { theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      className="relative flex flex-col items-center justify-center p-6 md:p-10 text-center max-w-lg w-full mx-auto"
    >
      {/* Glow Effect with Theme Accent */}
      <div
        className="absolute inset-0 blur-[90px] -z-10 rounded-full opacity-25"
        style={{ background: theme.accent }}
      />

      {/* Spotify-style Glass Card */}
      <div
        className="relative w-full rounded-3xl overflow-hidden border p-8 sm:p-10 shadow-2xl backdrop-blur-2xl text-left"
        style={{
          background: theme.cardBg,
          borderColor: theme.cardBorder,
          boxShadow: `0 30px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px ${theme.border} inset`,
        }}
      >
        {/* Top Accent Pill */}
        <div className="flex items-center justify-between mb-6">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border"
            style={{
              background: `${theme.accent}15`,
              borderColor: `${theme.accent}35`,
              color: theme.accent,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recurso Premium</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: theme.textMuted }}>
            Plano Growth
          </span>
        </div>

        {/* Title & Description */}
        <h2
          className="text-2xl sm:text-3xl font-black mb-2 tracking-tight"
          style={{ color: theme.textPrimary, fontFamily: "'Playfair Display', serif" }}
        >
          Desbloqueie todo o potencial
        </h2>
        <p className="text-sm leading-relaxed mb-6 font-medium" style={{ color: theme.textSecondary }}>
          {message ?? 'Esta funcionalidade faz parte do plano Growth. Faça o upgrade e impulsione a gestão do seu salão.'}
        </p>

        {/* Benefits Grid */}
        <div className="space-y-3 mb-8">
          {[
            'Catálogo completo de Produtos e Estoque',
            'Gestão Financeira detalhada e Relatórios avançados',
            'Até 10 profissionais e controle de comissões',
            'Suporte prioritário e ferramentas exclusivas',
          ].map((benefit, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
              style={{ background: `${theme.bg}80`, borderColor: theme.border }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: theme.accent, color: theme.btnPrimaryText }}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </div>
              <span className="text-xs sm:text-sm font-semibold" style={{ color: theme.textPrimary }}>
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <Link
          to="/app/assinatura"
          className="group relative flex items-center justify-center gap-2.5 w-full py-4 px-6 font-bold text-sm rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-lg"
          style={{
            background: theme.btnPrimaryBg || theme.accent,
            color: theme.btnPrimaryText,
          }}
        >
          <Zap className="w-4 h-4" />
          <span>Ver Planos e Fazer Upgrade</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>

        <p className="text-[11px] text-center mt-4 font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Sem fidelidade • Cancele quando quiser
        </p>
      </div>
    </motion.div>
  );
}

function InlineLock({ message }: { message?: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2 text-sm p-3 rounded-xl border" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
      <Sparkles className="w-4 h-4" style={{ color: theme.accent }} />
      <span style={{ color: theme.textSecondary }}>{message ?? 'Disponível no plano Growth.'}</span>
      <Link to="/app/assinatura" className="font-bold underline ml-auto text-xs" style={{ color: theme.accent }}>
        Fazer Upgrade
      </Link>
    </div>
  );
}

export default function FeatureGate({ feature, children, message, inline = false }: FeatureGateProps) {
  const { features, isLoading } = usePlanFeatures();

  if (isLoading) return <>{children}</>;

  const hasAccess = features[feature];

  if (!hasAccess) {
    const isTrialExpired = features.subscription_status === 'trial_expired';
    const noSub = !features.has_subscription;

    let defaultMessage = 'Este recurso faz parte do plano Growth. Faça upgrade para desbloquear.';
    if (isTrialExpired || noSub) {
      defaultMessage = 'Seu período de teste terminou. Escolha um plano para continuar aproveitando todos os recursos.';
    }

    const displayMessage = message ?? defaultMessage;

    if (inline) {
      return <InlineLock message={displayMessage} />;
    }

    return (
      <div className="relative w-full min-h-[500px] flex items-center justify-center p-4">
        {/* Upgrade Overlay */}
        <UpgradeScreen message={displayMessage} />
      </div>
    );
  }

  return <>{children}</>;
}
