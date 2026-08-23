import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';
import { useTheme } from '../../../contexts/ThemeContext';
import { Plus, Trash2, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { ManualTransactionModal } from './ManualTransactionModal';

interface Props {
  tenantId: string;
}

export function RecurringExpensesTab({ tenantId }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['recurring_expenses', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme.textPrimary }}>Gastos Fixos</h3>
          <p className="text-sm" style={{ color: theme.textSecondary }}>Gerencie despesas como Aluguel, Luz e Internet que se repetem automaticamente.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: theme.accent, color: theme.bg }}
        >
          <Plus className="w-4 h-4" />
          Novo Gasto Fixo
        </button>
      </div>

      <div className="border rounded-2xl overflow-hidden" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <table className="w-full text-left">
          <thead style={{ background: theme.bg }}>
            <tr>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Categoria</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Descrição</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Frequência</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: theme.textSecondary }}>Valor</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: theme.textSecondary }}>Próximo Venc.</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: theme.textSecondary }}>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ divideColor: theme.border }}>
            {expenses?.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm" style={{ color: theme.textSecondary }}>
                  Nenhum gasto fixo cadastrado. Clique no botão acima para adicionar.
                </td>
              </tr>
            ) : (
              expenses?.map((e: any) => (
                <tr key={e.id}>
                  <td className="p-4 text-sm font-medium" style={{ color: theme.textPrimary }}>
                    {e.category}
                  </td>
                  <td className="p-4 text-sm" style={{ color: theme.textSecondary }}>
                    {e.description}
                  </td>
                  <td className="p-4 text-sm" style={{ color: theme.textSecondary }}>
                    {e.frequency === 'monthly' ? 'Mensal' : e.frequency === 'weekly' ? 'Semanal' : 'Anual'}
                  </td>
                  <td className="p-4 text-sm text-right font-medium text-red-500">
                    -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(e.amount))}
                  </td>
                  <td className="p-4 text-sm text-center" style={{ color: theme.textPrimary }}>
                    {new Date(e.next_due_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 flex justify-center">
                    <button
                      onClick={async () => {
                        setDeletingId(e.id);
                        await deleteMutation.mutateAsync(e.id);
                        setDeletingId(null);
                      }}
                      disabled={deletingId === e.id}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                      title="Excluir"
                    >
                      {deletingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ManualTransactionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          tenantId={tenantId}
          isRecurringMode={true}
          onSave={async (transaction: any) => {
            const { error } = await supabase.from('recurring_expenses').insert({
              tenant_id: tenantId,
              category: transaction.category,
              description: transaction.description,
              amount: transaction.amount,
              payment_method: transaction.payment_method,
              frequency: 'monthly',
              next_due_date: new Date().toISOString().split('T')[0],
              active: true
            });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
