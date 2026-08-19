import { useState, useMemo } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Scissors } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MinhaComissao() {
  const { theme } = useTheme();
  const { tenant, professionalProfile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const tenantId = tenant?.id;
  const professionalId = professionalProfile?.id;

  // Fetch completed bookings for this professional in the selected month
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my_commission', tenantId, professionalId, currentMonth.getMonth()],
    queryFn: async () => {
      if (!tenantId || !professionalId) return [];

      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_at,
          amount_total,
          status,
          professional_id,
          customers (name),
          services (name, commission_pct)
        `)
        .eq('tenant_id', tenantId)
        .eq('professional_id', professionalId)
        .eq('status', 'completed')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!professionalId,
  });

  const money = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Calcula os totais
  const { totalFaturado, totalComissao, comissoes } = useMemo(() => {
    let faturado = 0;
    let comissao = 0;
    const lista: any[] = [];

    bookings.forEach((b: any) => {
      const amount = Number(b.amount_total || 0);
      const pct = Number(b.services?.commission_pct || 0);
      const valorComissao = amount * (pct / 100);

      faturado += amount;
      comissao += valorComissao;

      lista.push({
        id: b.id,
        date: b.scheduled_at,
        customerName: b.customers?.name || 'Cliente',
        serviceName: b.services?.name || 'Serviço',
        amount: amount,
        pct: pct,
        valorComissao: valorComissao,
      });
    });

    return { totalFaturado: faturado, totalComissao: comissao, comissoes: lista };
  }, [bookings]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in w-full">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Financeiro</p>
          <h1 className="text-3xl font-bold font-sans" style={{ color: theme.textPrimary }}>Minha Comissão</h1>
          <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Acompanhe seus ganhos por serviço realizado.</p>
        </div>
      </header>

      {/* Month Selector */}
      <div className="flex items-center gap-4 py-2 border-b" style={{ borderColor: theme.border }}>
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 border rounded-xl hover:bg-black/5 transition-all"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold capitalize w-48 text-center" style={{ color: theme.textPrimary }}>
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 border rounded-xl hover:bg-black/5 transition-all"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl shadow-2xl border glass-card" style={{ borderColor: theme.border }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${theme.accent}15`, color: theme.accent }}>
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Total de Comissões</p>
          <h3 className="text-3xl font-bold" style={{ color: theme.textPrimary }}>
            {isLoading ? <div className="h-9 w-32 bg-gray-200 animate-pulse rounded mt-1" /> : money(totalComissao)}
          </h3>
        </div>

        <div className="p-6 rounded-2xl shadow-2xl border glass-card" style={{ borderColor: theme.border }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${theme.textSecondary}15`, color: theme.textSecondary }}>
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Valor Faturado (Total dos Serviços)</p>
          <h3 className="text-3xl font-bold" style={{ color: theme.textPrimary }}>
            {isLoading ? <div className="h-9 w-32 bg-gray-200 animate-pulse rounded mt-1" /> : money(totalFaturado)}
          </h3>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border flex-1 overflow-hidden flex flex-col bg-opacity-50 glass-card" style={{ borderColor: theme.border, background: theme.bg }}>
        <div className="p-4 border-b" style={{ borderColor: theme.border }}>
          <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: theme.textPrimary }}>
            <Scissors className="w-4 h-4" />
            Serviços Realizados ({comissoes.length})
          </h3>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="p-8 text-center" style={{ color: theme.textSecondary }}>Carregando...</div>
          ) : comissoes.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Scissors className="w-12 h-12 mb-3 opacity-20" style={{ color: theme.textPrimary }} />
              <p className="font-semibold text-lg" style={{ color: theme.textPrimary }}>Nenhum serviço</p>
              <p className="text-sm mt-1 max-w-md" style={{ color: theme.textSecondary }}>Você ainda não possui serviços finalizados neste mês.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider bg-black/5" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                  <th className="p-4 font-bold">Data</th>
                  <th className="p-4 font-bold">Cliente</th>
                  <th className="p-4 font-bold">Serviço</th>
                  <th className="p-4 font-bold text-right">Valor Total</th>
                  <th className="p-4 font-bold text-right">% Comiss.</th>
                  <th className="p-4 font-bold text-right">Seu Ganho</th>
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-black/5 transition-colors" style={{ borderColor: theme.border }}>
                    <td className="p-4">
                      <div className="text-sm font-semibold whitespace-nowrap" style={{ color: theme.textPrimary }}>
                        {format(new Date(c.date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="text-xs" style={{ color: theme.textSecondary }}>
                        {format(new Date(c.date), "HH:mm")}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{c.customerName}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm" style={{ color: theme.textSecondary }}>{c.serviceName}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{money(c.amount)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs px-2 py-1 bg-black/5 rounded-md" style={{ color: theme.textSecondary }}>
                        {c.pct}%
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-bold" style={{ color: theme.success }}>
                        + {money(c.valorComissao)}
                      </span>
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
