import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit2,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  StopCircle,
  Trash2,
} from 'lucide-react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  computePayableDisplayStatus,
  deleteExpensePayable,
  diffDaysFromToday,
  ensureRecurringPayables,
  fetchExpensePayables,
  fetchRecurringRules,
  formatCurrencyBRL,
  formatDateBR,
  getFrequencyLabel,
  getRemainingAmount,
  payExpensePayable,
  saveRecurringRule,
  saveVariableExpense,
  toDateOnlyISO,
  updateRecurringRuleLifecycle,
} from '../../../services/financialService';
import type {
  ExpensePayable,
  PayObligationInput,
  RecurringExpenseRule,
  RecurringRuleInput,
  VariableExpenseInput,
} from '../../../types/financial';
import { PayObligationModal } from './PayObligationModal';
import { RecurringHistoryModal } from './RecurringHistoryModal';
import { RecurringRuleModal } from './RecurringRuleModal';
import { PayableStatusBadge } from './StatusBadge';
import { VariableExpenseModal } from './VariableExpenseModal';

export type ExpensesSubTab = 'contas_a_pagar' | 'fixos' | 'variaveis';

type PayablesFilter =
  | 'all_pending'
  | 'overdue'
  | 'due_today'
  | 'next_7'
  | 'next_30'
  | 'paid_history';

interface ExpensesHubTabProps {
  tenantId: string;
  currentMonth: Date;
  initialSubTab?: ExpensesSubTab;
  selectedProfessionalId?: string | null;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onRequirePermission?: (permKey: string) => void;
}

export function ExpensesHubTab({
  tenantId,
  currentMonth,
  initialSubTab = 'contas_a_pagar',
  selectedProfessionalId = null,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onRequirePermission,
}: ExpensesHubTabProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const isLight =
    theme.id === 'elegant' ||
    Boolean(theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  const [subTab, setSubTab] = useState<ExpensesSubTab>(initialSubTab);
  const [payablesFilter, setPayablesFilter] = useState<PayablesFilter>('all_pending');
  const [variableStatusFilter, setVariableStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Modals state
  const [payingItem, setPayingItem] = useState<ExpensePayable | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringExpenseRule | null>(null);
  const [historyRule, setHistoryRule] = useState<RecurringExpenseRule | null>(null);
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ExpensePayable | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isConfirmRunning, setIsConfirmRunning] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const invalidateAllFinancialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['expense_payables', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['recurring_expenses', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['financials_full', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['financial_evolution', tenantId] });
  };

  // Queries
  const { data: payables = [], isLoading: loadingPayables } = useQuery({
    queryKey: [
      'expense_payables',
      tenantId,
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      selectedProfessionalId,
    ],
    queryFn: async () => {
      await ensureRecurringPayables(tenantId, currentMonth);
      return fetchExpensePayables(tenantId, selectedProfessionalId);
    },
    enabled: !!tenantId,
  });

  const { data: recurringRules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['recurring_expenses', tenantId],
    queryFn: () => fetchRecurringRules(tenantId),
    enabled: !!tenantId,
  });

  // Mutations
  const payMutation = useMutation({
    mutationFn: (input: PayObligationInput) => payExpensePayable(input),
    onSuccess: () => {
      invalidateAllFinancialQueries();
      toast.success('Pagamento registrado e atualizado no Fluxo de Caixa!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao confirmar pagamento.');
    },
  });

  const saveRuleMutation = useMutation({
    mutationFn: (input: RecurringRuleInput) => saveRecurringRule(tenantId, input),
    onSuccess: (_, vars) => {
      invalidateAllFinancialQueries();
      toast.success(vars.id ? 'Gasto fixo atualizado!' : 'Gasto fixo cadastrado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao salvar gasto fixo.');
    },
  });

  const saveVariableMutation = useMutation({
    mutationFn: (input: VariableExpenseInput) => saveVariableExpense(tenantId, input),
    onSuccess: (_, vars) => {
      invalidateAllFinancialQueries();
      toast.success(vars.id ? 'Despesa variável atualizada!' : 'Despesa variável registrada!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao salvar despesa variável.');
    },
  });

  // Derived data for Contas a Pagar
  const pendingPayables = useMemo(
    () =>
      payables
        .filter((p) => p.status !== 'paid' && p.status !== 'canceled')
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [payables]
  );

  const paidPayables = useMemo(
    () =>
      payables
        .filter((p) => p.status === 'paid')
        .sort((a, b) => (b.paid_at || b.due_date).localeCompare(a.paid_at || a.due_date)),
    [payables]
  );

  const payablesSummary = useMemo(() => {
    let totalOpen = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let todayAmount = 0;
    let todayCount = 0;
    let next7Amount = 0;
    let next7Count = 0;

    pendingPayables.forEach((p) => {
      const rem = getRemainingAmount(p);
      const diff = diffDaysFromToday(p.due_date);
      totalOpen += rem;
      if (diff < 0) {
        overdueAmount += rem;
        overdueCount += 1;
      } else if (diff === 0) {
        todayAmount += rem;
        todayCount += 1;
      } else if (diff <= 7) {
        next7Amount += rem;
        next7Count += 1;
      }
    });

    return {
      totalOpen,
      overdueAmount,
      overdueCount,
      todayAmount,
      todayCount,
      next7Amount,
      next7Count,
    };
  }, [pendingPayables]);

  const filteredPayablesList = useMemo(() => {
    if (payablesFilter === 'paid_history') {
      return paidPayables;
    }
    return pendingPayables.filter((p) => {
      const diff = diffDaysFromToday(p.due_date);
      if (payablesFilter === 'overdue') return diff < 0;
      if (payablesFilter === 'due_today') return diff === 0;
      if (payablesFilter === 'next_7') return diff >= 0 && diff <= 7;
      if (payablesFilter === 'next_30') return diff >= 0 && diff <= 30;
      return true;
    });
  }, [pendingPayables, paidPayables, payablesFilter]);

  // Derived data for Gastos Variáveis (filtrados pelo mês selecionado)
  const monthStartISO = toDateOnlyISO(startOfMonth(currentMonth).toISOString());
  const monthEndISO = toDateOnlyISO(endOfMonth(currentMonth).toISOString());

  const variableExpensesInMonth = useMemo(() => {
    return payables
      .filter((p) => {
        if (p.expense_type !== 'variable') return false;
        const refDate = p.purchase_date || p.due_date;
        const inMonth =
          (refDate >= monthStartISO && refDate <= monthEndISO) ||
          (p.due_date >= monthStartISO && p.due_date <= monthEndISO);
        if (!inMonth) return false;
        if (variableStatusFilter === 'paid') return p.status === 'paid';
        if (variableStatusFilter === 'pending') return p.status !== 'paid';
        return true;
      })
      .sort((a, b) => (b.purchase_date || b.due_date).localeCompare(a.purchase_date || a.due_date));
  }, [payables, monthStartISO, monthEndISO, variableStatusFilter]);

  const historyRuleOccurrences = useMemo(() => {
    if (!historyRule) return [];
    return payables.filter((p) => p.recurring_expense_id === historyRule.id);
  }, [payables, historyRule]);

  const runConfirmedAction = async () => {
    if (!confirmDialog) return;
    setIsConfirmRunning(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao executar operação.');
    } finally {
      setIsConfirmRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navegação Mobile-First (3 subdivisões de Despesas) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl border w-full sm:w-auto"
          style={{
            background: isLight ? '#F8FAFC' : theme.inputBg,
            borderColor: isLight ? '#E2E8F0' : theme.border,
          }}
        >
          {[
            {
              id: 'contas_a_pagar' as const,
              label: 'Contas a Pagar',
              badge: pendingPayables.length > 0 ? pendingPayables.length : null,
              Icon: Receipt,
            },
            {
              id: 'fixos' as const,
              label: 'Gastos Fixos',
              badge: null,
              Icon: Repeat,
            },
            {
              id: 'variaveis' as const,
              label: 'Gastos Variáveis',
              badge: null,
              Icon: ShoppingBag,
            },
          ].map((item) => {
            const active = subTab === item.id;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                className="py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                style={{
                  background: active ? theme.accentGradient : 'transparent',
                  color: active ? theme.btnPrimaryText : isLight ? '#475569' : theme.textSecondary,
                  boxShadow: active ? theme.shadowSm : 'none',
                }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                <span className="truncate">{item.label}</span>
                {item.badge !== null && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none"
                    style={{
                      background: active ? 'rgba(0,0,0,0.22)' : theme.accentMuted,
                      color: active ? theme.btnPrimaryText : theme.accent,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Botões rápidos contextuais */}
        <div className="flex items-center gap-2">
          {subTab !== 'fixos' && (
            <button
              type="button"
              onClick={() => {
                if (!canCreate) {
                  onRequirePermission?.('financeiro.criar_lancamento');
                  return;
                }
                setEditingVariable(null);
                setVariableModalOpen(true);
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer"
              style={{
                background: subTab === 'variaveis' ? theme.accentGradient : isLight ? '#FFFFFF' : theme.cardBg,
                color: subTab === 'variaveis' ? theme.btnPrimaryText : isLight ? '#0F172A' : theme.textPrimary,
                border: subTab === 'variaveis' ? 'none' : `1px solid ${isLight ? '#CBD5E1' : theme.border}`,
              }}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Novo Gasto Variável</span>
            </button>
          )}

          {subTab !== 'variaveis' && (
            <button
              type="button"
              onClick={() => {
                if (!canCreate) {
                  onRequirePermission?.('financeiro.criar_lancamento');
                  return;
                }
                setEditingRule(null);
                setRuleModalOpen(true);
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer"
              style={{
                background: theme.accentGradient,
                color: theme.btnPrimaryText,
              }}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Novo Gasto Fixo</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          SUB-ABA 1: CONTAS A PAGAR (CENTRAL DE OBRIGAÇÕES)
         ===================================================================== */}
      {subTab === 'contas_a_pagar' && (
        <div className="space-y-4">
          {/* Cards compactos de resumo (2 colunas no celular, 4 no desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              className="p-3.5 sm:p-4 rounded-2xl border"
              style={{
                background: isLight ? '#FFFFFF' : theme.cardBg,
                borderColor: isLight ? '#E2E8F0' : theme.border,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Total a Pagar
              </p>
              <p className="text-lg sm:text-xl font-extrabold mt-1" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                {formatCurrencyBRL(payablesSummary.totalOpen)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                {pendingPayables.length} {pendingPayables.length === 1 ? 'conta em aberto' : 'contas em aberto'}
              </p>
            </div>

            <div
              className="p-3.5 sm:p-4 rounded-2xl border"
              style={{
                background: payablesSummary.overdueCount > 0 ? `${theme.error}08` : isLight ? '#FFFFFF' : theme.cardBg,
                borderColor: payablesSummary.overdueCount > 0 ? `${theme.error}40` : isLight ? '#E2E8F0' : theme.border,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: payablesSummary.overdueCount > 0 ? theme.error : isLight ? '#64748B' : theme.textSecondary }}>
                Atrasadas
              </p>
              <p className="text-lg sm:text-xl font-extrabold mt-1" style={{ color: payablesSummary.overdueCount > 0 ? theme.error : isLight ? '#0F172A' : theme.textPrimary }}>
                {formatCurrencyBRL(payablesSummary.overdueAmount)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                {payablesSummary.overdueCount} {payablesSummary.overdueCount === 1 ? 'obrigação' : 'obrigações'}
              </p>
            </div>

            <div
              className="p-3.5 sm:p-4 rounded-2xl border"
              style={{
                background: payablesSummary.todayCount > 0 ? `${theme.warning}10` : isLight ? '#FFFFFF' : theme.cardBg,
                borderColor: payablesSummary.todayCount > 0 ? `${theme.warning}45` : isLight ? '#E2E8F0' : theme.border,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: payablesSummary.todayCount > 0 ? theme.warning : isLight ? '#64748B' : theme.textSecondary }}>
                Vencem Hoje
              </p>
              <p className="text-lg sm:text-xl font-extrabold mt-1" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                {formatCurrencyBRL(payablesSummary.todayAmount)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                {payablesSummary.todayCount} {payablesSummary.todayCount === 1 ? 'conta hoje' : 'contas hoje'}
              </p>
            </div>

            <div
              className="p-3.5 sm:p-4 rounded-2xl border"
              style={{
                background: isLight ? '#FFFFFF' : theme.cardBg,
                borderColor: isLight ? '#E2E8F0' : theme.border,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Próximos 7 Dias
              </p>
              <p className="text-lg sm:text-xl font-extrabold mt-1" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                {formatCurrencyBRL(payablesSummary.next7Amount)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                {payablesSummary.next7Count} {payablesSummary.next7Count === 1 ? 'vencimento' : 'vencimentos'}
              </p>
            </div>
          </div>

          {/* Filtros horizontais adaptados para toque */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all_pending' as const, label: 'Todas as Pendentes' },
              { id: 'overdue' as const, label: `Atrasadas (${payablesSummary.overdueCount})` },
              { id: 'due_today' as const, label: `Vencem Hoje (${payablesSummary.todayCount})` },
              { id: 'next_7' as const, label: 'Próximos 7 Dias' },
              { id: 'next_30' as const, label: 'Próximos 30 Dias' },
              { id: 'paid_history' as const, label: `Histórico Pagas (${paidPayables.length})` },
            ].map((chip) => {
              const active = payablesFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPayablesFilter(chip.id)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all cursor-pointer"
                  style={{
                    background: active ? theme.accentGradient : isLight ? '#FFFFFF' : theme.cardBg,
                    color: active ? theme.btnPrimaryText : isLight ? '#475569' : theme.textSecondary,
                    borderColor: active ? theme.accent : isLight ? '#E2E8F0' : theme.border,
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Lista de Obrigações (Cards Mobile-First, sem exigir rolagem horizontal) */}
          {loadingPayables ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: theme.accent }} />
            </div>
          ) : filteredPayablesList.length === 0 ? (
            <div
              className="p-10 text-center rounded-2xl border border-dashed"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : 'transparent',
              }}
            >
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: theme.success }} />
              <p className="text-sm font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                {payablesFilter === 'paid_history'
                  ? 'Nenhum pagamento registrado no histórico ainda.'
                  : 'Nenhuma obrigação encontrada neste filtro.'}
              </p>
              <p className="text-xs mt-1" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Os gastos fixos e variáveis pendentes aparecem automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPayablesList.map((item) => {
                const display = computePayableDisplayStatus(item);
                const remaining = getRemainingAmount(item);
                const isPaid = item.status === 'paid';
                const isOverdue = display.code === 'overdue';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border transition-all"
                    style={{
                      background: isLight ? '#FFFFFF' : theme.cardBg,
                      borderColor: isOverdue
                        ? `${theme.error}45`
                        : display.code === 'due_today'
                          ? `${theme.warning}45`
                          : isLight
                            ? '#E2E8F0'
                            : theme.border,
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className="text-sm sm:text-base font-bold"
                            style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                          >
                            {item.description}
                          </h4>
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border"
                            style={{
                              borderColor: isLight ? '#CBD5E1' : theme.border,
                              color: isLight ? '#475569' : theme.textSecondary,
                              background: isLight ? '#F8FAFC' : theme.inputBg,
                            }}
                          >
                            {item.expense_type === 'fixed' ? 'Gasto Fixo' : 'Gasto Variável'}
                          </span>
                          <PayableStatusBadge status={display.code} label={display.label} compact />
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1.5"
                          style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                        >
                          <span>{item.category}</span>
                          <span>•</span>
                          <span
                            className="inline-flex items-center gap-1 font-semibold"
                            style={{ color: isOverdue ? theme.error : undefined }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Vencimento: {formatDateBR(item.due_date)}
                          </span>
                          {isPaid && item.paid_at && (
                            <>
                              <span>•</span>
                              <span style={{ color: theme.success }}>
                                Pago em {formatDateBR(item.paid_at)} ({item.payment_method || 'PIX'})
                              </span>
                            </>
                          )}
                        </div>

                        {item.status === 'partial' && (
                          <p className="text-xs mt-1.5 font-semibold" style={{ color: theme.accent }}>
                            Já pago: {formatCurrencyBRL(item.paid_amount)} de {formatCurrencyBRL(item.expected_amount)}
                          </p>
                        )}
                      </div>

                      <div
                        className="flex items-center justify-between md:justify-end gap-3 pt-2.5 md:pt-0 border-t md:border-t-0"
                        style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                      >
                        <div className="text-left md:text-right">
                          <p
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: isLight ? '#64748B' : theme.textMuted }}
                          >
                            {isPaid ? 'Valor Quitada' : item.paid_amount > 0 ? 'Saldo a Pagar' : 'Valor Previsto'}
                          </p>
                          <p
                            className="text-base sm:text-lg font-extrabold"
                            style={{ color: isPaid ? theme.success : isLight ? '#0F172A' : theme.textPrimary }}
                          >
                            {formatCurrencyBRL(isPaid ? item.paid_amount : remaining)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canCreate && !canEdit) {
                                  onRequirePermission?.('financeiro.editar_lancamento');
                                  return;
                                }
                                setPayingItem(item);
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:opacity-95 active:scale-95 cursor-pointer"
                              style={{
                                background: theme.accentGradient,
                                color: theme.btnPrimaryText,
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Marcar como Pago</span>
                            </button>
                          )}

                          {item.expense_type === 'variable' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canEdit) {
                                  onRequirePermission?.('financeiro.editar_lancamento');
                                  return;
                                }
                                setEditingVariable(item);
                                setVariableModalOpen(true);
                              }}
                              className="p-2.5 rounded-xl border transition-colors cursor-pointer"
                              style={{
                                borderColor: isLight ? '#CBD5E1' : theme.border,
                                color: isLight ? '#334155' : theme.textSecondary,
                              }}
                              title="Editar despesa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-ABA 2: GASTOS FIXOS (DESPESAS RECORRENTES)
         ===================================================================== */}
      {subTab === 'fixos' && (
        <div className="space-y-4">
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            style={{
              background: isLight ? '#FFFFFF' : theme.cardBg,
              borderColor: isLight ? '#E2E8F0' : theme.border,
            }}
          >
            <div>
              <h3 className="text-base font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                Regras de Gastos Fixos
              </h3>
              <p className="text-xs mt-0.5" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Aluguel, internet, energia, água e assinaturas geram competências automáticas sem recadastro mensal.
              </p>
            </div>
          </div>

          {loadingRules ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: theme.accent }} />
            </div>
          ) : recurringRules.length === 0 ? (
            <div
              className="p-10 text-center rounded-2xl border border-dashed"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : 'transparent',
              }}
            >
              <Repeat className="w-8 h-8 mx-auto mb-2" style={{ color: theme.accent }} />
              <p className="text-sm font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                Nenhum gasto fixo cadastrado ainda.
              </p>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Cadastre contas recorrentes como Aluguel, Energia ou Internet uma única vez para acompanhar todos os meses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recurringRules.map((rule) => {
                const ruleOccurrences = payables.filter((p) => p.recurring_expense_id === rule.id);
                const openCount = ruleOccurrences.filter(
                  (p) => p.status !== 'paid' && p.status !== 'canceled'
                ).length;

                const statusConfig =
                  rule.status === 'active'
                    ? { label: 'Ativa', color: theme.success, bg: `${theme.success}18` }
                    : rule.status === 'paused'
                      ? { label: 'Pausada', color: theme.warning, bg: `${theme.warning}18` }
                      : { label: 'Encerrada', color: theme.textMuted, bg: theme.inputBg };

                return (
                  <div
                    key={rule.id}
                    className="p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all"
                    style={{
                      background: isLight ? '#FFFFFF' : theme.cardBg,
                      borderColor: isLight ? '#E2E8F0' : theme.border,
                    }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className="text-base font-bold truncate"
                              style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                            >
                              {rule.description}
                            </h4>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: statusConfig.bg, color: statusConfig.color }}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                            {rule.category}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className="text-base sm:text-lg font-extrabold"
                            style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                          >
                            {formatCurrencyBRL(rule.amount)}
                          </p>
                          <p className="text-[11px] font-semibold" style={{ color: theme.accent }}>
                            {getFrequencyLabel(rule.frequency)}
                            {rule.frequency !== 'weekly' && rule.frequency !== 'biweekly' && rule.due_day
                              ? ` • Dia ${String(rule.due_day).padStart(2, '0')}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div
                        className="mt-3 p-2.5 rounded-xl flex items-center justify-between text-xs"
                        style={{ background: isLight ? '#F8FAFC' : theme.inputBg }}
                      >
                        <span style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                          Próximo venc.:{' '}
                          <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                            {rule.status === 'ended' ? 'Encerrada' : formatDateBR(rule.next_due_date)}
                          </strong>
                        </span>
                        <span className="font-semibold" style={{ color: openCount > 0 ? theme.warning : theme.success }}>
                          {openCount > 0 ? `${openCount} pendente(s)` : 'Em dia'}
                        </span>
                      </div>
                    </div>

                    {/* Botões de ação da regra recorrente */}
                    <div
                      className="pt-3 border-t flex flex-wrap items-center justify-between gap-2"
                      style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                    >
                      <button
                        type="button"
                        onClick={() => setHistoryRule(rule)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer"
                        style={{
                          borderColor: isLight ? '#CBD5E1' : theme.border,
                          background: isLight ? '#F8FAFC' : theme.inputBg,
                          color: isLight ? '#0F172A' : theme.textPrimary,
                        }}
                      >
                        <History className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                        <span>Competências ({ruleOccurrences.length})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              onRequirePermission?.('financeiro.editar_lancamento');
                              return;
                            }
                            setEditingRule(rule);
                            setRuleModalOpen(true);
                          }}
                          className="p-2 rounded-xl border transition-colors cursor-pointer"
                          style={{
                            borderColor: isLight ? '#CBD5E1' : theme.border,
                            color: isLight ? '#334155' : theme.textSecondary,
                          }}
                          title="Editar regra"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {rule.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                title: 'Pausar recorrência?',
                                message: `Novos vencimentos futuros de "${rule.description}" não serão gerados enquanto estiver pausada. Os pagamentos anteriores continuam salvos.`,
                                confirmLabel: 'Pausar',
                                onConfirm: async () => {
                                  await updateRecurringRuleLifecycle(tenantId, rule.id, 'pause');
                                  invalidateAllFinancialQueries();
                                  toast.success('Recorrência pausada.');
                                },
                              });
                            }}
                            className="p-2 rounded-xl border transition-colors cursor-pointer"
                            style={{ borderColor: `${theme.warning}40`, color: theme.warning }}
                            title="Pausar recorrência"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {rule.status !== 'active' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateRecurringRuleLifecycle(tenantId, rule.id, 'resume');
                              invalidateAllFinancialQueries();
                              toast.success('Recorrência reativada!');
                            }}
                            className="p-2 rounded-xl border transition-colors cursor-pointer"
                            style={{ borderColor: `${theme.success}40`, color: theme.success }}
                            title="Reativar recorrência"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {rule.status !== 'ended' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                title: 'Encerrar recorrência?',
                                message: `O gasto fixo "${rule.description}" será encerrado a partir de hoje. Todo o histórico já pago será preservado.`,
                                confirmLabel: 'Encerrar',
                                onConfirm: async () => {
                                  await updateRecurringRuleLifecycle(tenantId, rule.id, 'end');
                                  invalidateAllFinancialQueries();
                                  toast.success('Recorrência encerrada.');
                                },
                              });
                            }}
                            className="p-2 rounded-xl border transition-colors cursor-pointer"
                            style={{
                              borderColor: isLight ? '#CBD5E1' : theme.border,
                              color: isLight ? '#475569' : theme.textSecondary,
                            }}
                            title="Encerrar recorrência"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!canDelete) {
                              onRequirePermission?.('financeiro.excluir_lancamento');
                              return;
                            }
                            setConfirmDialog({
                              title: 'Excluir regra de gasto fixo?',
                              message: `A regra "${rule.description}" e suas cobranças futuras em aberto serão removidas. Os pagamentos já confirmados serão mantidos no seu histórico financeiro.`,
                              confirmLabel: 'Excluir Regra',
                              isDanger: true,
                              onConfirm: async () => {
                                await updateRecurringRuleLifecycle(tenantId, rule.id, 'delete');
                                invalidateAllFinancialQueries();
                                toast.success('Regra excluída com preservação do histórico.');
                              },
                            });
                          }}
                          className="p-2 rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: `${theme.error}40`, color: theme.error }}
                          title="Excluir regra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-ABA 3: GASTOS VARIÁVEIS (DESPESAS PONTUAIS DO DIA A DIA)
         ===================================================================== */}
      {subTab === 'variaveis' && (
        <div className="space-y-4">
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{
              background: isLight ? '#FFFFFF' : theme.cardBg,
              borderColor: isLight ? '#E2E8F0' : theme.border,
            }}
          >
            <div>
              <h3 className="text-base font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                Gastos Variáveis do Mês
              </h3>
              <p className="text-xs mt-0.5" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Compras de esmaltes, cremes, descartáveis, produtos de cabelo, manutenção e insumos.
              </p>
            </div>

            <div
              className="flex gap-1 p-1 rounded-xl border self-start sm:self-auto"
              style={{
                background: isLight ? '#F8FAFC' : theme.inputBg,
                borderColor: isLight ? '#E2E8F0' : theme.border,
              }}
            >
              {[
                { id: 'all' as const, label: 'Todos' },
                { id: 'paid' as const, label: 'Pagos' },
                { id: 'pending' as const, label: 'Pendentes' },
              ].map((f) => {
                const active = variableStatusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVariableStatusFilter(f.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: active ? theme.accentGradient : 'transparent',
                      color: active ? theme.btnPrimaryText : isLight ? '#475569' : theme.textSecondary,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingPayables ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: theme.accent }} />
            </div>
          ) : variableExpensesInMonth.length === 0 ? (
            <div
              className="p-10 text-center rounded-2xl border border-dashed"
              style={{
                borderColor: isLight ? '#E2E8F0' : theme.border,
                background: isLight ? '#F8FAFC' : 'transparent',
              }}
            >
              <ShoppingBag className="w-8 h-8 mx-auto mb-2" style={{ color: theme.accent }} />
              <p className="text-sm font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                Nenhum gasto variável registrado neste período.
              </p>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Registre compras de materiais, produtos de limpeza ou pequenos reparos como pagos ou pendentes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {variableExpensesInMonth.map((item) => {
                const display = computePayableDisplayStatus(item);
                const remaining = getRemainingAmount(item);
                const isPaid = item.status === 'paid';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all"
                    style={{
                      background: isLight ? '#FFFFFF' : theme.cardBg,
                      borderColor: isLight ? '#E2E8F0' : theme.border,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className="text-sm sm:text-base font-bold"
                          style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                        >
                          {item.description}
                        </h4>
                        <PayableStatusBadge status={display.code} label={display.label} compact />
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1.5"
                        style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                      >
                        <span>{item.category}</span>
                        <span>•</span>
                        <span>Compra: {formatDateBR(item.purchase_date || item.due_date)}</span>
                        {!isPaid && (
                          <>
                            <span>•</span>
                            <span>Venc.: {formatDateBR(item.due_date)}</span>
                          </>
                        )}
                        {item.payment_method && (
                          <>
                            <span>•</span>
                            <span>{item.payment_method}</span>
                          </>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs mt-1 italic" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div
                      className="flex items-center justify-between md:justify-end gap-3 pt-2.5 md:pt-0 border-t md:border-t-0"
                      style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                    >
                      <p
                        className="text-base font-extrabold whitespace-nowrap"
                        style={{ color: isPaid ? theme.error : isLight ? '#0F172A' : theme.textPrimary }}
                      >
                        {isPaid ? `-${formatCurrencyBRL(item.paid_amount)}` : formatCurrencyBRL(remaining)}
                      </p>

                      <div className="flex items-center gap-1.5">
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => setPayingItem(item)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                            style={{
                              background: theme.accentGradient,
                              color: theme.btnPrimaryText,
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Pagar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              onRequirePermission?.('financeiro.editar_lancamento');
                              return;
                            }
                            setEditingVariable(item);
                            setVariableModalOpen(true);
                          }}
                          className="p-2 rounded-xl border transition-colors cursor-pointer"
                          style={{
                            borderColor: isLight ? '#CBD5E1' : theme.border,
                            color: isLight ? '#334155' : theme.textSecondary,
                          }}
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!canDelete) {
                              onRequirePermission?.('financeiro.excluir_lancamento');
                              return;
                            }
                            setConfirmDialog({
                              title: 'Excluir gasto variável?',
                              message: `A despesa "${item.description}" será excluída (e caso já tenha sido paga, sua saída correspondente no caixa também será estornada).`,
                              confirmLabel: 'Excluir',
                              isDanger: true,
                              onConfirm: async () => {
                                await deleteExpensePayable(tenantId, item.id);
                                invalidateAllFinancialQueries();
                                toast.success('Despesa variável removida.');
                              },
                            });
                          }}
                          className="p-2 rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: `${theme.error}40`, color: theme.error }}
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <PayObligationModal
        isOpen={Boolean(payingItem)}
        payable={payingItem}
        onClose={() => setPayingItem(null)}
        onConfirm={async (input) => {
          await payMutation.mutateAsync(input);
        }}
        isLoading={payMutation.isPending}
      />

      <RecurringRuleModal
        isOpen={ruleModalOpen}
        rule={editingRule}
        onClose={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSave={async (input) => {
          await saveRuleMutation.mutateAsync(input);
        }}
        isLoading={saveRuleMutation.isPending}
      />

      <RecurringHistoryModal
        isOpen={Boolean(historyRule)}
        rule={historyRule}
        occurrences={historyRuleOccurrences}
        onClose={() => setHistoryRule(null)}
        onPayClick={(occ) => {
          setHistoryRule(null);
          setPayingItem(occ);
        }}
      />

      <VariableExpenseModal
        isOpen={variableModalOpen}
        tenantId={tenantId}
        payable={editingVariable}
        onClose={() => {
          setVariableModalOpen(false);
          setEditingVariable(null);
        }}
        onSave={async (input) => {
          await saveVariableMutation.mutateAsync(input);
        }}
        isLoading={saveVariableMutation.isPending}
      />

      {/* Modal de Confirmação Segura */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="border rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center shadow-2xl"
            style={{
              borderColor: isLight ? '#E2E8F0' : theme.border,
              background: isLight ? '#FFFFFF' : theme.cardBg,
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: confirmDialog.isDanger ? `${theme.error}15` : theme.accentMuted,
                color: confirmDialog.isDanger ? theme.error : theme.accent,
              }}
            >
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
            >
              {confirmDialog.title}
            </h3>
            <p
              className="text-xs sm:text-sm mb-6 leading-relaxed"
              style={{ color: isLight ? '#475569' : theme.textSecondary }}
            >
              {confirmDialog.message}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmRunning}
                className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-all cursor-pointer"
                style={{
                  borderColor: isLight ? '#CBD5E1' : theme.border,
                  color: isLight ? '#0F172A' : theme.textPrimary,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={isConfirmRunning}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                style={{
                  background: confirmDialog.isDanger ? theme.error : theme.accentGradient,
                  color: confirmDialog.isDanger ? '#FFFFFF' : theme.btnPrimaryText,
                }}
              >
                {isConfirmRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  confirmDialog.confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

