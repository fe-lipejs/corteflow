import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';
import { useTheme } from '../../../contexts/ThemeContext';
import { CheckCircle, DollarSign, User, Calendar, Loader2 } from 'lucide-react';

interface Props {
  tenantId: string;
}

export function CommissionsTab({ tenantId }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['commissions', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          id,
          amount,
          created_at,
          status,
          professionals(name),
          bookings(services(name))
        `)
        .eq('tenant_id', tenantId)
        .eq('type', 'expense')
        .eq('category', 'Comissão')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ status: 'approved' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['financials_full'] });
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  const pending = commissions?.filter(c => c.status === 'pending') || [];
  const paid = commissions?.filter(c => c.status === 'approved') || [];

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 p-6 border rounded-2xl" style={{ borderColor: theme.border, background: theme.cardBg }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: theme.textSecondary }}>A Pagar</h3>
          <p className="text-2xl font-bold text-red-500">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              pending.reduce((acc, curr) => acc + Number(curr.amount), 0)
            )}
          </p>
        </div>
        <div className="flex-1 p-6 border rounded-2xl" style={{ borderColor: theme.border, background: theme.cardBg }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: theme.textSecondary }}>Pago (Mês)</h3>
          <p className="text-2xl font-bold text-green-500">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              paid.reduce((acc, curr) => acc + Number(curr.amount), 0)
            )}
          </p>
        </div>
      </div>

      <div className="border rounded-2xl overflow-hidden" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <table className="w-full text-left">
          <thead style={{ background: theme.bg }}>
            <tr>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Data</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Profissional</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Serviço</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: theme.textSecondary }}>Valor</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: theme.textSecondary }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: theme.border }}>
            {commissions?.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm" style={{ color: theme.textSecondary }}>
                  Nenhuma comissão registrada. Elas aparecerão aqui automaticamente quando um agendamento for concluído.
                </td>
              </tr>
            ) : (
              commissions?.map((c: any) => (
                <tr key={c.id}>
                  <td className="p-4 text-sm" style={{ color: theme.textPrimary }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 text-sm font-medium" style={{ color: theme.textPrimary }}>
                    {c.professionals?.name || 'Desconhecido'}
                  </td>
                  <td className="p-4 text-sm" style={{ color: theme.textSecondary }}>
                    {c.bookings?.services?.name || 'Venda'}
                  </td>
                  <td className="p-4 text-sm text-right font-medium text-red-500">
                    -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.amount))}
                  </td>
                  <td className="p-4 text-sm text-center">
                    {c.status === 'pending' ? (
                      <button
                        onClick={async () => {
                          setPayingId(c.id);
                          await payMutation.mutateAsync(c.id);
                          setPayingId(null);
                        }}
                        disabled={payingId === c.id}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        {payingId === c.id ? 'Baixando...' : 'Pagar Agora'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Pago
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
