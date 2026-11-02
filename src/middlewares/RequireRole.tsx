import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import type { UserRole } from '../types/database';

export default function RequireRole({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) {
  const { role, profile, tenant, onboardingCompleted, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
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

  // Super admin tem acesso direto à área master
  if (effectiveRole === 'super_admin') {
    if (!allowedRoles.includes('super_admin')) {
      return <Navigate to="/platform" replace />;
    }
    return <>{children}</>;
  }

  // Se não concluiu o onboarding no banco, bloqueia qualquer rota interna
  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!effectiveRole || !allowedRoles.includes(effectiveRole as UserRole)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

