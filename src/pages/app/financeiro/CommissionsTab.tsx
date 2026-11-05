import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Calendar, Loader2, User } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../integrations/supabase/client';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrencyBRL } from '../../../services/financialService';

interface Props {
  tenantId: string;
  currentMonth?: Date;
  role?: string | null;
  professionalId?: string | null;
}

export function CommissionsTab({
  tenantId,
  currentMonth = new Date(),
  role,
  professionalId,
}: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);

  const isLight =
    theme.id === 'elegant' ||
    Boolean(theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  const monthStart = startOfMonth(currentMonth).toISOString();
  const monthEnd = endOfMonth(currentMonth).toISOString();
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: ptBR });

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', tenantId, professionalId, monthStart],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select(`
          id,
          amount,
          created_at,
          date,
          status,
          professional_id,
          professionals(name),
          bookings(services(name))
        `)
        .eq('tenant_id', tenantId)
        .eq('type', 'expense')
        .eq('category', 'Comissão')
        .neq('status', 'rejected')
        .is('deleted_at', null)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      if (role === 'professional' && professionalId) {
        query = query.eq('professional_id', professionalId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({
          status: 'approved',
          date: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['financials_full'] });
      queryClient.invalidateQueries({ queryKey: ['financial_evolution'] });
      toast.success('Repasse de comissão confirmado e registrado no caixa!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao baixar comissão.');
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: theme.accent }} />
      </div>
    );
  }

  const pending = commissions.filter((c: any) => c.status === 'pending');
  const paid = commissions.filter((c: any) => c.status === 'approved');
  const pendingTotal = pending.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const paidTotal = paid.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* KPIs Compactos Mobile-First (2 colunas no celular) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div
          className="p-4 sm:p-6 border rounded-2xl shadow-sm"
          style={{
            borderColor: pendingTotal > 0 ? `${theme.warning}40` : isLight ? '#E2E8F0' : theme.border,
            background: isLight ? '#FFFFFF' : theme.cardBg,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
            Comissões a Pagar
          </p>
          <p className="text-xl sm:text-2xl font-extrabold" style={{ color: pendingTotal > 0 ? theme.warning : isLight ? '#0F172A' : theme.textPrimary }}>
            {formatCurrencyBRL(pendingTotal)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
            {pending.length} {pending.length === 1 ? 'repasse pendente' : 'repasses pendentes'}
          </p>
        </div>

        <div
          className="p-4 sm:p-6 border rounded-2xl shadow-sm"
          style={{
            borderColor: isLight ? '#E2E8F0' : theme.border,
            background: isLight ? '#FFFFFF' : theme.cardBg,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-1 capitalize" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
            Pagas ({monthLabel})
          </p>
          <p className="text-xl sm:text-2xl font-extrabold" style={{ color: theme.success }}>
            {formatCurrencyBRL(paidTotal)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
            {paid.length} {paid.length === 1 ? 'repasse quitado' : 'repasses quitados'}
          </p>
        </div>
      </div>

      {commissions.length === 0 ? (
        <div
          className="p-10 text-center border border-dashed rounded-2xl"
          style={{
            borderColor: isLight ? '#E2E8F0' : theme.border,
            background: isLight ? '#F8FAFC' : 'transparent',
            color: isLight ? '#64748B' : theme.textSecondary,
          }}
        >
          <p className="text-sm font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
            Nenhuma comissão registrada em {monthLabel}.
          </p>
          <p className="text-xs mt-1">
            As comissões aparecem automaticamente aqui quando um atendimento é concluído.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE (< md): Lista de Cards Compactos sem rolagem horizontal */}
          <div className="md:hidden space-y-2.5">
            {commissions.map((c: any) => {
              const isPending = c.status === 'pending';
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                        <User className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                        <span className="truncate">{c.professionals?.name || 'Profissional'}</span>
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                        {c.bookings?.services?.name || 'Atendimento'}
                      </p>
                    </div>

                    <p className="text-base font-extrabold shrink-0" style={{ color: theme.error }}>
                      -{formatCurrencyBRL(Number(c.amount || 0))}
                    </p>
                  </div>

                  <div
                    className="pt-2.5 border-t flex items-center justify-between gap-2"
                    style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                  >
                    <span className="text-xs inline-flex items-center gap-1" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    {isPending ? (
                      role !== 'professional' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            setPayingId(c.id);
                            try {
                              await payMutation.mutateAsync(c.id);
                            } finally {
                              setPayingId(null);
                            }
                          }}
                          disabled={payingId === c.id}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          style={{
                            background: theme.accentGradient,
                            color: theme.btnPrimaryText,
                          }}
                        >
                          {payingId === c.id ? 'Confirmando...' : 'Pagar Agora'}
                        </button>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ background: `${theme.warning}18`, color: theme.warning }}
                        >
                          A Receber
                        </span>
                      )
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: `${theme.success}18`, color: theme.success }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Pago
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP (>= md): Tabela Limpa */}
          <div
            className="hidden md:block border rounded-2xl overflow-hidden shadow-sm"
            style={{ borderColor: isLight ? '#E2E8F0' : theme.border, background: isLight ? '#FFFFFF' : theme.cardBg }}
          >
            <table className="w-full text-left">
              <thead style={{ background: isLight ? '#F8FAFC' : theme.bg }}>
                <tr>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                    Data
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                    Profissional
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                    Serviço
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                    Valor
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                    Status / Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}>
                {commissions.map((c: any) => (
                  <tr key={c.id}>
                    <td className="p-4 text-sm whitespace-nowrap" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-sm font-bold whitespace-nowrap" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                      {c.professionals?.name || 'Profissional'}
                    </td>
                    <td className="p-4 text-sm" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                      {c.bookings?.services?.name || 'Atendimento'}
                    </td>
                    <td className="p-4 text-sm text-right font-bold whitespace-nowrap" style={{ color: theme.error }}>
                      -{formatCurrencyBRL(Number(c.amount || 0))}
                    </td>
                    <td className="p-4 text-sm text-center whitespace-nowrap">
                      {c.status === 'pending' ? (
                        role !== 'professional' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setPayingId(c.id);
                              try {
                                await payMutation.mutateAsync(c.id);
                              } finally {
                                setPayingId(null);
                              }
                            }}
                            disabled={payingId === c.id}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            style={{
                              background: theme.accentGradient,
                              color: theme.btnPrimaryText,
                            }}
                          >
                            {payingId === c.id ? 'Baixando...' : 'Pagar Agora'}
                          </button>
                        ) : (
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ background: `${theme.warning}18`, color: theme.warning }}
                          >
                            A Receber
                          </span>
                        )
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                          style={{ background: `${theme.success}18`, color: theme.success }}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Pago
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
