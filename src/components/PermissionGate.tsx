import type { ReactNode } from 'react';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { useTheme } from '../contexts/ThemeContext';
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
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
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
              Esta funcionalidade é exclusiva de planos superiores. Faça o upgrade para desbloquear o acesso total.
            </p>
            
            <button
              onClick={() => { navigate('/app/assinatura'); }}
              className="w-full py-3 rounded-xl mb-3 font-bold transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)]"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
            >
              Ver planos
            </button>
            
            <button 
              className="text-sm w-full py-2 transition-colors hover:underline" 
              style={{ color: theme.textSecondary }} 
              onClick={() => {
                if (onClose) {
                  onClose();
                } else if (type === 'page') {
                  navigate(-1);
                } else {
                  navigate('/app');
                }
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}
