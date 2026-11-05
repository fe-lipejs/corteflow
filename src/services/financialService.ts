import { endOfMonth, startOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../integrations/supabase/client';
import type {
  ExpensePayable,
  MonthlyComparisonPoint,
  PayableDisplayStatus,
  PayObligationInput,
  RecurringExpenseRule,
  RecurringFrequency,
  RecurringRuleInput,
  VariableExpenseInput,
} from '../types/financial';

// ============================================================================
// UTILITÁRIOS DE MOEDA E DATA (TIMEZONE-SAFE)
// ============================================================================

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function parseCurrencyInput(raw: string): number {
  const clean = raw.trim().replace(/[^\d.,]/g, '');
  if (!clean) return NaN;
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.'));
  }
  return parseFloat(clean);
}

/** Retorna a data local de hoje no formato YYYY-MM-DD sem deslocamento UTC */
export function getTodayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extrai YYYY-MM-DD de uma string ISO ou DATE sem deslocamento de fuso */
export function toDateOnlyISO(dateStr: string | null | undefined): string {
  if (!dateStr) return getTodayLocalISO();
  return String(dateStr).slice(0, 10);
}

/** Converte YYYY-MM-DD para Date local ao meio-dia (evita bug de -1 dia no fuso -03:00) */
export function parseLocalDate(dateStr: string | null | undefined): Date {
  const iso = toDateOnlyISO(dateStr);
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const iso = toDateOnlyISO(dateStr);
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

export function formatShortDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const iso = toDateOnlyISO(dateStr);
  const [, m, d] = iso.split('-');
  if (!m || !d) return '—';
  return `${d}/${m}`;
}

export function formatCompetenceLabel(dateStr: string | null | undefined, frequency?: RecurringFrequency): string {
  if (!dateStr) return '—';
  const dt = parseLocalDate(dateStr);
  if (frequency === 'weekly' || frequency === 'biweekly') {
    return `Ciclo ${formatDateBR(dateStr)}`;
  }
  const label = format(dt, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Diferença em dias inteiros entre dueDate (YYYY-MM-DD) e hoje (negativo = atrasado, 0 = vence hoje) */
export function diffDaysFromToday(dueDateStr: string): number {
  const due = parseLocalDate(dueDateStr);
  const today = parseLocalDate(getTodayLocalISO());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((due.getTime() - today.getTime()) / msPerDay);
}

export function getRemainingAmount(payable: Pick<ExpensePayable, 'expected_amount' | 'paid_amount' | 'status'>): number {
  if (payable.status === 'paid' || payable.status === 'canceled') return 0;
  return Math.max(0, Number(payable.expected_amount || 0) - Number(payable.paid_amount || 0));
}

export function getFrequencyLabel(frequency: RecurringFrequency | string): string {
  switch (frequency) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quinzenal';
    case 'monthly':
      return 'Mensal';
    case 'quarterly':
      return 'Trimestral';
    case 'semiannual':
      return 'Semestral';
    case 'yearly':
      return 'Anual';
    default:
      return 'Mensal';
  }
}

/**
 * Calcula o status semântico de exibição de uma obrigação (Seção 7)
 * Estados: Pago | Atrasado | Vence Hoje | Próxima do Vencimento (<= 5 dias) | Agendado | Parcial | Pendente
 */
export function computePayableDisplayStatus(payable: ExpensePayable): {
  code: PayableDisplayStatus;
  label: string;
  daysDiff: number;
} {
  const daysDiff = diffDaysFromToday(payable.due_date);

  if (payable.status === 'paid') {
    return { code: 'paid', label: 'Pago', daysDiff };
  }

  if (daysDiff < 0) {
    return {
      code: 'overdue',
      label: payable.status === 'partial' ? 'Atrasado (Parcial)' : 'Atrasado',
      daysDiff,
    };
  }

  if (daysDiff === 0) {
    return {
      code: 'due_today',
      label: payable.status === 'partial' ? 'Vence Hoje (Parcial)' : 'Vence Hoje',
      daysDiff,
    };
  }

  if (payable.status === 'scheduled') {
    return { code: 'scheduled', label: 'Agendado', daysDiff };
  }

  if (daysDiff <= 5) {
    return {
      code: 'due_soon',
      label: payable.status === 'partial' ? 'Próximo (Parcial)' : 'Próxima do Venc.',
      daysDiff,
    };
  }

  if (payable.status === 'partial') {
    return { code: 'partial', label: 'Parcial', daysDiff };
  }

  return { code: 'pending', label: 'Pendente', daysDiff };
}

/** Clamp de dia do mês (ex: dia 31 em fevereiro vira 28 ou 29) */
export function clampDayInMonth(year: number, month1Based: number, targetDay: number): string {
  const lastDay = new Date(year, month1Based, 0).getDate();
  const safeDay = Math.min(Math.max(1, targetDay), lastDay);
  return `${year}-${String(month1Based).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

// ============================================================================
// OPERAÇÕES DE BANCO DE DADOS E REGRAS DE NEGÓCIO
// ============================================================================

/** Garante a geração idempotente das competências recorrentes até o horizonte desejado */
export async function ensureRecurringPayables(tenantId: string, referenceMonth?: Date): Promise<void> {
  if (!tenantId) return;
  const refEnd = referenceMonth ? endOfMonth(referenceMonth) : new Date();
  const minHorizon = new Date();
  minHorizon.setDate(minHorizon.getDate() + 45);
  const horizon = refEnd > minHorizon ? refEnd : minHorizon;
  const horizonISO = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, '0')}-${String(horizon.getDate()).padStart(2, '0')}`;

  const { error } = await supabase.rpc('ensure_recurring_payables', {
    p_tenant_id: tenantId,
    p_horizon_date: horizonISO,
  });

  if (error) {
    console.error('Erro ao sincronizar recorrências:', error);
  }
}

export async function fetchRecurringRules(tenantId: string): Promise<RecurringExpenseRule[]> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    amount: Number(r.amount || 0),
    status: r.status || (r.active === false ? 'paused' : 'active'),
  }));
}

export async function fetchExpensePayables(
  tenantId: string,
  selectedProfessionalId?: string | null
): Promise<ExpensePayable[]> {
  let query = supabase
    .from('expense_payables')
    .select(`
      *,
      expense_payments (
        id,
        tenant_id,
        payable_id,
        financial_transaction_id,
        amount,
        paid_at,
        payment_method,
        notes,
        created_at
      )
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true });

  if (selectedProfessionalId) {
    query = query.eq('professional_id', selectedProfessionalId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    expected_amount: Number(row.expected_amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    due_date: toDateOnlyISO(row.due_date),
    purchase_date: row.purchase_date ? toDateOnlyISO(row.purchase_date) : null,
    paid_at: row.paid_at ? toDateOnlyISO(row.paid_at) : null,
    competence_date: row.competence_date ? toDateOnlyISO(row.competence_date) : null,
    expense_payments: (row.expense_payments || []).map((p: any) => ({
      ...p,
      amount: Number(p.amount || 0),
      paid_at: toDateOnlyISO(p.paid_at),
    })),
  }));
}

/**
 * Cria ou atualiza uma regra de Gasto Fixo.
 * Ao editar, preserva 100% dos pagamentos anteriores e atualiza apenas as ocorrências futuras em aberto.
 */
export async function saveRecurringRule(tenantId: string, input: RecurringRuleInput): Promise<void> {
  const startISO = toDateOnlyISO(input.start_date);
  const startParts = startISO.split('-').map(Number);
  const effectiveDueDay =
    input.frequency === 'weekly' || input.frequency === 'biweekly'
      ? startParts[2]
      : Math.min(31, Math.max(1, Number(input.due_day || startParts[2] || 1)));

  const initialNextDue =
    input.frequency === 'weekly' || input.frequency === 'biweekly'
      ? startISO
      : clampDayInMonth(startParts[0], startParts[1], effectiveDueDay);

  if (!input.id) {
    const { error } = await supabase.from('recurring_expenses').insert({
      tenant_id: tenantId,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      payment_method: input.payment_method || 'PIX',
      frequency: input.frequency,
      due_day: effectiveDueDay,
      start_date: startISO,
      end_date: input.end_date ? toDateOnlyISO(input.end_date) : null,
      next_due_date: initialNextDue,
      notes: input.notes?.trim() || null,
      active: true,
      status: 'active',
    });
    if (error) throw error;
    await ensureRecurringPayables(tenantId);
    return;
  }

  // Edição de regra existente: preservar histórico pago e atualizar ocorrências futuras pendentes
  const { data: existingRule, error: fetchErr } = await supabase
    .from('recurring_expenses')
    .select('frequency, status, active')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .single();
  if (fetchErr) throw fetchErr;

  const frequencyChanged = existingRule.frequency !== input.frequency;
  const todayISO = getTodayLocalISO();

  const { error: updateRuleErr } = await supabase
    .from('recurring_expenses')
    .update({
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      payment_method: input.payment_method || 'PIX',
      frequency: input.frequency,
      due_day: effectiveDueDay,
      start_date: startISO,
      end_date: input.end_date ? toDateOnlyISO(input.end_date) : null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId);

  if (updateRuleErr) throw updateRuleErr;

  // Buscar ocorrências ainda não pagas (paid_amount = 0 e pendentes/agendadas) a partir de hoje
  const { data: futureUnpaid } = await supabase
    .from('expense_payables')
    .select('id, competence_date, due_date')
    .eq('tenant_id', tenantId)
    .eq('recurring_expense_id', input.id)
    .is('deleted_at', null)
    .in('status', ['pending', 'scheduled'])
    .eq('paid_amount', 0)
    .gte('due_date', todayISO);

  if (frequencyChanged) {
    // Se mudou a frequência (ex: mensal -> trimestral), remove as futuras não pagas e regenera limpo
    if (futureUnpaid && futureUnpaid.length > 0) {
      await supabase
        .from('expense_payables')
        .update({ deleted_at: new Date().toISOString() })
        .in(
          'id',
          futureUnpaid.map((u: any) => u.id)
        )
        .eq('tenant_id', tenantId);
    }
  } else if (futureUnpaid && futureUnpaid.length > 0) {
    const cleanEndDate = input.end_date ? toDateOnlyISO(input.end_date) : null;

    for (const occ of futureUnpaid) {
      const compISO = toDateOnlyISO(occ.competence_date || occ.due_date);
      const [cy, cm] = compISO.split('-').map(Number);
      const newDueDate =
        input.frequency === 'weekly' || input.frequency === 'biweekly'
          ? toDateOnlyISO(occ.due_date)
          : clampDayInMonth(cy, cm, effectiveDueDay);

      if (cleanEndDate && newDueDate > cleanEndDate) {
        await supabase
          .from('expense_payables')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', occ.id)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('expense_payables')
          .update({
            description: input.description.trim(),
            category: input.category,
            expected_amount: input.amount,
            due_date: newDueDate,
            payment_method: input.payment_method || 'PIX',
            notes: input.notes?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', occ.id)
          .eq('tenant_id', tenantId);
      }
    }
  }

  if (existingRule.status === 'active' || existingRule.active) {
    await ensureRecurringPayables(tenantId);
  }
}

/**
 * Gerencia o ciclo de vida da recorrência (Pausar, Retomar, Encerrar, Excluir)
 * Sempre preservando pagamentos e competências já quitadas/parciais.
 */
export async function updateRecurringRuleLifecycle(
  tenantId: string,
  ruleId: string,
  action: 'pause' | 'resume' | 'end' | 'delete'
): Promise<void> {
  const todayISO = getTodayLocalISO();
  const nowISO = new Date().toISOString();

  if (action === 'pause') {
    const endOfCurrentMonthISO = toDateOnlyISO(endOfMonth(new Date()).toISOString());
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ status: 'paused', active: false, updated_at: nowISO })
      .eq('id', ruleId)
      .eq('tenant_id', tenantId);
    if (error) throw error;

    // Remove apenas obrigações futuras além do mês atual que estejam intactas (paid_amount = 0)
    await supabase
      .from('expense_payables')
      .update({ deleted_at: nowISO })
      .eq('tenant_id', tenantId)
      .eq('recurring_expense_id', ruleId)
      .is('deleted_at', null)
      .in('status', ['pending', 'scheduled'])
      .eq('paid_amount', 0)
      .gt('due_date', endOfCurrentMonthISO);
    return;
  }

  if (action === 'resume') {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ status: 'active', active: true, end_date: null, updated_at: nowISO })
      .eq('id', ruleId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    await ensureRecurringPayables(tenantId);
    return;
  }

  if (action === 'end') {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ status: 'ended', active: false, end_date: todayISO, updated_at: nowISO })
      .eq('id', ruleId)
      .eq('tenant_id', tenantId);
    if (error) throw error;

    await supabase
      .from('expense_payables')
      .update({ deleted_at: nowISO })
      .eq('tenant_id', tenantId)
      .eq('recurring_expense_id', ruleId)
      .is('deleted_at', null)
      .in('status', ['pending', 'scheduled'])
      .eq('paid_amount', 0)
      .gt('due_date', todayISO);
    return;
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ deleted_at: nowISO, active: false, status: 'ended', updated_at: nowISO })
      .eq('id', ruleId)
      .eq('tenant_id', tenantId);
    if (error) throw error;

    // Exclui somente competências em aberto sem nenhum pagamento realizado (preserva 100% o histórico financeiro)
    await supabase
      .from('expense_payables')
      .update({ deleted_at: nowISO })
      .eq('tenant_id', tenantId)
      .eq('recurring_expense_id', ruleId)
      .is('deleted_at', null)
      .in('status', ['pending', 'scheduled'])
      .eq('paid_amount', 0);
  }
}

/** Confirma o pagamento integral ou parcial de uma obrigação via RPC atômica */
export async function payExpensePayable(input: PayObligationInput): Promise<any> {
  const { data, error } = await supabase.rpc('pay_expense_payable', {
    p_payable_id: input.payableId,
    p_amount: input.amount,
    p_paid_at: toDateOnlyISO(input.paidAt),
    p_payment_method: input.paymentMethod,
    p_notes: input.notes?.trim() || null,
    p_settle_full: input.settleFull,
  });

  if (error) throw error;
  return data;
}

/** Cria ou edita uma Despesa Variável (pontual) */
export async function saveVariableExpense(tenantId: string, input: VariableExpenseInput): Promise<void> {
  const purchaseISO = toDateOnlyISO(input.purchase_date);
  const dueISO = toDateOnlyISO(input.due_date || input.purchase_date);
  const paidAtISO = toDateOnlyISO(input.paid_at || input.purchase_date);

  if (!input.id) {
    const initialDbStatus = input.initial_status === 'scheduled' ? 'scheduled' : 'pending';
    const { data: created, error } = await supabase
      .from('expense_payables')
      .insert({
        tenant_id: tenantId,
        expense_type: 'variable',
        description: input.description.trim(),
        category: input.category,
        expected_amount: input.amount,
        paid_amount: 0,
        purchase_date: purchaseISO,
        due_date: dueISO,
        status: initialDbStatus,
        payment_method: input.payment_method || 'PIX',
        professional_id: input.professional_id || null,
        notes: input.notes?.trim() || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Se já foi paga no ato da compra, quita imediatamente gerando saída única no Fluxo de Caixa
    if (input.initial_status === 'paid' && created?.id) {
      await payExpensePayable({
        payableId: created.id,
        amount: input.amount,
        paidAt: paidAtISO,
        paymentMethod: input.payment_method || 'PIX',
        notes: input.notes || undefined,
        settleFull: true,
      });
    }
    return;
  }

  // Edição de despesa existente
  const { data: current, error: fetchErr } = await supabase
    .from('expense_payables')
    .select('*, expense_payments(*)')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .single();
  if (fetchErr) throw fetchErr;

  if (current.status === 'paid') {
    // Atualiza a obrigação e sincroniza o lançamento correspondente no Fluxo de Caixa (se pagamento único)
    const { error: updErr } = await supabase
      .from('expense_payables')
      .update({
        description: input.description.trim(),
        category: input.category,
        expected_amount: input.amount,
        paid_amount: input.amount,
        purchase_date: purchaseISO,
        due_date: dueISO,
        paid_at: paidAtISO,
        payment_method: input.payment_method || current.payment_method,
        professional_id: input.professional_id || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('tenant_id', tenantId);
    if (updErr) throw updErr;

    const payments = current.expense_payments || [];
    if (payments.length === 1) {
      const singlePayment = payments[0];
      await supabase
        .from('expense_payments')
        .update({
          amount: input.amount,
          paid_at: paidAtISO,
          payment_method: input.payment_method || singlePayment.payment_method,
          notes: input.notes?.trim() || null,
        })
        .eq('id', singlePayment.id)
        .eq('tenant_id', tenantId);

      if (singlePayment.financial_transaction_id) {
        await supabase
          .from('financial_transactions')
          .update({
            amount: input.amount,
            description: input.description.trim(),
            category: input.category,
            payment_method: input.payment_method || singlePayment.payment_method,
            professional_id: input.professional_id || null,
            date: `${paidAtISO}T12:00:00Z`,
            notes: input.notes?.trim() || null,
          })
          .eq('id', singlePayment.financial_transaction_id)
          .eq('tenant_id', tenantId);
      }
    }
  } else {
    // Obrigação estava pendente/agendada/parcial
    const nextPendingStatus =
      current.status === 'partial'
        ? 'partial'
        : input.initial_status === 'scheduled'
          ? 'scheduled'
          : 'pending';

    const { error: updErr } = await supabase
      .from('expense_payables')
      .update({
        description: input.description.trim(),
        category: input.category,
        expected_amount: input.amount,
        purchase_date: purchaseISO,
        due_date: dueISO,
        status: nextPendingStatus,
        payment_method: input.payment_method || current.payment_method,
        professional_id: input.professional_id || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('tenant_id', tenantId);
    if (updErr) throw updErr;

    // Se na edição a usuária marcou como Pago, confirma o pagamento do saldo restante
    if (input.initial_status === 'paid') {
      const remaining = Math.max(0.01, input.amount - Number(current.paid_amount || 0));
      await payExpensePayable({
        payableId: input.id,
        amount: remaining,
        paidAt: paidAtISO,
        paymentMethod: input.payment_method || 'PIX',
        notes: input.notes || undefined,
        settleFull: true,
      });
    }
  }
}

export async function deleteExpensePayable(tenantId: string, payableId: string): Promise<void> {
  const { error } = await supabase
    .from('expense_payables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', payableId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

/**
 * Busca a evolução real dos últimos 6 meses (Receitas Recebidas vs Despesas Pagas)
 * para análise gerencial clara e sem dados fictícios (Seção 8).
 */
export async function fetchSixMonthEvolution(
  tenantId: string,
  referenceMonth: Date,
  selectedProfessionalId?: string | null
): Promise<MonthlyComparisonPoint[]> {
  const startWindow = startOfMonth(subMonths(referenceMonth, 5));
  const endWindow = endOfMonth(referenceMonth);
  const startISO = startWindow.toISOString();
  const endISO = endWindow.toISOString();

  let paymentsQuery = supabase
    .from('payments')
    .select('amount, net_amount, status, created_at, booking_id, bookings(professional_id)')
    .eq('tenant_id', tenantId)
    .in('status', ['succeeded', 'refunded'])
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  let refundsQuery = supabase
    .from('refunds')
    .select('amount, status, created_at, payments(bookings(professional_id))')
    .eq('tenant_id', tenantId)
    .eq('status', 'succeeded')
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, scheduled_at, amount_total, amount_paid, payment_mode, professional_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('scheduled_at', startISO)
    .lte('scheduled_at', endISO);

  let manualQuery = supabase
    .from('financial_transactions')
    .select('type, amount, status, date, created_at, booking_id, professional_id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (selectedProfessionalId) {
    bookingsQuery = bookingsQuery.eq('professional_id', selectedProfessionalId);
    manualQuery = manualQuery.eq('professional_id', selectedProfessionalId);
  }

  const [{ data: payments }, { data: refunds }, { data: bookings }, { data: manualTx }] =
    await Promise.all([paymentsQuery, refundsQuery, bookingsQuery, manualQuery]);

  const buckets = new Map<string, MonthlyComparisonPoint>();
  for (let i = 5; i >= 0; i--) {
    const dt = subMonths(referenceMonth, i);
    const key = format(dt, 'yyyy-MM');
    const rawLabel = format(dt, 'MMM', { locale: ptBR }).replace('.', '');
    buckets.set(key, {
      monthKey: key,
      label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
      income: 0,
      expenses: 0,
    });
  }

  payments?.forEach((p: any) => {
    if (selectedProfessionalId && p.bookings?.professional_id !== selectedProfessionalId) return;
    const key = format(new Date(p.created_at), 'yyyy-MM');
    const bucket = buckets.get(key);
    if (bucket) bucket.income += Number(p.net_amount || p.amount || 0);
  });

  refunds?.forEach((r: any) => {
    if (selectedProfessionalId && r.payments?.bookings?.professional_id !== selectedProfessionalId) return;
    const key = format(new Date(r.created_at), 'yyyy-MM');
    const bucket = buckets.get(key);
    if (bucket) bucket.expenses += Number(r.amount || 0);
  });

  bookings?.forEach((b: any) => {
    const mode = b.payment_mode || 'local';
    let localVal = 0;
    if (mode === 'local' || mode === 'pay_local') {
      localVal = Number(b.amount_total || b.amount_paid || 0);
    } else if (mode === 'deposit' || mode === 'partial' || mode === 'partial_50') {
      const total = Number(b.amount_total || 0);
      const online = payments?.find((p: any) => p.booking_id === b.id);
      const onlinePaid = online ? Number(online.amount || 0) : total * 0.5;
      localVal = Math.max(0, total - onlinePaid);
    } else if (mode === 'full' || mode === 'full_100') {
      const hasOnline = payments?.some((p: any) => p.booking_id === b.id);
      localVal = hasOnline ? 0 : Number(b.amount_total || 0);
    } else {
      localVal = Number(b.amount_total || b.amount_paid || 0);
    }
    if (localVal > 0) {
      const key = format(new Date(b.scheduled_at), 'yyyy-MM');
      const bucket = buckets.get(key);
      if (bucket) bucket.income += localVal;
    }
  });

  manualTx?.forEach((m: any) => {
    if (m.booking_id && m.type === 'income') return;
    const isRealized =
      !m.status || m.status === 'succeeded' || m.status === 'approved' || m.status === 'completed';
    if (!isRealized) return;

    const rawDate = m.date || m.created_at;
    if (!rawDate) return;
    const key = String(rawDate).slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) return;

    if (m.type === 'income') {
      bucket.income += Number(m.amount || 0);
    } else {
      bucket.expenses += Number(m.amount || 0);
    }
  });

  return Array.from(buckets.values());
}

