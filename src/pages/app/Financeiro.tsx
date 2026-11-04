import { useState, useMemo } from 'react';
import {
  DollarSign, ArrowUpRight, ArrowDownRight, Download, Plus, Edit2, Trash2,
  Lock, AlertCircle, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { toast } from 'react-hot-toast';
import { ManualTransactionModal, type FinancialTransaction } from './financeiro/ManualTransactionModal';
import { UpgradeModal } from '../../components/UpgradeModal';
import { CommissionsTab } from './financeiro/CommissionsTab';
import { RecurringExpensesTab } from './financeiro/RecurringExpensesTab';

export default function Financeiro() {
  const { theme } = useTheme();
  const { tenant, role, professionalProfile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const engine = usePermissionEngine();
  const queryClient = useQueryClient();

  const isLight =
    theme.id === 'elegant' ||
    (theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(role === 'professional' ? professionalProfile?.id || null : null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeTab, setActiveTab] = useState<'fluxo' | 'comissoes' | 'despesas_fixas'>('fluxo');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const tenantId = tenant?.id;

  // 1. Fetch Professionals for Filter
  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['professionals_financeiro', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id, name, active, status')
        .eq('tenant_id', tenantId!);
      return (data || []).filter((p: any) => p.active !== false && (!p.status || p.status === 'active'));
    },
    enabled: !!tenantId
  });

  const professionals = role === 'professional' && professionalProfile
    ? allProfessionals.filter((p: any) => p.id === professionalProfile.id)
    : allProfessionals;

  // 2. Fetch Combined Financials (Payments, Refunds, Completed Bookings, and Manual Financial Transactions)
  const { data, isLoading } = useQuery({
    queryKey: ['financials_full', tenantId, currentMonth.getFullYear(), currentMonth.getMonth(), selectedProfessionalId],
    queryFn: async () => {
      if (!tenantId) return null;

      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

      let professionalBookingIds: string[] | null = null;
      if (role === 'professional' && selectedProfessionalId) {
        const { data: myBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('professional_id', selectedProfessionalId)
          .gte('scheduled_at', start)
          .lte('scheduled_at', end);
        professionalBookingIds = (myBookings || []).map((b: any) => b.id);
      }

      // (A) Fetch Payments (Entradas Online)
      let paymentsQuery = supabase
        .from('payments')
        .select(`
          *,
          bookings (
            id,
            customer_id,
            service_id,
            professional_id,
            customers (name),
            services (name)
          )
        `)
        .eq('tenant_id', tenantId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (professionalBookingIds !== null) {
        if (professionalBookingIds.length === 0) {
          paymentsQuery = paymentsQuery.in('booking_id', ['00000000-0000-0000-0000-000000000000']);
        } else {
          paymentsQuery = paymentsQuery.in('booking_id', professionalBookingIds);
        }
      }

      // (B) Fetch Refunds (Saídas Online)
      let refundsQuery = supabase
        .from('refunds')
        .select(`
          *,
          payments (
            id,
            booking_id,
            bookings (
              professional_id,
              customers (name),
              services (name)
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      // (C) Fetch Completed Bookings (Presencial / Balcão)
      let completedBookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          scheduled_at,
          amount_total,
          amount_paid,
          status,
          payment_mode,
          professional_id,
          customers (name),
          services (name)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      // (D) Fetch Manual Financial Transactions
      let manualTxQuery = supabase
        .from('financial_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (selectedProfessionalId) {
        completedBookingsQuery = completedBookingsQuery.eq('professional_id', selectedProfessionalId);
        manualTxQuery = manualTxQuery.eq('professional_id', selectedProfessionalId);
      }

      const [
        { data: payments },
        { data: refunds },
        { data: completedBookings },
        { data: manualTransactions }
      ] = await Promise.all([
        paymentsQuery,
        refundsQuery,
        completedBookingsQuery,
        manualTxQuery,
      ]);

      let entradas = 0;
      let saidas = 0;
      const transactions: any[] = [];

      // Process Online Payments (Ignorar 'pending' / 'failed' / 'canceled')
      payments?.forEach((p: any) => {
        if (selectedProfessionalId && p.bookings?.professional_id !== selectedProfessionalId) {
          return;
        }
        if (p.status !== 'succeeded' && p.status !== 'refunded') {
          return;
        }
        const netVal = Number(p.net_amount || p.amount || 0);
        entradas += netVal;

        const rawMethod = String(p.payment_method || '').toLowerCase();
        const methodLabel =
          rawMethod === 'pix'
            ? 'PIX (Online)'
            : rawMethod === 'card'
              ? 'Cartão (Online)'
              : p.payment_method || 'PIX / Cartão (Online)';

        transactions.push({
          id: p.id,
          type: 'income',
          amount: netVal,
          status: p.status,
          method: methodLabel,
          date: p.created_at,
          customer_name: p.bookings?.customers?.name || 'Cliente',
          description: p.bookings?.services?.name || 'Serviço Online',
          isManual: false,
        });
      });

      // Process Refunds
      refunds?.forEach((r: any) => {
        if (selectedProfessionalId && r.payments?.bookings?.professional_id !== selectedProfessionalId) {
          return;
        }
        if (r.status === 'succeeded') {
          saidas += Number(r.amount);
        }
        transactions.push({
          id: r.id,
          type: 'expense',
          amount: Number(r.amount),
          status: r.status,
          method: 'Estorno (Online)',
          date: r.created_at,
          customer_name: r.payments?.bookings?.customers?.name || 'Cliente',
          description: `Estorno: ${r.payments?.bookings?.services?.name || 'Serviço'}`,
          isManual: false,
        });
      });

      // Process Completed Bookings (Balcão / Saldo Presencial)
      completedBookings?.forEach((b: any) => {
        const mode = b.payment_mode || 'local';
        let localVal = 0;
        let method = 'Local (Balcão)';

        if (mode === 'local' || mode === 'pay_local') {
          localVal = Number(b.amount_total || b.amount_paid || 0);
          method = 'Local (Balcão)';
        } else if (mode === 'deposit' || mode === 'partial') {
          const total = Number(b.amount_total || 0);
          const succeededOnline = payments?.find((p: any) => p.booking_id === b.id && (p.status === 'succeeded' || p.status === 'refunded'));
          const onlinePaid = succeededOnline ? Number(succeededOnline.amount || 0) : (total * 0.5);
          localVal = Math.max(0, total - onlinePaid);
          method = 'Saldo Restante (Balcão)';
        } else if (mode === 'full') {
          const hasOnlineRecord = payments?.some((p: any) => p.booking_id === b.id && (p.status === 'succeeded' || p.status === 'refunded'));
          localVal = hasOnlineRecord ? 0 : Number(b.amount_total || 0);
          method = hasOnlineRecord ? 'Online' : 'Pago Integral';
        } else {
          localVal = Number(b.amount_total || b.amount_paid || 0);
        }

        if (localVal > 0) {
          entradas += localVal;
          transactions.push({
            id: b.id,
            type: 'income',
            amount: localVal,
            status: 'succeeded',
            method,
            date: b.scheduled_at,
            customer_name: b.customers?.name || 'Cliente',
            description: b.services?.name || 'Atendimento Concluído',
            professional_id: b.professional_id,
            isManual: false,
          });
        }
      });

      // Process Manual Transactions
      const startDate = new Date(start);
      const endDate = new Date(end);

      manualTransactions?.forEach((m: any) => {
        if (m.booking_id && m.type === 'income') return;

        const txDate = new Date(m.date || m.created_at);
        if (txDate < startDate || txDate > endDate) {
          return;
        }

        const val = Number(m.amount || 0);
        const isRealized = !m.status || m.status === 'succeeded' || m.status === 'approved';

        if (isRealized) {
          if (m.type === 'income') {
            entradas += val;
          } else {
            saidas += val;
          }
        }
        transactions.push({
          id: m.id,
          type: m.type,
          amount: val,
          status: m.status || 'succeeded',
          method: m.payment_method || 'Manual',
          date: m.date || m.created_at,
          customer_name: m.category || 'Manual',
          description: m.description,
          professional_id: m.professional_id,
          category: m.category,
          isManual: true,
        });
      });

      // Sort descending
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        entradas,
        saidas,
        liquido: entradas - saidas,
        transactions
      };
    },
    enabled: !!tenantId,
  });

  // 3. Mutations for Manual Transactions
  const saveTransactionMutation = useMutation({
    mutationFn: async (input: FinancialTransaction) => {
      if (!tenantId) return;
      if (input.id) {
        const { error } = await supabase
          .from('financial_transactions')
          .update({
            type: input.type,
            amount: input.amount,
            description: input.description,
            category: input.category,
            payment_method: input.payment_method,
            professional_id: input.professional_id,
            date: input.date,
          })
          .eq('id', input.id)
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financial_transactions')
          .insert({
            tenant_id: tenantId,
            type: input.type,
            amount: input.amount,
            description: input.description,
            category: input.category,
            payment_method: input.payment_method,
            professional_id: input.professional_id,
            date: input.date,
            status: 'succeeded',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      setModalOpen(false);
      setEditingTransaction(null);
      toast.success('Transação salva com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar transação');
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) return;
      const { error } = await supabase
        .from('financial_transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials_full', tenantId] });
      setDeletingTransaction(null);
      toast.success('Lançamento excluído com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir transação');
    }
  });

  // Filters and Pagination
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    let list = data.transactions;
    if (filterType !== 'all') {
      list = list.filter((t: any) => t.type === filterType);
    }
    return list;
  }, [data?.transactions, filterType]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleEditClick = (tx: any) => {
    if (!engine.hasPermission('financeiro.editar_lancamento')) {
      setShowUpgradeModal('financeiro.editar_lancamento');
      return;
    }
    setEditingTransaction({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category || 'Geral',
      payment_method: tx.method,
      professional_id: tx.professional_id || null,
      date: tx.date.split('T')[0],
    });
    setModalOpen(true);
  };

  const handleDeleteClick = (tx: any) => {
    if (!engine.hasPermission('financeiro.excluir_lancamento')) {
      setShowUpgradeModal('financeiro.excluir_lancamento');
      return;
    }
    setDeletingTransaction(tx);
  };

  const handleDeleteConfirm = async () => {
    if (deletingTransaction) {
      await deleteTransactionMutation.mutateAsync(deletingTransaction.id);
    }
  };

  const handleExport = () => {
    if (!engine.hasPermission('financeiro.exportar')) {
      setShowUpgradeModal('financeiro.exportar');
      return;
    }
    if (!data?.transactions || data.transactions.length === 0) return;

    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria/Origem', 'Forma', 'Valor'];
    const rows = filteredTransactions.map((t: any) => [
      `"${format(new Date(t.date), 'dd/MM/yyyy HH:mm')}"`,
      `"${t.type === 'income' ? 'Receita' : 'Despesa'}"`,
      `"${t.description || ''}"`,
      `"${t.customer_name || ''}"`,
      `"${t.method || ''}"`,
      `"${t.type === 'income' ? '' : '-'}${t.amount}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_financeiro_${tenant?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="relative min-h-[600px] w-full">
        <div className="space-y-6 h-full flex flex-col animate-fade-in pb-12">

          {/* HEADER */}
          <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Gestão</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Financeiro & Fluxo de Caixa</h1>
              <p className="text-sm mt-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Controle de receitas, despesas, comissões e gastos fixos.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Dynamic Month Selector */}
              <div
                className="flex items-center gap-1 p-1 rounded-xl border shadow-sm"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                }}
              >
                <button
                  onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-black/5"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold capitalize px-3 min-w-[130px] text-center" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <button
                  onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-black/5"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleExport}
                className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer"
                style={{
                  borderColor: isLight ? '#CBD5E1' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                  color: isLight ? '#0F172A' : theme.textPrimary,
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Exportar
              </button>

              {engine.hasPermission('financeiro.criar_lancamento') && (
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:opacity-90 active:scale-[0.98] w-full md:w-auto justify-center cursor-pointer"
                  style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                >
                  <Plus className="w-5 h-5" />
                  Nova Transação
                </button>
              )}
            </div>
          </header>

          {/* TABS */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b" style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}>
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`px-4 py-2 font-bold text-sm transition-all whitespace-nowrap rounded-t-lg cursor-pointer ${activeTab === 'fluxo' ? 'border-b-2' : 'opacity-70 hover:opacity-100'}`}
              style={{ 
                color: activeTab === 'fluxo' ? theme.accent : (isLight ? '#475569' : theme.textSecondary),
                borderColor: activeTab === 'fluxo' ? theme.accent : 'transparent'
              }}
            >
              Fluxo de Caixa (DRE)
            </button>
            <button
              onClick={() => setActiveTab('comissoes')}
              className={`px-4 py-2 font-bold text-sm transition-all whitespace-nowrap rounded-t-lg cursor-pointer ${activeTab === 'comissoes' ? 'border-b-2' : 'opacity-70 hover:opacity-100'}`}
              style={{ 
                color: activeTab === 'comissoes' ? theme.accent : (isLight ? '#475569' : theme.textSecondary),
                borderColor: activeTab === 'comissoes' ? theme.accent : 'transparent'
              }}
            >
              Comissões a Pagar
            </button>
            <button
              onClick={() => setActiveTab('despesas_fixas')}
              className={`px-4 py-2 font-bold text-sm transition-all whitespace-nowrap rounded-t-lg cursor-pointer ${activeTab === 'despesas_fixas' ? 'border-b-2' : 'opacity-70 hover:opacity-100'}`}
              style={{ 
                color: activeTab === 'despesas_fixas' ? theme.accent : (isLight ? '#475569' : theme.textSecondary),
                borderColor: activeTab === 'despesas_fixas' ? theme.accent : 'transparent'
              }}
            >
              Gastos Fixos
            </button>
          </div>

          {activeTab === 'comissoes' && tenantId && (
            engine.hasPermission('equipe.ver_comissoes') ? (
              <CommissionsTab tenantId={tenantId} role={role} professionalId={professionalProfile?.id || null} />
            ) : (
              <div
                className="flex flex-col items-center justify-center p-12 text-center h-64 border rounded-2xl"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                }}
              >
                <Lock className="w-12 h-12 mb-4 opacity-50" style={{ color: isLight ? '#64748B' : theme.textSecondary }} />
                <h3 className="text-lg font-bold mb-2" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Acesso Restrito</h3>
                <p className="text-sm opacity-80 max-w-sm" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Você não tem permissão para visualizar as comissões.
                </p>
              </div>
            )
          )}

          {activeTab === 'despesas_fixas' && tenantId && (
            <RecurringExpensesTab tenantId={tenantId} />
          )}

          {activeTab === 'fluxo' && (
            <div className="space-y-8">
              {/* Professional Filter Bar */}
              {professionals.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-xs font-bold shrink-0 mr-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Filtrar Caixa:</span>
                  {role !== 'professional' && (
                    <button
                      onClick={() => {
                        if (!engine.hasPermission('financeiro.visualizar_caixa_geral')) {
                          setShowUpgradeModal('financeiro.visualizar_caixa_geral');
                          return;
                        }
                        setSelectedProfessionalId(null);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                      style={{
                        color: selectedProfessionalId === null ? theme.btnPrimaryText : (isLight ? '#334155' : theme.textSecondary),
                        background: selectedProfessionalId === null ? theme.accentGradient : (isLight ? '#FFFFFF' : theme.cardBg),
                        borderColor: selectedProfessionalId === null ? theme.accent : (isLight ? '#E2E8F0' : theme.cardBorder),
                        boxShadow: selectedProfessionalId === null ? theme.shadowAccent : 'none',
                      }}
                    >
                      Caixa Geral (Todos)
                    </button>
                  )}
                  {professionals.map((p: any) => {
                    const isSelected = selectedProfessionalId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfessionalId(isSelected ? null : p.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                        style={{
                          color: isSelected ? theme.btnPrimaryText : (isLight ? '#334155' : theme.textSecondary),
                          background: isSelected ? theme.accentGradient : (isLight ? '#FFFFFF' : theme.cardBg),
                          borderColor: isSelected ? theme.accent : (isLight ? '#E2E8F0' : theme.border),
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  className="p-6 rounded-2xl border transition-all"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#10b98115', color: '#10b981' }}>
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 border rounded-full"
                      style={{
                        background: isLight ? '#F1F5F9' : theme.inputBg,
                        borderColor: isLight ? '#E2E8F0' : theme.border,
                        color: isLight ? '#475569' : theme.textSecondary,
                      }}
                    >
                      {format(currentMonth, "MMM 'yy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Entradas Totais (Receitas)</p>
                  <h3 className="text-3xl font-bold tracking-tight" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                    {isLoading ? <div className="h-9 w-32 skeleton skeleton-text mt-1" /> : money(data?.entradas || 0)}
                  </h3>
                </div>

                <div
                  className="p-6 rounded-2xl border transition-all"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#ef444415', color: '#ef4444' }}>
                      <ArrowDownRight className="w-6 h-6" />
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 border rounded-full"
                      style={{
                        background: isLight ? '#F1F5F9' : theme.inputBg,
                        borderColor: isLight ? '#E2E8F0' : theme.border,
                        color: isLight ? '#475569' : theme.textSecondary,
                      }}
                    >
                      {format(currentMonth, "MMM 'yy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Saídas Totais (Despesas/Estornos)</p>
                  <h3 className="text-3xl font-bold tracking-tight" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                    {isLoading ? <div className="h-9 w-32 skeleton skeleton-text mt-1" /> : money(data?.saidas || 0)}
                  </h3>
                </div>

                <div className="p-6 rounded-2xl border relative overflow-hidden shadow-md" style={{ background: theme.accentGradient, borderColor: theme.accent, color: theme.btnPrimaryText }}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-black/10 flex items-center justify-center backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-black/20 rounded-full backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>Resultado</span>
                  </div>
                  <p className="text-sm font-bold opacity-90 mb-1 relative z-10">Lucro Líquido</p>
                  <h3 className="text-3xl font-black relative z-10 tracking-tight">
                    {isLoading ? <div className="h-9 w-32 bg-white/20 rounded animate-pulse mt-1" /> : money(data?.liquido || 0)}
                  </h3>
                </div>
              </div>

              {/* LISTA DE TRANSAÇÕES */}
              <div
                className="border rounded-2xl flex-1 p-6 transition-all"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                  boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                  <h3 className="font-bold text-lg" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Lançamentos & Transações</h3>

                  {/* Type Filters */}
                  <div
                    className="flex gap-1 p-1 rounded-xl border text-xs"
                    style={{
                      borderColor: isLight ? '#E2E8F0' : theme.border,
                      background: isLight ? '#F8FAFC' : theme.inputBg,
                    }}
                  >
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'income', label: 'Receitas' },
                      { id: 'expense', label: 'Despesas' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterType(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${filterType === tab.id ? 'shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                        style={{
                          background: filterType === tab.id ? theme.accentGradient : 'transparent',
                          color: filterType === tab.id ? theme.btnPrimaryText : (isLight ? '#475569' : theme.textSecondary),
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  {isLoading ? (
                    <table className="w-full text-left">
                      <tbody>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <TableRowSkeleton key={i} cols={5} />
                        ))}
                      </tbody>
                    </table>
                  ) : filteredTransactions.length === 0 ? (
                    <div
                      className="text-center py-14 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center"
                      style={{
                        borderColor: isLight ? '#E2E8F0' : theme.border,
                        color: isLight ? '#64748B' : theme.textSecondary,
                        background: isLight ? '#F8FAFC' : 'transparent',
                      }}
                    >
                      <p className="font-bold text-base mb-1" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Nenhum lançamento encontrado neste período.</p>
                      <p className="text-xs font-medium">Os pagamentos online confirmados, agendamentos concluídos e transações manuais aparecerão aqui automaticamente.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b" style={{ borderColor: isLight ? '#E2E8F0' : theme.border, color: isLight ? '#64748B' : theme.textSecondary }}>
                          <th className="py-3 px-4 font-semibold">Data</th>
                          <th className="py-3 px-4 font-semibold">Descrição</th>
                          <th className="py-3 px-4 font-semibold">Origem / Categoria</th>
                          <th className="py-3 px-4 font-semibold">Forma / Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Valor</th>
                          <th className="py-3 px-4 font-semibold text-center w-20">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((tx: any) => (
                          <tr
                            key={tx.id}
                            className="border-b last:border-b-0 hover:bg-black/5 transition-colors"
                            style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                          >
                            <td className="py-4 px-4 font-medium whitespace-nowrap" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                              {format(new Date(tx.date), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                            </td>
                            <td className="py-4 px-4 font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                              {tx.description}
                            </td>
                            <td className="py-4 px-4 font-medium" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                              {tx.customer_name}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  background: tx.type === 'income' ? (isLight ? '#DCFCE7' : 'rgba(16, 185, 129, 0.15)') : (isLight ? '#FEE2E2' : 'rgba(239, 68, 68, 0.15)'),
                                  color: tx.type === 'income' ? (isLight ? '#15803D' : '#10b981') : (isLight ? '#B91C1C' : '#ef4444'),
                                  border: `1px solid ${tx.type === 'income' ? (isLight ? '#86EFAC' : 'rgba(16, 185, 129, 0.3)') : (isLight ? '#FCA5A5' : 'rgba(239, 68, 68, 0.3)')}`
                                }}
                              >
                                {tx.method}
                              </span>
                            </td>
                            <td className={`py-4 px-4 text-right font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {tx.type === 'income' ? '+' : '-'}{money(tx.amount)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {tx.isManual ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleEditClick(tx)}
                                    className="p-1.5 rounded-lg border hover:bg-black/5 transition-colors cursor-pointer"
                                    style={{ borderColor: isLight ? '#CBD5E1' : theme.border, color: isLight ? '#334155' : theme.textSecondary }}
                                    title="Editar Lançamento"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(tx)}
                                    className="p-1.5 rounded-lg border hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    style={{ borderColor: '#ef444440', color: '#ef4444' }}
                                    title="Excluir Lançamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] uppercase font-bold tracking-wider opacity-50" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>Automático</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Pagination Controls */}
                  {filteredTransactions.length > 0 && (
                    <div className="pt-6 border-t mt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}>
                      <p className="text-xs font-medium" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                        Mostrando <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{(currentPage - 1) * PAGE_SIZE + 1}</strong> a <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)}</strong> de <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{filteredTransactions.length}</strong> transações
                      </p>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
                          style={{ borderColor: isLight ? '#CBD5E1' : theme.border, color: isLight ? '#0F172A' : theme.textPrimary }}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                        </button>

                        {Array.from({ length: totalPages }).map((_, i) => {
                          const pageNum = i + 1;
                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            const isActive = pageNum === currentPage;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive ? 'shadow-sm' : 'hover:bg-black/5'}`}
                                style={{
                                  background: isActive ? theme.accentGradient : 'transparent',
                                  color: isActive ? theme.btnPrimaryText : (isLight ? '#334155' : theme.textSecondary),
                                  border: `1px solid ${isActive ? theme.accent : (isLight ? '#CBD5E1' : theme.border)}`
                                }}
                              >
                                {pageNum}
                              </button>
                            );
                          } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                            return <span key={pageNum} className="px-1 text-xs opacity-50">...</span>;
                          }
                          return null;
                        })}

                        <button
                          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
                          style={{ borderColor: isLight ? '#CBD5E1' : theme.border, color: isLight ? '#0F172A' : theme.textPrimary }}
                        >
                          Próximo <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal de Lançamento Manual ── */}
        <ManualTransactionModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingTransaction(null); }}
          onSave={async tx => {
            await saveTransactionMutation.mutateAsync(tx);
          }}
          transaction={editingTransaction}
          tenantId={tenantId || ''}
          isLoading={saveTransactionMutation.isPending}
        />

        {/* ── Modal: Delete Confirmation ── */}
        {deletingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
              className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#FFFFFF' : theme.cardBg,
              }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `${theme.error}10`, color: theme.error }}>
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-2" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Excluir Lançamento?</h3>
              <p className="text-sm mb-7 font-medium" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{deletingTransaction.description}</strong> será removido do fluxo de caixa. Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingTransaction(null)}
                  className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all cursor-pointer hover:bg-black/5"
                  style={{ borderColor: isLight ? '#CBD5E1' : theme.border, color: isLight ? '#0F172A' : theme.textPrimary }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteTransactionMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white cursor-pointer shadow-md hover:opacity-90"
                  style={{ background: theme.error }}
                >
                  {deleteTransactionMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Upgrade Plan ── */}
        {showUpgradeModal && (
          <UpgradeModal 
            feature={showUpgradeModal} 
            onClose={() => setShowUpgradeModal(null)} 
          />
        )}
      </div>
    </>
  );
}
