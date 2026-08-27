import { ReactNode, useState } from 'react';
import { useAccountState } from '../hooks/useAccountState';
import { Lock, CreditCard, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase/client';

type FeatureType = 'agenda' | 'servicos' | 'profissionais' | 'financeiro' | 'link_publico';

interface PaywallGateProps {
  feature: FeatureType;
  children: ReactNode;
}

const MESSAGES: Record<FeatureType, { title: string, text: string }> = {
  agenda: {
    title: 'Sua agenda está trancada',
    text: 'Sua agenda está pronta, mas ainda não pode receber ninguém. Ative agora — 7 dias grátis, cancele quando quiser.',
  },
  servicos: {
    title: 'Serviços bloqueados',
    text: 'Sem assinar, seus clientes não conseguem marcar horário com você. Assine agora e comece a receber agendamentos hoje.',
  },
  profissionais: {
    title: 'Equipe bloqueada',
    text: 'Sem assinar, você não consegue montar sua equipe no sistema. Ative agora e organize sua agenda com todo mundo.',
  },
  financeiro: {
    title: 'Caixa bloqueado',
    text: 'Assine para acompanhar quanto seu negócio está faturando em tempo real.',
  },
  link_publico: {
    title: 'Link inativo',
    text: 'Seu link só funciona com a assinatura ativa. Ative agora e comece a divulgar hoje mesmo.',
  }
};

export default function PaywallGate({ feature, children }: PaywallGateProps) {
  const { data: account, isLoading } = useAccountState();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
      </div>
    );
  }

  // Se a conta for escrevível, renderiza o children (liberado)
  const isLocked = account?.account_state === 'onboarding_no_card' || 
                   account?.account_state === 'locked' || 
                   account?.account_state === 'canceled';

  if (!isLocked) {
    return <>{children}</>;
  }

  const handleCheckout = async () => {
    setIsRedirecting(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').single();
      const returnUrl = `${window.location.origin}/app`;
      
      // Obter o plano "Studio" como default para o trial inicial (isso pode ser adaptado via UI)
      const { data: plan } = await supabase.from('plans').select('id').eq('key', 'studio_tier').single();
      
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId: plan?.id, returnUrl }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar checkout. Tente novamente.');
      setIsRedirecting(false);
    }
  };

  const message = MESSAGES[feature];

  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center p-6 bg-zinc-950/50 rounded-xl border border-zinc-800/50 overflow-hidden backdrop-blur-sm">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md text-center"
      >
        <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <Lock className="w-8 h-8 text-[#d4af37]" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-3">
          {message.title}
        </h3>
        
        <p className="text-zinc-400 mb-8 leading-relaxed">
          {message.text}
        </p>

        <button
          onClick={handleCheckout}
          disabled={isRedirecting}
          className="group relative w-full flex items-center justify-center gap-2 bg-[#d4af37] text-zinc-950 px-6 py-4 rounded-xl font-bold hover:bg-[#f3ca3e] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          {isRedirecting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              <span>Desbloquear Agora (7 Dias Grátis)</span>
              <ChevronRight className="w-5 h-5 absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </>
          )}
        </button>
        
        <p className="mt-4 text-xs text-zinc-500 font-medium tracking-wide">
          SEM COMPROMISSO • CANCELE QUANDO QUISER
        </p>
      </motion.div>

      {/* Decorative background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
