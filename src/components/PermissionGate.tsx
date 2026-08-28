import type { ReactNode } from 'react';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useTheme } from '../contexts/ThemeContext';
import { UpgradeModal } from './UpgradeModal';
import { Crown, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
  type?: 'inline' | 'modal' | 'page';
  onClose?: () => void;
}

export default function PermissionGate({ permission, children, fallback = null, type = 'inline', onClose }: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissionEngine();
  const { theme } = useTheme();
  const navigate = useNavigate();

  if (isLoading) {
    return <span className="opacity-0 pointer-events-none">{children}</span>; 
  }

  if (!hasPermission(permission)) {
    if (fallback && type === 'inline') {
      return <>{fallback}</>;
    }

    if (type === 'modal' || type === 'page') {
      return (
        <UpgradeModal 
          feature={permission}
          onClose={() => {
            if (onClose) {
              onClose();
            } else if (type === 'page') {
              navigate(-1);
            } else {
              navigate('/admin');
            }
          }}
        />
      );
    }

    return null;
  }

  return <>{children}</>;
}

