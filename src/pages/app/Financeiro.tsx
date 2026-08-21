import { useState, useMemo, useEffect } from 'react';
import {
  DollarSign, ArrowUpRight, ArrowDownRight, Download, Plus, Edit2, Trash2,
  Lock, Crown, Filter, Users, TrendingUp, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { useNavigate } from 'react-router-dom';
import { ManualTransactionModal, type FinancialTransaction } from './financeiro/ManualTransactionModal';

export default function Financeiro() {
  const { theme } = useTheme();
  const { tenant, user, role, professionalProfile } = useAuth();
  const [currentMonth] = useState(new Date());
  const engine = usePermissionEngine();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(role === 'professional' ? professionalProfile?.id || null : null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const tenantId = tenant?.id;

  // 1. Fetch Professionals for Filter
  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['professionals_financeiro', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!tenantId
  });

  const professionals = role === 'professional' && professionalProfile
    ? allProfessionals.filter(p => p.id === professionalProfile.id)
    : allProfessionals;

  // 2. Fetch Combined Financials (Payments, Refunds, Local Bookings, and Manual Financial Transactions)
  const { data, isLoading } = useQuery({
    queryKey: ['financials_full', tenantId, currentMonth.getMonth(), selectedProfessionalId],
    queryFn: async () => {
      if (!tenantId) return null;

      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

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

      // (B) Fetch Refunds (Saídas Online)
      let refundsQuery = supabase
        .from('refunds')
        .select(`
          *,
          payments (
            id,
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

      // (C) Fetch Local Bookings
      let localBookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          scheduled_at,
          amount_total,
          status,
          professional_id,
          customers (name),
          services (name)
        `)
        .eq('tenant_id', tenantId)
        .eq('payment_mode', 'local')
        .eq('status', 'completed')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      // (D) Fetch Manual Financial Transactions
      let manualTxQuery = supabase
        .from('financial_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (selectedProfessionalId) {
        localBookingsQuery = localBookingsQuery.eq('professional_id', selectedProfessionalId);
        manualTxQuery = manualTxQuery.eq('professional_id', selectedProfessionalId);
      }

      const [
        { data: payments },
        { data: refunds },
        { data: localBookings },
        { data: manualTransactions }
      ] = await Promise.all([
        paymentsQuery,
        refundsQuery,
        localBookingsQuery,
        manualTxQuery
      ]);

      let entradas = 0;
      let saidas = 0;
      const transactions: any[] = [];

      // Process Online Payments
      payments?.forEach((p: any) => {
        if (selectedProfessionalId && p.bookings?.professional_id !== selectedProfessionalId) {
          return;
        }
        if (p.status === 'succeeded' || p.status === 'refunded') {
          entradas += Number(p.amount);
        }
        transactions.push({
          id: p.id,
          type: 'income',
          amount: Number(p.amount),
          status: p.status,
          method: p.payment_method || 'Cartão (Online)',
          date: p.created_at,
          customer_name: p.bookings?.customers?.name || 'Cliente',
          description: p.bookings?.services?.name || 'Serviço',
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

      // Process Local Bookings
      localBookings?.forEach((b: any) => {
        entradas += Number(b.amount_total || 0);
        transactions.push({
          id: b.id,
          type: 'income',
          amount: Number(b.amount_total || 0),
          status: 'succeeded',
          method: 'Local (Balcão)',
          date: b.scheduled_at,
          customer_name: b.customers?.name || 'Cliente',
          description: b.services?.name || 'Serviço',
          isManual: false,
        });
      });

      // Process Manual Transactions
      const startDate = new Date(start);
      const endDate = new Date(end);

      manualTransactions?.forEach((m: any) => {
        const txDate = new Date(m.date || m.created_at);
        if (txDate < startDate || txDate > endDate) {
          return;
        }

        const val = Number(m.amount || 0);
        if (m.type === 'income') {
          entradas += val;
        } else {
          saidas += val;
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
        // Update
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
        // Insert
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
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials_full'] });
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) return;
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials_full'] });
    }
  });

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (filterType === 'all') return data.transactions;
    return data.transactions.filter(t => t.type === filterType);
  }, [data?.transactions, filterType]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, selectedProfessionalId]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  // Handlers
  const handleNewTransactionClick = () => {
    if (!engine.hasPermission('financeiro.criar_lancamento')) {
      setShowUpgradeModal('Lançamentos Manuais de Receitas e Despesas');
      return;
    }
    setEditingTransaction(null);
    setModalOpen(true);
  };

  const handleEditClick = (tx: any) => {
    if (!tx.isManual) return;
    if (!engine.hasPermission('financeiro.editar_lancamento')) {
      setShowUpgradeModal('Editar Lançamentos Financeiros');
      return;
    }
    setEditingTransaction({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category || 'Serviço Avulso',
      payment_method: tx.method,
      professional_id: tx.professional_id,
      date: tx.date,
    });
    setModalOpen(true);
  };

  const handleDeleteClick = async (tx: any) => {
    if (!tx.isManual) return;
    if (!engine.hasPermission('financeiro.excluir_lancamento')) {
      setShowUpgradeModal('Excluir Lançamentos Financeiros');
      return;
    }
    if (window.confirm(`Deseja realmente excluir o lançamento "${tx.description}"?`)) {
      await deleteTransactionMutation.mutateAsync(tx.id);
    }
  };

  const handleExport = () => {
    if (!engine.hasPermission('financeiro.exportar')) {
      setShowUpgradeModal('Exportação de Relatórios Financeiros');
      return;
    }
    if (!data?.transactions || data.transactions.length === 0) return;

    const headers = ['Data', 'Tipo', 'Descrição', 'Origem/Cliente', 'Método', 'Valor (R$)'];
    const rows = filteredTransactions.map(t => [
      `"${format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}"`,
      `"${t.type === 'income' ? 'Receita' : 'Despesa'}"`,
      `"${t.description || ''}"`,
      `"${t.customer_name || ''}"`,
      `"${t.method || ''}"`,
      `"${t.amount || 0}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_financeiro_${tenant?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check if user has ANY access to Financeiro
  const canAccessFinanceiro = engine.hasAnyPermission('financeiro.') ||
    engine.hasPermission('financeiro.visualizar_caixa_geral') ||
    engine.hasPermission('financeiro.visualizar_meu_caixa') ||
    engine.hasPermission('financeiro.criar_lancamento');

  return (
    <div className="relative min-h-[600px] w-full">
      {/* ── Se não tiver nenhuma permissão, mostra teaser com blur ── */}
      <div className={`space-y-6 h-full flex flex-col animate-fade-in ${!canAccessFinanceiro ? 'filter blur-[5px] opacity-40 pointer-events-none select-none' : ''}`}>
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Gestão</p>
            <h1 className="text-3xl font-bold font-sans" style={{ color: theme.textPrimary }}>Financeiro & Fluxo de Caixa</h1>
            <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Controle entradas, despesas manuais e lucro líquido.</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 glass-card cursor-pointer"
              style={{ borderColor: theme.border, color: theme.textPrimary }}
            >
              <Download className="w-4 h-4 mr-2" /> Exportar Relatório
            </button>
            <button
              onClick={handleNewTransactionClick}
              className="flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-lg hover:opacity-90 cursor-pointer"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
            >
              <Plus className="w-4 h-4 mr-1" /> Novo Lançamento
            </button>
          </div>
        </header>

        {/* Professional Filter Bar */}
        {professionals.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold shrink-0 mr-1" style={{ color: theme.textSecondary }}>Filtrar Caixa:</span>
            {role !== 'professional' && (
              <button
                onClick={() => {
                  if (!engine.hasPermission('financeiro.visualizar_caixa_geral')) {
                    setShowUpgradeModal('Visualizar Caixa Geral de Todos os Profissionais');
                    return;
                  }
                  setSelectedProfessionalId(null);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                style={{
                  color: selectedProfessionalId === null ? theme.btnPrimaryText : theme.textSecondary,
                  background: selectedProfessionalId === null ? theme.accentGradient : theme.cardBg,
                  borderColor: selectedProfessionalId === null ? theme.accent : theme.cardBorder,
                  boxShadow: selectedProfessionalId === null ? theme.shadowAccent : 'none',
                }}
              >
                Caixa Geral (Todos)
              </button>
            )}
            {professionals.map(p => {
              const isSelected = selectedProfessionalId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfessionalId(isSelected ? null : p.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer"
                  style={{
                    color: isSelected ? theme.btnPrimaryText : theme.textSecondary,
                    background: isSelected ? theme.accentGradient : theme.cardBg,
                    borderColor: isSelected ? theme.accent : theme.border,
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
          <div className="p-6 rounded-2xl shadow-2xl border glass-card" style={{ borderColor: theme.border }}>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${theme.success}15`, color: theme.success }}>
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>Este Mês</span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Entradas Totais (Receitas)</p>
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
            <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>Saídas Totais (Despesas/Estornos)</p>
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
              <span className="text-xs font-bold px-2 py-1 bg-black/20 rounded-full backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>Resultado</span>
            </div>
            <p className="text-sm font-bold opacity-80 mb-1 relative z-10">Lucro Líquido</p>
            <h3 className="text-3xl font-black relative z-10">
              {isLoading ? <div className="h-9 w-32 bg-white/20 rounded animate-pulse mt-1" /> : money(data?.liquido || 0)}
            </h3>
          </div>
        </div>

        {/* LISTA DE TRANSAÇÕES */}
        <div className="border rounded-2xl shadow-2xl flex-1 p-6 glass-card" style={{ borderColor: theme.border }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h3 className="font-bold text-lg" style={{ color: theme.textPrimary }}>Lançamentos & Transações</h3>

            {/* Type Filters */}
            <div className="flex gap-1 p-1 rounded-xl border text-xs" style={{ borderColor: theme.border, background: theme.inputBg }}>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'income', label: 'Receitas' },
                { id: 'expense', label: 'Despesas' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${filterType === tab.id ? 'shadow' : 'opacity-70 hover:opacity-100'}`}
                  style={{
                    background: filterType === tab.id ? theme.accentGradient : 'transparent',
                    color: filterType === tab.id ? theme.btnPrimaryText : theme.textSecondary,
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
              <div className="text-center py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                <p className="font-semibold mb-1">Nenhum lançamento encontrado neste período.</p>
                <p className="text-xs">Clique em "+ Novo Lançamento" para cadastrar uma entrada ou despesa manual.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: theme.border, color: theme.textSecondary }}>
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
                    <tr key={tx.id} className="border-b last:border-b-0 hover:bg-black/5 transition-colors" style={{ borderColor: theme.border }}>
                      <td className="py-4 px-4 font-medium whitespace-nowrap" style={{ color: theme.textPrimary }}>
                        {format(new Date(tx.date), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                      </td>
                      <td className="py-4 px-4 font-semibold" style={{ color: theme.textPrimary }}>
                        {tx.description}
                      </td>
                      <td className="py-4 px-4" style={{ color: theme.textSecondary }}>
                        {tx.customer_name}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: tx.type === 'income' ? '#10b98115' : '#ef444415',
                            color: tx.type === 'income' ? '#10b981' : '#ef4444',
                            border: `1px solid ${tx.type === 'income' ? '#10b98130' : '#ef444430'}`
                          }}
                        >
                          {tx.method}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-right font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.type === 'income' ? '+' : '-'}{money(tx.amount)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {tx.isManual ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditClick(tx)}
                              className="p-1.5 rounded-lg border hover:bg-[var(--theme-bg-hover)] transition-colors cursor-pointer"
                              style={{ borderColor: theme.border, color: theme.textSecondary }}
                              title="Editar Lançamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(tx)}
                              className="p-1.5 rounded-lg border hover:bg-rose-500/10 transition-colors cursor-pointer"
                              style={{ borderColor: '#ef444430', color: '#ef4444' }}
                              title="Excluir Lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-40">Automático</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {filteredTransactions.length > 0 && (
              <div className="pt-6 border-t mt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: theme.border }}>
                <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                  Mostrando <strong style={{ color: theme.textPrimary }}>{(currentPage - 1) * PAGE_SIZE + 1}</strong> a <strong style={{ color: theme.textPrimary }}>{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)}</strong> de <strong style={{ color: theme.textPrimary }}>{filteredTransactions.length}</strong> transações
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
                    style={{ borderColor: theme.border, color: theme.textPrimary }}
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
                            color: isActive ? theme.btnPrimaryText : theme.textSecondary,
                            border: `1px solid ${isActive ? theme.accent : theme.border}`
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
                    style={{ borderColor: theme.border, color: theme.textPrimary }}
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Overlay de Bloqueio se não tiver permissão alguma ── */}
      {!canAccessFinanceiro && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 glass-card animate-scale-in" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="relative mb-6">
              <div className="relative w-20 h-20 mx-auto bg-black border rounded-full flex items-center justify-center" style={{ borderColor: theme.accent }}>
                <Crown className="w-10 h-10" style={{ color: theme.accent }} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <Lock className="w-4 h-4" style={{ color: theme.textSecondary }} />
                </div>
              </div>
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: theme.textPrimary }}>
              Módulo Financeiro
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
              O controle de caixa e relatórios financeiros é exclusivo de planos superiores. Faça upgrade para desbloquear.
            </p>
            <button
              onClick={() => navigate('/admin/assinatura')}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:opacity-90"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
            >
              Ver planos
            </button>
          </div>
        </div>
      )}

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

      {/* ── Modal: Upgrade Plan (Ações Individuais) ── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="border rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 glass-card animate-scale-in" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="relative mb-6">
              <div className="relative w-20 h-20 mx-auto bg-black border rounded-full flex items-center justify-center" style={{ borderColor: theme.accent }}>
                <Crown className="w-10 h-10" style={{ color: theme.accent }} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <Lock className="w-4 h-4" style={{ color: theme.textSecondary }} />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-xl mb-2" style={{ color: theme.textPrimary }}>
              Recurso Premium
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
              A funcionalidade de <strong>{showUpgradeModal}</strong> é exclusiva de planos superiores. Faça o upgrade para desbloquear o acesso total.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/admin/assinatura')}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:opacity-90"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Ver planos
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(null)}
                className="w-full py-2 text-xs font-semibold hover:underline"
                style={{ color: theme.textSecondary }}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

