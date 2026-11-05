import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../contexts/ThemeContext';
import { Modal } from '../../../components/ui/Modal';
import { supabase } from '../../../integrations/supabase/client';
import {
  getTodayLocalISO,
  parseCurrencyInput,
  toDateOnlyISO,
} from '../../../services/financialService';
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  VARIABLE_EXPENSE_CATEGORIES,
} from '../../../types/financial';

export interface FinancialTransaction {
  id?: string;
  payable_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  payment_method: string;
  professional_id?: string | null;
  date?: string;
  due_date?: string;
  expense_status?: 'paid' | 'pending';
  notes?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: FinancialTransaction) => Promise<void>;
  transaction?: FinancialTransaction | null;
  tenantId: string;
  isLoading?: boolean;
  isRecurringMode?: boolean;
}

export function ManualTransactionModal({
  isOpen,
  onClose,
  onSave,
  transaction,
  tenantId,
  isLoading,
  isRecurringMode = false,
}: Props) {
  const { theme } = useTheme();
  const isEditing = !!transaction?.id;

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [expenseStatus, setExpenseStatus] = useState<'paid' | 'pending'>('paid');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayLocalISO());
  const [dueDate, setDueDate] = useState<string>(getTodayLocalISO());
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals_select', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!tenantId && isOpen,
  });

  useEffect(() => {
    const today = getTodayLocalISO();
    if (transaction) {
      setType(transaction.type);
      setExpenseStatus('paid');
      setAmount(Number(transaction.amount || 0).toFixed(2).replace('.', ','));
      setDescription(transaction.description || '');
      setCategory(
        transaction.category ||
          (transaction.type === 'income' ? INCOME_CATEGORIES[0] : VARIABLE_EXPENSE_CATEGORIES[0])
      );
      setPaymentMethod(transaction.payment_method || 'PIX');
      setProfessionalId(transaction.professional_id || '');
      setDate(transaction.date ? toDateOnlyISO(transaction.date) : today);
      setDueDate(transaction.due_date ? toDateOnlyISO(transaction.due_date) : today);
      setNotes(transaction.notes || '');
    } else if (isRecurringMode) {
      setType('expense');
      setExpenseStatus('paid');
      setCategory('Aluguel / Condomínio');
      setAmount('');
      setDescription('');
      setNotes('');
    } else {
      setType('income');
      setExpenseStatus('paid');
      setAmount('');
      setDescription('');
      setCategory(INCOME_CATEGORIES[0]);
      setPaymentMethod('PIX');
      setProfessionalId('');
      setDate(today);
      setDueDate(today);
      setNotes('');
    }
    setError(null);
  }, [transaction, isOpen, isRecurringMode]);

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory(newType === 'income' ? INCOME_CATEGORIES[0] : VARIABLE_EXPENSE_CATEGORIES[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseCurrencyInput(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }
    if (!description.trim()) {
      setError('Informe uma descrição para o lançamento.');
      return;
    }

    try {
      setError(null);
      await onSave({
        id: transaction?.id,
        payable_id: transaction?.payable_id || null,
        type,
        amount: parsedAmount,
        description: description.trim(),
        category,
        payment_method: paymentMethod,
        professional_id: professionalId || null,
        date: `${toDateOnlyISO(date)}T12:00:00Z`,
        due_date: type === 'expense' && expenseStatus === 'pending' ? toDateOnlyISO(dueDate) : toDateOnlyISO(date),
        expense_status: type === 'expense' ? expenseStatus : 'paid',
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar lançamento financeiro.');
    }
  };

  const baseCategories = type === 'income' ? INCOME_CATEGORIES : VARIABLE_EXPENSE_CATEGORIES;
  const categories = baseCategories.includes(category) ? baseCategories : [category, ...baseCategories];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
      subtitle={
        isEditing
          ? 'Atualize os dados da movimentação'
          : 'Registre uma entrada avulsa ou uma despesa operacional'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seletor Receita / Despesa */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border" style={{ background: theme.inputBg, borderColor: theme.border }}>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            disabled={isRecurringMode || isEditing}
            className="py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
            style={{
              background: type === 'income' ? theme.success : 'transparent',
              color: type === 'income' ? '#FFFFFF' : theme.textSecondary,
            }}
          >
            + Receita (Entrada)
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            disabled={isRecurringMode || isEditing}
            className="py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
            style={{
              background: type === 'expense' ? theme.error : 'transparent',
              color: type === 'expense' ? '#FFFFFF' : theme.textSecondary,
            }}
          >
            - Despesa (Saída)
          </button>
        </div>

        {/* Quando for nova despesa, permite escolher se já foi paga ou se é conta a pagar */}
        {type === 'expense' && !isEditing && !isRecurringMode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setExpenseStatus('paid')}
              className="py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              style={{
                borderColor: expenseStatus === 'paid' ? theme.accent : theme.border,
                background: expenseStatus === 'paid' ? theme.accentMuted : theme.inputBg,
                color: expenseStatus === 'paid' ? theme.accent : theme.textSecondary,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Já foi paga</span>
            </button>
            <button
              type="button"
              onClick={() => setExpenseStatus('pending')}
              className="py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              style={{
                borderColor: expenseStatus === 'pending' ? theme.accent : theme.border,
                background: expenseStatus === 'pending' ? theme.accentMuted : theme.inputBg,
                color: expenseStatus === 'pending' ? theme.accent : theme.textSecondary,
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendente (A Pagar)</span>
            </button>
          </div>
        )}

        {error && (
          <div
            className="p-3 rounded-xl text-xs font-semibold border"
            style={{
              background: `${theme.error}15`,
              color: theme.error,
              borderColor: `${theme.error}35`,
            }}
          >
            {error}
          </div>
        )}

        {/* Valor e Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Valor (R$) *
            </label>
            <div
              className="flex items-center rounded-xl border overflow-hidden"
              style={{ borderColor: theme.border, background: theme.inputBg }}
            >
              <span
                className="px-3.5 py-2.5 text-sm font-bold select-none border-r shrink-0"
                style={{
                  color: type === 'income' ? theme.success : theme.error,
                  borderColor: theme.border,
                  background: type === 'income' ? `${theme.success}15` : `${theme.error}15`,
                }}
              >
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                className="w-full px-3.5 py-2.5 bg-transparent border-0 text-sm font-bold focus:outline-none"
                style={{ color: theme.textPrimary }}
                required
              />
            </div>
          </div>

          {!isRecurringMode && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
                {type === 'expense' && expenseStatus === 'pending' ? 'Data de Vencimento *' : 'Data *'}
              </label>
              <input
                type="date"
                value={type === 'expense' && expenseStatus === 'pending' ? dueDate : date}
                onChange={(e) => {
                  if (type === 'expense' && expenseStatus === 'pending') {
                    setDueDate(e.target.value);
                  } else {
                    setDate(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                required
              />
            </div>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
            Descrição *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === 'income'
                ? 'Ex: Venda de shampoo, gorjeta, atendimento avulso...'
                : 'Ex: Compra de esmaltes, produtos de limpeza...'
            }
            className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            required
          />
        </div>

        {/* Categoria e Forma de Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Profissional Vinculado (Opcional) */}
        {!isRecurringMode && professionals.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Profissional Vinculado (Opcional)
            </label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              <option value="">Geral (Estabelecimento todo)</option>
              {professionals.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-3 border-t" style={{ borderColor: theme.border }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer"
            style={{ borderColor: theme.border, color: theme.textSecondary }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:opacity-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: theme.accentGradient,
              color: theme.btnPrimaryText,
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              'Salvar Alterações'
            ) : type === 'expense' && expenseStatus === 'pending' ? (
              'Salvar em Contas a Pagar'
            ) : (
              'Confirmar Lançamento'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
