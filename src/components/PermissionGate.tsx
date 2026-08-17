import type { ReactNode } from 'react';
import { usePermissionEngine } from '../hooks/usePermissionEngine';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Componente que oculta ou bloqueia a interface baseado numa PERMISSÃO de tela/ação.
 * Usado para controle de acesso granular (RBAC/ABAC).
 * Não deve ser usado para features comerciais de upgrade de plano (para isso, use FeatureGate).
 */
export default function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissionEngine();

  // Durante o carregamento, é seguro ocultar ações perigosas.
  // Pode causar um leve delay visual no botão, mas previne falsos positivos.
  if (isLoading) {
    return <span className="opacity-0 pointer-events-none">{children}</span>; 
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
