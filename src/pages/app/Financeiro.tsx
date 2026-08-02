import { useState } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FeatureGate from '../../components/FeatureGate';

function FinanceiroContent() {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const [currentMonth] = useState(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['financials', tenant?.id, currentMonth.getMonth()],
    queryFn: async () => {
      if (!tenant) return null;
      
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

      // Fetch Payments (Entradas)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            id,
            customer_id,
            service_id,
            customers (name),
            services (name)
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Fetch Refunds (Saídas)
      const { data: refunds, error: refundsError } = await supabase
        .from('refunds')
        .select(`
          *,
          payments (
            id,
            bookings (
              customers (name),
              services (name)
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (refundsError) throw refundsError;

      // Fetch Local Bookings (pagamento no local, apenas concluídos para contar como receita real)
      const { data: localBookings, error: localBookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          scheduled_at,
          amount_total,
          status,
          customers (name),
          services (name)
        `)
        .eq('tenant_id', tenant.id)
        .eq('payment_mode', 'local')
        .eq('status', 'completed')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });
        
      if (localBookingsError) throw localBookingsError;

      let entradas = 0;
      let saidas = 0;

      const transactions: any[] = [];

      payments?.forEach((p: any) => {
        if (p.status === 'succeeded' || p.status === 'refunded') { 
          entradas += Number(p.amount);
        }
        
        transactions.push({
          id: p.id,
          type: 'income',
          amount: Number(p.amount),
          status: p.status, // pending, succeeded, failed, refunded
          method: p.payment_method || 'Cartão',
          date: p.created_at,
          customer_name: p.bookings?.customers?.name || 'Cliente',
          description: p.bookings?.services?.name || 'Serviço',
        });
      });

      refunds?.forEach((r: any) => {
        if (r.status === 'succeeded') {
          saidas += Number(r.amount);
        }

        transactions.push({
          id: r.id,
          type: 'expense',
          amount: Number(r.amount),
          status: r.status,
          method: 'Estorno (Cartão)',
          date: r.created_at,
          customer_name: r.payments?.bookings?.customers?.name || 'Cliente',
          description: `Estorno: ${r.payments?.bookings?.services?.name || 'Serviço'}`,
        });
      });

      localBookings?.forEach((b: any) => {
        entradas += Number(b.amount_total || 0);

        transactions.push({
          id: b.id,
          type: 'income',
          amount: Number(b.amount_total || 0),
          status: 'succeeded',
          method: 'Local (Dinheiro/Outro)',
          date: b.scheduled_at,
          customer_name: b.customers?.name || 'Cliente',
          description: b.services?.name || 'Serviço',
        });
      });

      // Sort transactions by date descending
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        entradas,
        saidas,
        liquido: entradas - saidas,
        transactions
      };
    },
    enabled: !!tenant,
  });

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Gestão</p>
          <h1 className="text-3xl font-bold font-sans" style={{ color: theme.textPrimary }}>Financeiro</h1>
          <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Acompanhe as finanças do seu salão.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 glass-card"
            style={{ borderColor: theme.border, color: theme.textPrimary }}>
            <Download className="w-4 h-4 mr-2" /> Relatório
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl shadow-2xl border glass-card" style={{ borderColor: theme.border }}>
           <div className="flex justify-between items-start mb-4">
             <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${theme.success}15`, color: theme.success }}>
                <ArrowUpRight className="w-6 h-6" />
             </div>
             <span className="text-xs font-semibold px-2 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>Este Mês</span>
           </div>
           <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Entradas (Online)</p>
           <h3 className="text-3xl font-bold" style={{ color: theme.textPrimary }}>
             {isLoading ? <div className="h-9 w-32 skeleton skeleton-text mt-1" /> : money(data?.entradas || 0)}
           </h3>
        </div>
        
        <div className="p-6 rounded-2xl shadow-2xl border glass-card" style={{ borderColor: theme.border }}>
           <div className="flex justify-between items-start mb-4">
             <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${theme.error}15`, color: theme.error }}>
                <ArrowDownRight className="w-6 h-6" />
             </div>
             <span className="text-xs font-semibold px-2 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>Este Mês</span>
           </div>
           <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Saídas (Estornos)</p>
           <h3 className="text-3xl font-bold" style={{ color: theme.textPrimary }}>
             {isLoading ? <div className="h-9 w-32 skeleton skeleton-text mt-1" /> : money(data?.saidas || 0)}
           </h3>
        </div>
        
        <div className="p-6 rounded-2xl shadow-2xl border relative overflow-hidden" style={{ background: theme.accentGradient, borderColor: theme.accent, color: theme.btnPrimaryText }}>
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
           <div className="flex justify-between items-start mb-4 relative z-10">
             <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>
                <DollarSign className="w-6 h-6" />
             </div>
             <span className="text-xs font-bold px-2 py-1 bg-black/20 rounded-full backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>Líquido</span>
           </div>
           <p className="text-sm font-bold opacity-80 mb-1 relative z-10">Lucro (Online)</p>
           <h3 className="text-3xl font-black relative z-10">
             {isLoading ? <div className="h-9 w-32 bg-white/20 rounded animate-pulse mt-1" /> : money(data?.liquido || 0)}
           </h3>
        </div>
      </div>

      {/* LISTA DE TRANSAÇÕES */}
      <div className="border rounded-2xl shadow-2xl flex-1 p-6 glass-card" style={{ borderColor: theme.border }}>
        <h3 className="font-bold mb-6" style={{ color: theme.textPrimary }}>Últimas Transações</h3>
        <div className="w-full overflow-x-auto">
          {isLoading ? (
            <table className="w-full text-left">
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={4} />
                ))}
              </tbody>
            </table>
          ) : data?.transactions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl flex items-center justify-center" style={{ borderColor: theme.border, color: theme.textSecondary }}>
              Nenhuma transação online encontrada neste mês.
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b last:border-b-0 hover:bg-black/5 transition-colors" style={{ borderColor: theme.border }}>
                    <td className="py-4 px-4 font-medium" style={{ color: theme.textPrimary }}>
                      {format(new Date(tx.date), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-4 px-4" style={{ color: theme.textSecondary }}>
                      {tx.description}
                    </td>
                    <td className="py-4 px-4" style={{ color: theme.textSecondary }}>
                      {tx.customer_name}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={
                          tx.status === 'succeeded'
                            ? { backgroundColor: `${theme.success}20`, color: theme.success }
                            : tx.status === 'refunded'
                            ? { backgroundColor: `${theme.error}20`, color: theme.error }
                            : { backgroundColor: `${theme.warning}20`, color: theme.warning }
                        }
                      >
                        {tx.status === 'succeeded' ? 'Concluído' : tx.status === 'refunded' ? 'Estornado' : 'Pendente'}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-right font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{money(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Financeiro() {
  return (
    <FeatureGate
      feature="financeiro"
      message="O módulo financeiro está disponível no plano Growth e superiores. Faça upgrade para visualizar entradas, saídas e relatórios financeiros."
    >
      <FinanceiroContent />
    </FeatureGate>
  );
}
