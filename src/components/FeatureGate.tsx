import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
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
  const navigate = useNavigate();

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
    const subStatus = engine.subscription?.status;
    const isTrialExpired = subStatus === 'trial' && engine.subscription?.trial_ends_at && new Date(engine.subscription.trial_ends_at) < new Date();
    const noSub = !engine.subscription && !engine.defaultPlan;

    let defaultMessage = 'Esta funcionalidade é exclusiva de planos superiores. Faça o upgrade para desbloquear o acesso total.';
    if (isTrialExpired || noSub) {
      defaultMessage = 'Seu período de teste terminou. Escolha um plano para continuar aproveitando todos os recursos.';
    }

    const displayMessage = message ?? defaultMessage;

    if (inline) {
      return <InlineLock message={displayMessage} />;
    }

    return (
      <div className="relative w-full h-full min-h-[500px]">
        {/* Render actual children but blurred and disabled to tease the user */}
        <div className="absolute inset-0 pointer-events-none select-none filter blur-[5px] opacity-60 overflow-hidden">
          {children}
        </div>

        {/* Modal Overlay */}
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 glass-card animate-scale-in" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="relative mb-6">
              <div className="relative w-20 h-20 mx-auto bg-black border rounded-full flex items-center justify-center" style={{ borderColor: theme.accent }}>
                <Crown className="w-10 h-10" style={{ color: theme.accent }} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <Lock className="w-4 h-4" style={{ color: theme.textSecondary }} />
                </div>
              </div>
            </div>
            
            <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>
              Recurso Premium
            </h3>
            
            <p className="text-sm mb-7" style={{ color: theme.textSecondary }}>
              {displayMessage}
            </p>
            
            <button
              onClick={() => { navigate('/admin/assinatura'); }}
              className="w-full py-3 rounded-xl mb-3 font-bold transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)]"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
            >
              Ver planos
            </button>
            
            <button 
              className="text-sm w-full py-2 transition-colors hover:underline" 
              style={{ color: theme.textSecondary }} 
              onClick={() => navigate('/admin')}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


