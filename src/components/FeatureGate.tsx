import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import type { PlanFeatures } from '../hooks/usePlanFeatures';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  /** Custom upgrade message */
  message?: string;
  /** Show a compact inline lock instead of full screen */
  inline?: boolean;
}

function UpgradeScreen({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 px-8 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9963B]/20 to-[#E8B960]/10 border border-[#C9963B]/20 flex items-center justify-center mb-6">
        <Zap className="w-7 h-7 text-[#C9963B]" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Recurso não disponível</h2>
      <p className="text-[#A09888] text-sm max-w-sm leading-relaxed mb-6">
        {message ?? 'Este recurso não está disponível no seu plano atual. Faça upgrade para desbloquear.'}
      </p>
      <Link
        to="/app/assinatura"
        className="flex items-center gap-2 px-6 py-3 font-bold text-sm rounded-xl transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)]"
        style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#1A1714' }}
      >
        <Zap className="w-4 h-4" />
        Ver Planos e Fazer Upgrade
      </Link>
    </motion.div>
  );
}

function InlineLock({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#555]">
      <Lock className="w-4 h-4 text-[#C9963B]" />
      <span>{message ?? 'Disponível apenas em planos superiores.'}</span>
      <Link to="/app/assinatura" className="text-[#C9963B] hover:underline font-medium">
        Upgrade
      </Link>
    </div>
  );
}

export default function FeatureGate({ feature, children, message, inline = false }: FeatureGateProps) {
  const { features, isLoading } = usePlanFeatures();

  if (isLoading) return <>{children}</>;

  const hasAccess = features[feature];

  if (!hasAccess) {
    return inline ? <InlineLock message={message} /> : <UpgradeScreen message={message} />;
  }

  return <>{children}</>;
}
