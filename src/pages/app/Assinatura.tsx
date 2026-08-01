import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { Crown, ExternalLink } from 'lucide-react';

export default function Assinatura() {
  const { tenant } = useAuth();
  const { theme } = useTheme();
  const [plan, setPlan] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant) {
      const fetchData = async () => {
        const { data: subData } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenant.id).maybeSingle();
        if (subData) {
          setSubscription(subData);
          const { data: pData } = await supabase.from('plans').select('*').eq('id', subData.plan_id).maybeSingle();
          if (pData) setPlan(pData);
        }
        setLoading(false);
      };
      fetchData();
    }
  }, [tenant]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.accent, borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col max-w-4xl mx-auto animate-fade-in">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Minha Assinatura</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Plano Ativo</h1>
        </div>
      </header>

      <div className="p-8 rounded-3xl shadow-2xl border text-center md:text-left flex flex-col md:flex-row items-center gap-8 glass-card" style={{ borderColor: theme.border }}>
        <div className="w-24 h-24 rounded-full border-2 flex items-center justify-center shrink-0" 
          style={{ background: theme.inputBg, borderColor: theme.accent, color: theme.accent, boxShadow: theme.shadowAccent }}>
          <Crown className="w-12 h-12" />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>{plan?.name || 'Nenhum plano ativo'}</h2>
          <p className="mb-4" style={{ color: theme.textSecondary }}>
            {subscription?.status === 'trialing' ? 'Período de teste gratuito.' : (subscription ? 'Assinatura ativa e em dia.' : 'Você não possui uma assinatura.')}
          </p>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {plan && (
              <span className="px-3 py-1 border rounded-full text-xs font-bold" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}>
                {plan.max_professionals === 1 ? '1 Profissional' : 'Até 10 Profissionais'}
              </span>
            )}
            {plan?.allow_products && (
              <span className="px-3 py-1 border rounded-full text-xs font-bold" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}>
                Venda de Produtos
              </span>
            )}
          </div>
        </div>
        <div>
          <button className="w-full md:w-auto px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5" 
            style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}>
            {subscription ? 'Alterar Plano' : 'Assinar Agora'}
          </button>
        </div>
      </div>

      {subscription && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="p-6 rounded-2xl border glass-card" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <h3 className="font-bold mb-4" style={{ color: theme.textPrimary }}>Detalhes do Faturamento</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex justify-between border-b pb-2" style={{ borderColor: theme.border }}>
                <span style={{ color: theme.textSecondary }}>Status</span>
                <span className="font-semibold" style={{ color: theme.success }}>Ativo</span>
              </li>
              <li className="flex justify-between border-b pb-2" style={{ borderColor: theme.border }}>
                <span style={{ color: theme.textSecondary }}>Próxima cobrança</span>
                <span className="font-semibold" style={{ color: theme.textPrimary }}>15 de Setembro de 2026</span>
              </li>
              <li className="flex justify-between pb-2">
                <span style={{ color: theme.textSecondary }}>Valor</span>
                <span className="font-semibold" style={{ color: theme.textPrimary }}>R$ 77,00 / mês</span>
              </li>
            </ul>
          </div>
          
          <div className="p-6 rounded-2xl border flex flex-col justify-center items-center text-center glass-card" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <p className="mb-4 text-sm" style={{ color: theme.textSecondary }}>Acesse o portal do cliente Stripe para ver seu histórico de faturas e atualizar o cartão de crédito.</p>
            <button className="flex items-center gap-2 px-6 py-2 border rounded-xl transition-colors hover:bg-[var(--theme-bg-hover)]" 
              style={{ borderColor: theme.border, color: theme.textPrimary }}>
              <ExternalLink className="w-4 h-4" style={{ color: theme.accent }} /> Portal de Pagamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
