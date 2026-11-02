import { Navigate } from 'react-router-dom';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import FeatureGate from '../components/FeatureGate';

export default function RequirePermission({ 
  children, 
  permission,
  modulePrefix
}: { 
  children: React.ReactNode, 
  permission?: string,
  modulePrefix?: string
}) {
  const { hasPermission, hasAnyPermission, isLoading } = usePermissionEngine();
  const { role, profile, tenant, onboardingCompleted, loading } = useAuth();
  const { theme } = useTheme();

  if (loading || isLoading) {
    return (
      <div className="py-24 flex items-center justify-center w-full min-h-[300px]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: theme.accent }}></div>
          <div className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0.2s]" style={{ background: theme.accent }}></div>
          <div className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0.4s]" style={{ background: theme.accent }}></div>
        </div>
      </div>
    );
  }

  const effectiveRole = role || (profile?.tenant_id || tenant ? 'admin' : null);

  if (!onboardingCompleted && effectiveRole !== 'super_admin') {
    return <Navigate to="/onboarding" replace />;
  }

  let hasAccess = false;
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (modulePrefix) {
    hasAccess = hasAnyPermission(modulePrefix);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    // Render FeatureGate sem forçar mensagem genérica, permitindo que o modal resolva
    // contextualmente se o salão está cancelado, teste expirado, fatura pendente ou limite
    return (
      <FeatureGate permission={permission} modulePrefix={modulePrefix}>
        {children}
      </FeatureGate>
    );
  }

  return <>{children}</>;
}
