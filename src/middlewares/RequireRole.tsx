import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/database';

export default function RequireRole({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) {
  const { role, loading } = useAuth();

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

  // Se o usuário não tem uma role definida, pode ser um usuário recém cadastrado que precisa fazer onboarding
  if (!role) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!allowedRoles.includes(role)) {
    // Se a role não é permitida, redireciona adequadamente
    if (role === 'super_admin' || role === 'owner') {
      return <Navigate to="/app" replace />;
    } else {
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
}
