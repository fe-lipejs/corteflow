import { Navigate } from 'react-router-dom';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useAuth } from '../hooks/useAuth';

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

  if (loading || isLoading) {
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
    // Redireciona de volta para o dashboard caso tente acessar uma rota sem permissão
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

