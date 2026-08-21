import type { ReactNode } from 'react';
import { usePermissionEngine } from '../hooks/usePermissionEngine';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LimitGateProps {
  limitKey: string;
  currentUsage: number;
  children: ReactNode;
  fallbackMessage?: string;
}

export default function LimitGate({ limitKey, currentUsage, children, fallbackMessage }: LimitGateProps) {
  const { checkLimit, getPlanLimit, isLoading } = usePermissionEngine();

  if (isLoading) {
    return <span className="opacity-0 pointer-events-none">{children}</span>;
  }

  const hasCapacity = checkLimit(limitKey, currentUsage);

  if (!hasCapacity) {
    const max = getPlanLimit(limitKey);
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
          <Lock className="w-5 h-5 text-amber-500" />
        </div>
        <h4 className="text-white font-bold mb-1">Limite Atingido</h4>
        <p className="text-sm text-[#888] mb-4 max-w-sm">
          {fallbackMessage || `Seu plano atual permite apenas ${max} item(ns) deste tipo.`}
        </p>
        <Link 
          to="/admin/assinatura" 
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors uppercase tracking-wider"
        >
          Fazer Upgrade
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

