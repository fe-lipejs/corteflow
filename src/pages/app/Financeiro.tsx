import { useState, useMemo } from 'react';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Plus,
  Edit2,
  Trash2,
  Lock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarClock,
  Receipt,
  AlertTriangle,
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
import {
  ManualTransactionModal,
  type FinancialTransaction,
} from './financeiro/ManualTransactionModal';
import { UpgradeModal } from '../../components/UpgradeModal';
import { CommissionsTab } from './financeiro/CommissionsTab';
import { ExpensesHubTab, type ExpensesSubTab } from './financeiro/ExpensesHubTab';
import { UpcomingExpensesCard } from './financeiro/UpcomingExpensesCard';
import { FinancialAnalyticsSection } from './financeiro/FinancialAnalyticsSection';
import { PayObligationModal } from './financeiro/PayObligationModal';
import {
  diffDaysFromToday,
  ensureRecurringPayables,
  fetchExpensePayables,
  fetchSixMonthEvolution,
  formatCurrencyBRL,
  getRemainingAmount,
  payExpensePayable,
  saveVariableExpense,
  toDateOnlyISO,
} from '../../services/financialService';
import type {
  CategoryBreakdownItem,
  ExpensePayable,
  PayObligationInput,
} from '../../types/financial';

export default function Financeiro() {
  const { theme } = useTheme();
  const { tenant, role, professionalProfile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const engine = usePermissionEngine();
  const queryClient = useQueryClient();

  const isLight =
    theme.id === 'elegant' ||
    Boolean(theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null);
  const [payingObligation, setPayingObligation] = useState<ExpensePayable | null>(null);

  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(
    role === 'professional' ? professionalProfile?.id || null : null
  );
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeTab, setActiveTab] = useState<'fluxo' | 'comissoes' | 'despesas'>('fluxo');
  const [expensesInitialSubTab, setExpensesInitialSubTab] = useState<ExpensesSubTab>('contas_a_pagar');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const tenantId = tenant?.id;

  const invalidateAllFinancials = () => {
    if (!tenantId) return;
    queryClient.invalidateQueries({ queryKey: ['financials_full', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['expense_payables', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['recurring_expenses', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['financial_evolution', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['commissions', tenantId] });
  };

  // 1. Profissionais para filtro de caixa
  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['professionals_financeiro', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id, name, active, status')
        .eq('tenant_id', tenantId!);
      return (data || []).filter(
        (p: any) => p.active !== false && (!p.status || p.status === 'active')
      );
    },
    enabled: !!tenantId,
  });

  const professionals =
    role === 'professional' && professionalProfile
      ? allProfessionals.filter((p: any) => p.id === professionalProfile.id)
      : allProfessionals;

  // 2. Obrigações Financeiras (Gastos Fixos gerados + Gastos Variáveis)
  const { data: payables = [] } = useQuery({
    queryKey: [
      'expense_payables',
      tenantId,
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      selectedProfessionalId,
    ],
    queryFn: async () => {
      if (!tenantId) return [];
      await ensureRecurringPayables(tenantId, currentMonth);
      return fetchExpensePayables(tenantId, selectedProfessionalId);
    },
    enabled: !!tenantId,
  });

  // 3. Evolução de 6 meses (Receitas x Despesas pagas)
  const { data: monthlyEvolution = [] } = useQuery({
    queryKey: [
      'financial_evolution',
      tenantId,
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      selectedProfessionalId,
    ],
    queryFn: () => fetchSixMonthEvolution(tenantId!, currentMonth, selectedProfessionalId),
    enabled: !!tenantId,
  });

  // 4. Movimentações Realizadas do Fluxo de Caixa no Mês
  const { data, isLoading } = useQuery({
    queryKey: [
      'financials_full',
      tenantId,
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      selectedProfessionalId,
    ],
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
          .eq('professional_id', selectedProfessionalId);
        professionalBookingIds = (myBookings || []).map((b: any) => b.id);
      }

      // (A) Pagamentos Online Confirmados
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

      // (B) Estornos Online Confirmados
      const refundsQuery = supabase
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

      // (C) Atendimentos Concluídos (Presencial / Saldo no Balcão)
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

      // (D) Lançamentos Financeiros (Manuais, Comissões Pagas e Despesas Quitadas)
      let manualTxQuery = supabase
        .from('financial_transactions')
        .select('*, expense_payables(expense_type)')
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
        { data: manualTransactions },
      ] = await Promise.all([
        paymentsQuery,
        refundsQuery,
        completedBookingsQuery,
        manualTxQuery,
      ]);

      let entradas = 0;
      let saidas = 0;
      let fixedPaidAmount = 0;
      let variablePaidAmount = 0;
      let otherPaidOutflows = 0;
      const categoryTotals = new Map<string, { amount: number; count: number }>();
      const transactions: any[] = [];

      // Processar Entradas Online
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

      // Processar Estornos Confirmados
      refunds?.forEach((r: any) => {
        if (
          selectedProfessionalId &&
          r.payments?.bookings?.professional_id !== selectedProfessionalId
        ) {
          return;
        }
        if (r.status !== 'succeeded') return;

        const val = Number(r.amount || 0);
        saidas += val;
        otherPaidOutflows += val;

        transactions.push({
          id: r.id,
          type: 'expense',
          amount: val,
          status: r.status,
          method: 'Estorno (Online)',
          date: r.created_at,
          customer_name: r.payments?.bookings?.customers?.name || 'Cliente',
          description: `Estorno: ${r.payments?.bookings?.services?.name || 'Serviço'}`,
          category: 'Estornos',
          isManual: false,
        });
      });

      // Processar Atendimentos Concluídos (Balcão)
      completedBookings?.forEach((b: any) => {
        const mode = b.payment_mode || 'local';
        let localVal = 0;
        let method = 'Local (Balcão)';

        if (mode === 'local' || mode === 'pay_local') {
          localVal = Number(b.amount_total || b.amount_paid || 0);
          method = 'Local (Balcão)';
        } else if (mode === 'deposit' || mode === 'partial' || mode === 'partial_50') {
          const total = Number(b.amount_total || 0);
          const succeededOnline = payments?.find(
            (p: any) =>
              p.booking_id === b.id && (p.status === 'succeeded' || p.status === 'refunded')
          );
          const onlinePaid = succeededOnline ? Number(succeededOnline.amount || 0) : total * 0.5;
          localVal = Math.max(0, total - onlinePaid);
          method = 'Saldo Restante (Balcão)';
        } else if (mode === 'full' || mode === 'full_100') {
          const hasOnlineRecord = payments?.some(
            (p: any) =>
              p.booking_id === b.id && (p.status === 'succeeded' || p.status === 'refunded')
          );
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

      // Processar Lançamentos Realizados em financial_transactions
      // REGRA DE OURO: obrigações/comissões pendentes ou rejeitadas NÃO entram nas saídas realizadas do caixa!
      const startDate = new Date(start);
      const endDate = new Date(end);

      manualTransactions?.forEach((m: any) => {
        if (m.booking_id && m.type === 'income') return;

        const isRealized =
          !m.status ||
          m.status === 'succeeded' ||
          m.status === 'approved' ||
          m.status === 'completed';

        if (!isRealized) {
          return;
        }

        const effectiveDateStr = m.date || m.created_at;
        const txDate = new Date(effectiveDateStr);
        if (txDate < startDate || txDate > endDate) {
          return;
        }

        const val = Number(m.amount || 0);

        if (m.type === 'income') {
          entradas += val;
        } else {
          saidas += val;
          const catName = m.category || 'Outras Despesas';
          const linkedType = m.expense_payables?.expense_type;

          if (catName === 'Comissão') {
            otherPaidOutflows += val;
          } else if (m.recurring_expense_id || linkedType === 'fixed') {
            fixedPaidAmount += val;
            const prev = categoryTotals.get(catName) || { amount: 0, count: 0 };
            categoryTotals.set(catName, { amount: prev.amount + val, count: prev.count + 1 });
          } else {
            variablePaidAmount += val;
            const prev = categoryTotals.get(catName) || { amount: 0, count: 0 };
            categoryTotals.set(catName, { amount: prev.amount + val, count: prev.count + 1 });
          }
        }

        const isCommissionRow = m.category === 'Comissão' && Boolean(m.booking_id);

        transactions.push({
          id: m.id,
          payable_id: m.payable_id || null,
          type: m.type,
          amount: val,
          status: m.status || 'succeeded',
          method: m.payment_method || (isCommissionRow ? 'Repasse Equipe' : 'Manual'),
          date: effectiveDateStr,
          customer_name: m.category || 'Geral',
          description: m.description,
          professional_id: m.professional_id,
          category: m.category,
          notes: m.notes || null,
          isManual: !isCommissionRow,
        });
      });

      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalCategorized = Array.from(categoryTotals.values()).reduce(
        (acc, item) => acc + item.amount,
        0
      );

      const categoryBreakdown: CategoryBreakdownItem[] = Array.from(categoryTotals.entries())
        .map(([category, info]) => ({
          category,
          amount: info.amount,
          count: info.count,
          percentage: totalCategorized > 0 ? (info.amount / totalCategorized) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        entradas,
        saidas,
        resultadoCaixa: entradas - saidas,
        fixedPaidAmount,
        variablePaidAmount,
        otherPaidOutflows,
        categoryBreakdown,
        transactions,
      };
    },
    enabled: !!tenantId,
  });

  // Indicadores de Obrigações Pendentes (separados do caixa realizado!)
  const obligationsMetrics = useMemo(() => {
    const open = payables.filter((p) => p.status !== 'paid' && p.status !== 'canceled');
    let contasAPagarTotal = 0;
    let proximosVencimentosCount = 0;
    let proximosVencimentosAmount = 0;
    let atrasadasCount = 0;
    let atrasadasAmount = 0;

    open.forEach((p) => {
      const rem = getRemainingAmount(p);
      const diff = diffDaysFromToday(p.due_date);
      contasAPagarTotal += rem;

      if (diff < 0) {
        atrasadasCount += 1;
        atrasadasAmount += rem;
      } else if (diff <= 7) {
        proximosVencimentosCount += 1;
        proximosVencimentosAmount += rem;
      }
    });

    return {
      openCount: open.length,
      contasAPagarTotal,
      proximosVencimentosCount,
      proximosVencimentosAmount,
      atrasadasCount,
      atrasadasAmount,
      alertCount: atrasadasCount + open.filter((p) => diffDaysFromToday(p.due_date) === 0).length,
    };
  }, [payables]);

  // Mutations para lançamentos manuais e quitação rápida no Fluxo de Caixa
  const saveTransactionMutation = useMutation({
    mutationFn: async (input: FinancialTransaction) => {
      if (!tenantId) return;

      // Novo gasto criado a partir do botão "+ Novo Lançamento" -> integra com expense_payables!
      if (!input.id && input.type === 'expense') {
        const txDateISO = toDateOnlyISO(input.date);
        await saveVariableExpense(tenantId, {
          description: input.description,
          category: input.category,
          amount: input.amount,
          purchase_date: txDateISO,
          due_date: input.due_date || txDateISO,
          payment_method: input.payment_method,
          initial_status: input.expense_status === 'pending' ? 'pending' : 'paid',
          paid_at: txDateISO,
          professional_id: input.professional_id || null,
          notes: input.notes || null,
        });
        return;
      }

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
            notes: input.notes || null,
          })
          .eq('id', input.id)
          .eq('tenant_id', tenantId);
        if (error) throw error;

        // Se estava vinculado a uma obrigação em expense_payables, mantém sincronizado
        if (input.payable_id) {
          await supabase
            .from('expense_payables')
            .update({
              description: input.description,
              category: input.category,
              expected_amount: input.amount,
              paid_amount: input.amount,
              paid_at: toDateOnlyISO(input.date),
              payment_method: input.payment_method,
              professional_id: input.professional_id || null,
            })
            .eq('id', input.payable_id)
            .eq('tenant_id', tenantId);

          await supabase
            .from('expense_payments')
            .update({
              amount: input.amount,
              paid_at: toDateOnlyISO(input.date),
              payment_method: input.payment_method,
            })
            .eq('financial_transaction_id', input.id)
            .eq('tenant_id', tenantId);
        }
      } else {
        const { error } = await supabase.from('financial_transactions').insert({
          tenant_id: tenantId,
          type: input.type,
          amount: input.amount,
          description: input.description,
          category: input.category,
          payment_method: input.payment_method,
          professional_id: input.professional_id,
          date: input.date,
          notes: input.notes || null,
          status: 'succeeded',
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      invalidateAllFinancials();
      setModalOpen(false);
      setEditingTransaction(null);
      if (!vars.id && vars.type === 'expense' && vars.expense_status === 'pending') {
        toast.success('Despesa salva em Contas a Pagar!');
      } else {
        toast.success('Lançamento salvo com sucesso!');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao salvar transação.');
    },
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
      invalidateAllFinancials();
      setDeletingTransaction(null);
      toast.success('Lançamento excluído com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao excluir transação.');
    },
  });

  const quickPayMutation = useMutation({
    mutationFn: (input: PayObligationInput) => payExpensePayable(input),
    onSuccess: () => {
      invalidateAllFinancials();
      toast.success('Despesa paga e lançada nas saídas do caixa!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao quitar despesa.');
    },
  });

  // Filtros e Paginação da Lista de Movimentações
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (filterType === 'all') return data.transactions;
    return data.transactions.filter((t: any) => t.type === filterType);
  }, [data?.transactions, filterType]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const handleEditClick = (tx: any) => {
    if (!engine.hasPermission('financeiro.editar_lancamento')) {
      setShowUpgradeModal('financeiro.editar_lancamento');
      return;
    }
    setEditingTransaction({
      id: tx.id,
      payable_id: tx.payable_id || null,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category || 'Geral',
      payment_method: tx.method,
      professional_id: tx.professional_id || null,
      date: toDateOnlyISO(tx.date),
      notes: tx.notes || null,
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

  const openContasAPagar = () => {
    setExpensesInitialSubTab('contas_a_pagar');
    setActiveTab('despesas');
  };

  const handleExport = () => {
    if (!engine.hasPermission('financeiro.exportar')) {
      setShowUpgradeModal('financeiro.exportar');
      return;
    }
    if (!data?.transactions || data.transactions.length === 0) {
      toast('Nenhum lançamento realizado neste período para exportar.', { icon: 'ℹ️' });
      return;
    }

    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria/Origem', 'Forma', 'Valor'];
    const rows = filteredTransactions.map((t: any) => [
      `"${format(new Date(t.date), 'dd/MM/yyyy HH:mm')}"`,
      `"${t.type === 'income' ? 'Receita' : 'Despesa'}"`,
      `"${String(t.description || '').replace(/"/g, '""')}"`,
      `"${String(t.customer_name || '').replace(/"/g, '""')}"`,
      `"${String(t.method || '').replace(/"/g, '""')}"`,
      `"${t.type === 'income' ? '' : '-'}${t.amount}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `financeiro_${format(currentMonth, 'yyyy_MM')}_${tenant?.slug || 'salao'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="relative min-h-[600px] w-full">
        <div className="space-y-5 sm:space-y-6 h-full flex flex-col animate-fade-in pb-12">
          {/* HEADER MOBILE-FIRST */}
          <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-3.5">
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: isLight ? '#64748B' : theme.textSecondary }}
              >
                Gestão Financeira
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
              >
                Financeiro & Fluxo de Caixa
              </h1>
              <p
                className="text-xs sm:text-sm mt-0.5"
                style={{ color: isLight ? '#475569' : theme.textSecondary }}
              >
                Acompanhe entradas, despesas, contas a pagar e comissões com clareza.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Seletor de Mês */}
              <div
                className="flex items-center justify-between gap-1 p-1 rounded-xl border shadow-sm flex-1 sm:flex-initial"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                }}
              >
                <button
                  onClick={() => {
                    setCurrentMonth((prev) => subMonths(prev, 1));
                    setCurrentPage(1);
                  }}
                  className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-black/5"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span
                  className="text-xs font-bold capitalize px-2 min-w-[128px] text-center"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                >
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <button
                  onClick={() => {
                    setCurrentMonth((prev) => addMonths(prev, 1));
                    setCurrentPage(1);
                  }}
                  className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-black/5"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleExport}
                className="flex items-center justify-center px-3.5 py-2.5 border rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
                style={{
                  borderColor: isLight ? '#CBD5E1' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                  color: isLight ? '#0F172A' : theme.textPrimary,
                }}
              >
                <Download className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Exportar</span>
              </button>

              {engine.hasPermission('financeiro.criar_lancamento') && (
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all hover:opacity-95 active:scale-[0.98] w-full sm:w-auto justify-center cursor-pointer"
                  style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Lançamento</span>
                </button>
              )}
            </div>
          </header>

          {/* NAVEGAÇÃO DAS 3 ÁREAS PRINCIPAIS */}
          <div
            className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none border-b"
            style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}
          >
            <button
              onClick={() => setActiveTab('fluxo')}
              className={`px-3.5 sm:px-4 py-2.5 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'fluxo' ? 'border-b-2' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                color: activeTab === 'fluxo' ? theme.accent : isLight ? '#475569' : theme.textSecondary,
                borderColor: activeTab === 'fluxo' ? theme.accent : 'transparent',
              }}
            >
              Fluxo de Caixa
            </button>

            <button
              onClick={() => setActiveTab('comissoes')}
              className={`px-3.5 sm:px-4 py-2.5 font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'comissoes' ? 'border-b-2' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                color:
                  activeTab === 'comissoes' ? theme.accent : isLight ? '#475569' : theme.textSecondary,
                borderColor: activeTab === 'comissoes' ? theme.accent : 'transparent',
              }}
            >
              Comissões a Pagar
            </button>

            <button
              onClick={() => setActiveTab('despesas')}
              className={`px-3.5 sm:px-4 py-2.5 font-bold text-xs sm:text-sm transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'despesas' ? 'border-b-2' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                color:
                  activeTab === 'despesas' ? theme.accent : isLight ? '#475569' : theme.textSecondary,
                borderColor: activeTab === 'despesas' ? theme.accent : 'transparent',
              }}
            >
              <span>Despesas</span>
              {obligationsMetrics.alertCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none"
                  style={{
                    background:
                      obligationsMetrics.atrasadasCount > 0
                        ? `${theme.error}20`
                        : `${theme.warning}25`,
                    color:
                      obligationsMetrics.atrasadasCount > 0 ? theme.error : theme.warning,
                  }}
                >
                  {obligationsMetrics.alertCount}
                </span>
              )}
            </button>
          </div>

          {/* =================================================================
              ÁREA 2: COMISSÕES A PAGAR
             ================================================================= */}
          {activeTab === 'comissoes' &&
            tenantId &&
            (engine.hasPermission('equipe.ver_comissoes') ? (
              <CommissionsTab
                tenantId={tenantId}
                currentMonth={currentMonth}
                role={role}
                professionalId={professionalProfile?.id || null}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center p-12 text-center h-64 border rounded-2xl"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                }}
              >
                <Lock
                  className="w-12 h-12 mb-4 opacity-50"
                  style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                />
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                >
                  Acesso Restrito
                </h3>
                <p
                  className="text-sm opacity-80 max-w-sm"
                  style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                >
                  Você não tem permissão para visualizar as comissões.
                </p>
              </div>
            ))}

          {/* =================================================================
              ÁREA 3: DESPESAS (CONTAS A PAGAR + GASTOS FIXOS + GASTOS VARIÁVEIS)
             ================================================================= */}
          {activeTab === 'despesas' && tenantId && (
            <ExpensesHubTab
              tenantId={tenantId}
              currentMonth={currentMonth}
              initialSubTab={expensesInitialSubTab}
              selectedProfessionalId={selectedProfessionalId}
              canCreate={engine.hasPermission('financeiro.criar_lancamento')}
              canEdit={engine.hasPermission('financeiro.editar_lancamento')}
              canDelete={engine.hasPermission('financeiro.excluir_lancamento')}
              onRequirePermission={(perm) => setShowUpgradeModal(perm)}
            />
          )}

          {/* =================================================================
              ÁREA 1: FLUXO DE CAIXA — CENTRAL FINANCEIRA
             ================================================================= */}
          {activeTab === 'fluxo' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Filtro por Profissional */}
              {professionals.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <span
                    className="text-xs font-bold shrink-0 mr-1"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Caixa:
                  </span>
                  {role !== 'professional' && (
                    <button
                      onClick={() => {
                        if (!engine.hasPermission('financeiro.visualizar_caixa_geral')) {
                          setShowUpgradeModal('financeiro.visualizar_caixa_geral');
                          return;
                        }
                        setSelectedProfessionalId(null);
                        setCurrentPage(1);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                      style={{
                        color:
                          selectedProfessionalId === null
                            ? theme.btnPrimaryText
                            : isLight
                              ? '#334155'
                              : theme.textSecondary,
                        background:
                          selectedProfessionalId === null
                            ? theme.accentGradient
                            : isLight
                              ? '#FFFFFF'
                              : theme.cardBg,
                        borderColor:
                          selectedProfessionalId === null
                            ? theme.accent
                            : isLight
                              ? '#E2E8F0'
                              : theme.cardBorder,
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
                        onClick={() => {
                          setSelectedProfessionalId(isSelected ? null : p.id);
                          setCurrentPage(1);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                        style={{
                          color: isSelected
                            ? theme.btnPrimaryText
                            : isLight
                              ? '#334155'
                              : theme.textSecondary,
                          background: isSelected
                            ? theme.accentGradient
                            : isLight
                              ? '#FFFFFF'
                              : theme.cardBg,
                          borderColor: isSelected
                            ? theme.accent
                            : isLight
                              ? '#E2E8F0'
                              : theme.border,
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2.1 INDICADORES FINANCEIROS (Grid Compacto 2 colunas no Smartphone, 3 no Desktop) */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* 1. Entradas recebidas */}
                <div
                  className="p-4 sm:p-5 rounded-2xl border transition-all"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <div className="flex justify-between items-center mb-2.5">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${theme.success}18`, color: theme.success }}
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize"
                      style={{
                        background: isLight ? '#F8FAFC' : theme.inputBg,
                        borderColor: isLight ? '#E2E8F0' : theme.border,
                        color: isLight ? '#64748B' : theme.textSecondary,
                      }}
                    >
                      {format(currentMonth, "MMM 'yy", { locale: ptBR })}
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Entradas recebidas
                  </p>
                  <h3
                    className="text-lg sm:text-2xl font-extrabold tracking-tight truncate"
                    style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  >
                    {isLoading ? (
                      <div className="h-7 w-24 skeleton skeleton-text mt-1" />
                    ) : (
                      formatCurrencyBRL(data?.entradas || 0)
                    )}
                  </h3>
                </div>

                {/* 2. Despesas pagas */}
                <div
                  className="p-4 sm:p-5 rounded-2xl border transition-all"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                    boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <div className="flex justify-between items-center mb-2.5">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${theme.error}18`, color: theme.error }}
                    >
                      <ArrowDownRight className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize"
                      style={{
                        background: isLight ? '#F8FAFC' : theme.inputBg,
                        borderColor: isLight ? '#E2E8F0' : theme.border,
                        color: isLight ? '#64748B' : theme.textSecondary,
                      }}
                    >
                      Quitadas
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Despesas pagas
                  </p>
                  <h3
                    className="text-lg sm:text-2xl font-extrabold tracking-tight truncate"
                    style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  >
                    {isLoading ? (
                      <div className="h-7 w-24 skeleton skeleton-text mt-1" />
                    ) : (
                      formatCurrencyBRL(data?.saidas || 0)
                    )}
                  </h3>
                </div>

                {/* 3. Resultado do caixa */}
                <div
                  className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-2xl border relative overflow-hidden shadow-md"
                  style={{
                    background: theme.accentGradient,
                    borderColor: theme.accent,
                    color: theme.btnPrimaryText,
                  }}
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                  <div className="flex justify-between items-center mb-2.5 relative z-10">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/15 flex items-center justify-center backdrop-blur-sm"
                      style={{ color: theme.btnPrimaryText }}
                    >
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 bg-black/20 rounded-full backdrop-blur-sm"
                      style={{ color: theme.btnPrimaryText }}
                    >
                      Caixa Realizado
                    </span>
                  </div>
                  <p className="text-xs font-bold opacity-90 mb-0.5 relative z-10">
                    Resultado do caixa
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black relative z-10 tracking-tight">
                    {isLoading ? (
                      <div className="h-8 w-32 bg-white/20 rounded animate-pulse mt-1" />
                    ) : (
                      formatCurrencyBRL(data?.resultadoCaixa || 0)
                    )}
                  </h3>
                </div>

                {/* 4. Contas a pagar */}
                <button
                  type="button"
                  onClick={openContasAPagar}
                  className="p-4 sm:p-5 rounded-2xl border text-left transition-all hover:opacity-95 cursor-pointer"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: theme.accentMuted, color: theme.accent }}
                    >
                      <Receipt className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: theme.accent }}>
                      {obligationsMetrics.openCount} em aberto
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Contas a pagar
                  </p>
                  <p
                    className="text-base sm:text-xl font-extrabold truncate"
                    style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  >
                    {formatCurrencyBRL(obligationsMetrics.contasAPagarTotal)}
                  </p>
                </button>

                {/* 5. Próximos vencimentos (7 dias) */}
                <button
                  type="button"
                  onClick={openContasAPagar}
                  className="p-4 sm:p-5 rounded-2xl border text-left transition-all hover:opacity-95 cursor-pointer"
                  style={{
                    borderColor: isLight ? '#E2E8F0' : theme.border,
                    background: isLight ? '#FFFFFF' : theme.cardBg,
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${theme.warning}18`, color: theme.warning }}
                    >
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                      Próx. 7 dias
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Próximos vencimentos
                  </p>
                  <p
                    className="text-base sm:text-xl font-extrabold truncate"
                    style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                  >
                    {obligationsMetrics.proximosVencimentosCount}{' '}
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                    >
                      ({formatCurrencyBRL(obligationsMetrics.proximosVencimentosAmount)})
                    </span>
                  </p>
                </button>

                {/* 6. Despesas atrasadas */}
                <button
                  type="button"
                  onClick={openContasAPagar}
                  className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-2xl border text-left transition-all hover:opacity-95 cursor-pointer"
                  style={{
                    borderColor:
                      obligationsMetrics.atrasadasCount > 0
                        ? `${theme.error}45`
                        : isLight
                          ? '#E2E8F0'
                          : theme.border,
                    background:
                      obligationsMetrics.atrasadasCount > 0
                        ? `${theme.error}08`
                        : isLight
                          ? '#FFFFFF'
                          : theme.cardBg,
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background:
                          obligationsMetrics.atrasadasCount > 0
                            ? `${theme.error}20`
                            : `${theme.success}18`,
                        color:
                          obligationsMetrics.atrasadasCount > 0 ? theme.error : theme.success,
                      }}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span
                      className="text-[10px] font-bold"
                      style={{
                        color:
                          obligationsMetrics.atrasadasCount > 0 ? theme.error : theme.success,
                      }}
                    >
                      {obligationsMetrics.atrasadasCount > 0 ? 'Atenção' : 'Em dia'}
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: isLight ? '#475569' : theme.textSecondary }}
                  >
                    Despesas atrasadas
                  </p>
                  <p
                    className="text-base sm:text-xl font-extrabold truncate"
                    style={{
                      color:
                        obligationsMetrics.atrasadasCount > 0
                          ? theme.error
                          : isLight
                            ? '#0F172A'
                            : theme.textPrimary,
                    }}
                  >
                    {obligationsMetrics.atrasadasCount}{' '}
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                    >
                      ({formatCurrencyBRL(obligationsMetrics.atrasadasAmount)})
                    </span>
                  </p>
                </button>
              </div>

              {/* 2.2 CARD DE PRÓXIMAS DESPESAS */}
              <UpcomingExpensesCard
                payables={payables}
                isLight={isLight}
                onPayClick={(item) => setPayingObligation(item)}
                onManageAllClick={openContasAPagar}
                canWrite={engine.hasPermission('financeiro.criar_lancamento')}
              />

              {/* SEÇÃO 8: ANÁLISE DE DESPESAS E FATURAMENTO */}
              <FinancialAnalyticsSection
                isLight={isLight}
                totalIncome={data?.entradas || 0}
                totalPaidExpenses={data?.saidas || 0}
                fixedPaidAmount={data?.fixedPaidAmount || 0}
                variablePaidAmount={data?.variablePaidAmount || 0}
                otherPaidOutflows={data?.otherPaidOutflows || 0}
                pendingPayablesAmount={obligationsMetrics.contasAPagarTotal}
                categoryBreakdown={data?.categoryBreakdown || []}
                monthlyEvolution={monthlyEvolution}
              />

              {/* HISTÓRICO DE MOVIMENTAÇÕES REALIZADAS (Mobile-First Cards + Desktop Table) */}
              <div
                className="border rounded-2xl flex-1 p-4 sm:p-6 transition-all"
                style={{
                  borderColor: isLight ? '#E2E8F0' : theme.border,
                  background: isLight ? '#FFFFFF' : theme.cardBg,
                  boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                  <div>
                    <h3
                      className="font-bold text-base sm:text-lg"
                      style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                    >
                      Histórico de Movimentações
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                    >
                      Entradas recebidas e saídas efetivamente pagas neste mês
                    </p>
                  </div>

                  {/* Filtros Todas / Receitas / Despesas */}
                  <div
                    className="flex gap-1 p-1 rounded-xl border text-xs w-full sm:w-auto"
                    style={{
                      borderColor: isLight ? '#E2E8F0' : theme.border,
                      background: isLight ? '#F8FAFC' : theme.inputBg,
                    }}
                  >
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'income', label: 'Receitas' },
                      { id: 'expense', label: 'Despesas' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setFilterType(tab.id as any);
                          setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          filterType === tab.id ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          background: filterType === tab.id ? theme.accentGradient : 'transparent',
                          color:
                            filterType === tab.id
                              ? theme.btnPrimaryText
                              : isLight
                                ? '#475569'
                                : theme.textSecondary,
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoading ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left">
                      <tbody>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <TableRowSkeleton key={i} cols={5} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div
                    className="text-center py-12 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center"
                    style={{
                      borderColor: isLight ? '#E2E8F0' : theme.border,
                      color: isLight ? '#64748B' : theme.textSecondary,
                      background: isLight ? '#F8FAFC' : 'transparent',
                    }}
                  >
                    <p
                      className="font-bold text-sm sm:text-base mb-1"
                      style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                    >
                      Nenhuma movimentação realizada neste período.
                    </p>
                    <p className="text-xs max-w-md">
                      Atendimentos concluídos, pagamentos online e despesas marcadas como pagas aparecem automaticamente aqui.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* MOBILE (< md): Cards adaptáveis sem rolagem horizontal */}
                    <div className="md:hidden space-y-2.5">
                      {paginatedTransactions.map((tx: any) => (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-2xl border space-y-2.5"
                          style={{
                            borderColor: isLight ? '#E2E8F0' : theme.border,
                            background: isLight ? '#F8FAFC' : theme.inputBg,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <p
                                className="text-sm font-bold truncate"
                                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                              >
                                {tx.description}
                              </p>
                              <p
                                className="text-xs mt-0.5 truncate"
                                style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                              >
                                {tx.customer_name} • {format(new Date(tx.date), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>

                            <span
                              className="text-sm font-extrabold whitespace-nowrap shrink-0"
                              style={{ color: tx.type === 'income' ? theme.success : theme.error }}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatCurrencyBRL(tx.amount)}
                            </span>
                          </div>

                          <div
                            className="pt-2 border-t flex items-center justify-between gap-2"
                            style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}
                          >
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{
                                background:
                                  tx.type === 'income'
                                    ? `${theme.success}18`
                                    : `${theme.error}18`,
                                color: tx.type === 'income' ? theme.success : theme.error,
                              }}
                            >
                              {tx.method}
                            </span>

                            {tx.isManual ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleEditClick(tx)}
                                  className="p-1.5 rounded-lg border transition-colors cursor-pointer"
                                  style={{
                                    borderColor: isLight ? '#CBD5E1' : theme.border,
                                    color: isLight ? '#334155' : theme.textSecondary,
                                  }}
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(tx)}
                                  className="p-1.5 rounded-lg border transition-colors cursor-pointer"
                                  style={{
                                    borderColor: `${theme.error}40`,
                                    color: theme.error,
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="text-[10px] uppercase font-bold tracking-wider opacity-60"
                                style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                              >
                                Automático
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* DESKTOP (>= md): Tabela de Movimentações */}
                    <div className="hidden md:block w-full overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr
                            className="border-b"
                            style={{
                              borderColor: isLight ? '#E2E8F0' : theme.border,
                              color: isLight ? '#64748B' : theme.textSecondary,
                            }}
                          >
                            <th className="py-3 px-4 font-semibold">Data</th>
                            <th className="py-3 px-4 font-semibold">Descrição</th>
                            <th className="py-3 px-4 font-semibold">Origem / Categoria</th>
                            <th className="py-3 px-4 font-semibold">Forma</th>
                            <th className="py-3 px-4 font-semibold text-right">Valor</th>
                            <th className="py-3 px-4 font-semibold text-center w-24">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTransactions.map((tx: any) => (
                            <tr
                              key={tx.id}
                              className="border-b last:border-b-0 hover:bg-black/5 transition-colors"
                              style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                            >
                              <td
                                className="py-4 px-4 font-medium whitespace-nowrap"
                                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                              >
                                {format(new Date(tx.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                              </td>
                              <td
                                className="py-4 px-4 font-bold"
                                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                              >
                                {tx.description}
                              </td>
                              <td
                                className="py-4 px-4 font-medium"
                                style={{ color: isLight ? '#475569' : theme.textSecondary }}
                              >
                                {tx.customer_name}
                              </td>
                              <td className="py-4 px-4">
                                <span
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                  style={{
                                    background:
                                      tx.type === 'income'
                                        ? `${theme.success}18`
                                        : `${theme.error}18`,
                                    color: tx.type === 'income' ? theme.success : theme.error,
                                    border: `1px solid ${
                                      tx.type === 'income'
                                        ? `${theme.success}35`
                                        : `${theme.error}35`
                                    }`,
                                  }}
                                >
                                  {tx.method}
                                </span>
                              </td>
                              <td
                                className="py-4 px-4 text-right font-bold whitespace-nowrap"
                                style={{ color: tx.type === 'income' ? theme.success : theme.error }}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatCurrencyBRL(tx.amount)}
                              </td>
                              <td className="py-4 px-4 text-center">
                                {tx.isManual ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleEditClick(tx)}
                                      className="p-1.5 rounded-lg border hover:bg-black/5 transition-colors cursor-pointer"
                                      style={{
                                        borderColor: isLight ? '#CBD5E1' : theme.border,
                                        color: isLight ? '#334155' : theme.textSecondary,
                                      }}
                                      title="Editar Lançamento"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClick(tx)}
                                      className="p-1.5 rounded-lg border hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      style={{ borderColor: `${theme.error}40`, color: theme.error }}
                                      title="Excluir Lançamento"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="text-[10px] uppercase font-bold tracking-wider opacity-50"
                                    style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                                  >
                                    Automático
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

                {/* Paginação */}
                {filteredTransactions.length > 0 && (
                  <div
                    className="pt-5 border-t mt-5 flex flex-col sm:flex-row items-center justify-between gap-3"
                    style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                    >
                      Mostrando{' '}
                      <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                        {(currentPage - 1) * PAGE_SIZE + 1}
                      </strong>{' '}
                      a{' '}
                      <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                        {Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)}
                      </strong>{' '}
                      de{' '}
                      <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                        {filteredTransactions.length}
                      </strong>{' '}
                      movimentações
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        style={{
                          borderColor: isLight ? '#CBD5E1' : theme.border,
                          color: isLight ? '#0F172A' : theme.textPrimary,
                        }}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                      </button>

                      <span
                        className="px-2.5 py-1 text-xs font-bold"
                        style={{ color: isLight ? '#475569' : theme.textSecondary }}
                      >
                        {currentPage}/{totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        style={{
                          borderColor: isLight ? '#CBD5E1' : theme.border,
                          color: isLight ? '#0F172A' : theme.textPrimary,
                        }}
                      >
                        Próximo <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Lançamento Manual */}
        <ManualTransactionModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingTransaction(null);
          }}
          onSave={async (tx) => {
            await saveTransactionMutation.mutateAsync(tx);
          }}
          transaction={editingTransaction}
          tenantId={tenantId || ''}
          isLoading={saveTransactionMutation.isPending}
        />

        {/* Modal Rápido "Marcar como Pago" (acionado direto de Próximas Despesas) */}
        <PayObligationModal
          isOpen={Boolean(payingObligation)}
          payable={payingObligation}
          onClose={() => setPayingObligation(null)}
          onConfirm={async (input) => {
            await quickPayMutation.mutateAsync(input);
          }}
          isLoading={quickPayMutation.isPending}
        />

        {/* Modal de Confirmação de Exclusão */}
        {deletingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
              className="border rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#FFFFFF' : theme.cardBg,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${theme.error}15`, color: theme.error }}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
              >
                Excluir Lançamento?
              </h3>
              <p
                className="text-xs sm:text-sm mb-6 leading-relaxed"
                style={{ color: isLight ? '#475569' : theme.textSecondary }}
              >
                <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {deletingTransaction.description}
                </strong>{' '}
                será removido do fluxo de caixa
                {deletingTransaction.payable_id
                  ? ' e sua obrigação voltará a ficar pendente em Contas a Pagar.'
                  : '.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingTransaction(null)}
                  className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-all cursor-pointer"
                  style={{
                    borderColor: isLight ? '#CBD5E1' : theme.border,
                    color: isLight ? '#0F172A' : theme.textPrimary,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteTransactionMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white cursor-pointer shadow-md"
                  style={{ background: theme.error }}
                >
                  {deleteTransactionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Upgrade */}
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
