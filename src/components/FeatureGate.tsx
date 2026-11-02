import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { UpgradeModal } from './UpgradeModal';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useTheme } from '../contexts/ThemeContext';

interface FeatureGateProps {
  feature?: string;
  permission?: string;
  modulePrefix?: string;
  children: ReactNode;
  /** Custom upgrade message */
  message?: string;
  /** Show a compact inline lock instead of full screen */
  inline?: boolean;
}

function InlineLock({ message }: { message?: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2 text-sm p-3 rounded-xl border shadow-sm backdrop-blur-md" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
      <Lock className="w-4 h-4" style={{ color: theme.accent }} />
      <span style={{ color: theme.textSecondary }}>{message ?? 'Disponível em um plano superior.'}</span>
      <Link to="/admin/assinatura" className="font-bold underline ml-auto text-xs" style={{ color: theme.accent }}>
        Fazer Upgrade
      </Link>
    </div>
  );
}

export default function FeatureGate({ feature, permission, modulePrefix, children, message, inline = false }: FeatureGateProps) {
  const { theme } = useTheme();
  const engine = usePermissionEngine();

  if (engine.isLoading) return <>{children}</>;

  let hasAccess = false;
  if (permission) {
    hasAccess = engine.hasPermission(permission);
  } else if (modulePrefix) {
    hasAccess = engine.hasAnyPermission(modulePrefix);
  } else if (feature) {
    hasAccess = engine.hasFeature(feature);
  }

  if (!hasAccess) {
    if (inline) {
      let inlineMsg = message;
      if (!inlineMsg) {
        if (engine.subscriptionStatus === 'canceled') {
          inlineMsg = 'Sua assinatura está cancelada. Reative para acessar.';
        } else if (engine.subscriptionStatus === 'trial_expired') {
          inlineMsg = 'Seu período de teste encerrou. Escolha um plano para continuar.';
        } else if (engine.subscriptionStatus === 'past_due') {
          inlineMsg = 'Fatura pendente. Regularize sua assinatura.';
        } else if (engine.subscriptionStatus === 'no_subscription') {
          inlineMsg = 'Nenhum plano ativo. Assine para liberar este recurso.';
        } else {
          inlineMsg = 'Disponível em um plano superior.';
        }
      }
      return <InlineLock message={inlineMsg} />;
    }

    return (
      <div className="relative w-full h-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
        {/* Render actual children but blurred and disabled to tease the user */}
        <div className="pointer-events-none select-none filter blur-[5px] h-full w-full">
          {children}
        </div>

        {/* Modal Overlay contextual */}
        <UpgradeModal feature={permission || modulePrefix || feature} message={message} />
      </div>
    );
  }

  return <>{children}</>;
}
