import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/database';

export default function RequireRole({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) {
  const { role, profile, tenant, onboardingCompleted, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1714] text-white">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 bg-[#C9963B] rounded-full"></div>
          <div className="w-2 h-2 bg-[#C9963B] rounded-full animation-delay-200"></div>
          <div className="w-2 h-2 bg-[#C9963B] rounded-full animation-delay-400"></div>
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

