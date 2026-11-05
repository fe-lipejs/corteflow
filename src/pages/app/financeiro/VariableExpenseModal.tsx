import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../integrations/supabase/client';
import {
  getTodayLocalISO,
  parseCurrencyInput,
  toDateOnlyISO,
} from '../../../services/financialService';
import {
  PAYMENT_METHODS,
  VARIABLE_EXPENSE_CATEGORIES,
  type ExpensePayable,
  type VariableExpenseInput,
} from '../../../types/financial';

interface VariableExpenseModalProps {
  isOpen: boolean;
  tenantId: string;
  payable: ExpensePayable | null;
  onClose: () => void;
  onSave: (input: VariableExpenseInput) => Promise<void>;
  isLoading?: boolean;
}

export function VariableExpenseModal({
  isOpen,
  tenantId,
  payable,
  onClose,
  onSave,
  isLoading = false,
}: VariableExpenseModalProps) {
  const { theme } = useTheme();
  const isEditing = !!payable?.id;

  const [statusChoice, setStatusChoice] = useState<'paid' | 'pending' | 'scheduled'>('paid');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(VARIABLE_EXPENSE_CATEGORIES[0]);
  const [amountStr, setAmountStr] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayLocalISO());
  const [dueDate, setDueDate] = useState(getTodayLocalISO());
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [professionalId, setProfessionalId] = useState('');
  const [notes, setNotes] = useState('');
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
    if (!isOpen) return;
    const today = getTodayLocalISO();
    if (payable) {
      setDescription(payable.description || '');
      setCategory(payable.category || VARIABLE_EXPENSE_CATEGORIES[0]);
      setAmountStr(Number(payable.expected_amount || 0).toFixed(2).replace('.', ','));
      setPurchaseDate(payable.purchase_date ? toDateOnlyISO(payable.purchase_date) : toDateOnlyISO(payable.due_date));
      setDueDate(toDateOnlyISO(payable.due_date));
      setPaymentMethod(payable.payment_method || 'PIX');
      setProfessionalId(payable.professional_id || '');
      setNotes(payable.notes || '');
      if (payable.status === 'paid') {
        setStatusChoice('paid');
      } else if (payable.status === 'scheduled') {
        setStatusChoice('scheduled');
      } else {
        setStatusChoice('pending');
      }
    } else {
      setStatusChoice('paid');
      setDescription('');
      setCategory(VARIABLE_EXPENSE_CATEGORIES[0]);
      setAmountStr('');
      setPurchaseDate(today);
      setDueDate(today);
      setPaymentMethod('PIX');
      setProfessionalId('');
      setNotes('');
    }
    setError(null);
  }, [payable, isOpen]);

  const allCategories = VARIABLE_EXPENSE_CATEGORIES.includes(category)
    ? VARIABLE_EXPENSE_CATEGORIES
    : [category, ...VARIABLE_EXPENSE_CATEGORIES];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseCurrencyInput(amountStr);
    if (!description.trim()) {
      setError('Informe o que foi comprado ou contratado.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }

    const effectiveDueDate = statusChoice === 'paid' ? purchaseDate : dueDate;
    if (!effectiveDueDate) {
      setError('Informe a data de vencimento.');
      return;
    }

    try {
      setError(null);
      await onSave({
        id: payable?.id,
        description: description.trim(),
        category,
        amount: parsedAmount,
        purchase_date: purchaseDate || effectiveDueDate,
        due_date: effectiveDueDate,
        payment_method: paymentMethod,
        initial_status: statusChoice,
        paid_at: statusChoice === 'paid' ? purchaseDate : undefined,
        professional_id: professionalId || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar despesa variável.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Gasto Variável' : 'Novo Gasto Variável'}
      subtitle="Registre compras de produtos, insumos, reparos ou despesas pontuais"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seletor intuitivo de Situação do Pagamento */}
        {!(isEditing && payable?.status === 'paid') && (
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Situação do Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'paid' as const, label: 'Já Pago', Icon: CheckCircle2 },
                { id: 'pending' as const, label: 'Pendente', Icon: Clock },
                { id: 'scheduled' as const, label: 'Agendado', Icon: CalendarClock },
              ].map((opt) => {
                const active = statusChoice === opt.id;
                const Icon = opt.Icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusChoice(opt.id)}
                    className="py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={{
                      borderColor: active ? theme.accent : theme.border,
                      background: active ? theme.accentGradient : theme.inputBg,
                      color: active ? theme.btnPrimaryText : theme.textSecondary,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: theme.textMuted }}>
              {statusChoice === 'paid'
                ? 'Entra imediatamente nas saídas realizadas do Fluxo de Caixa.'
                : 'Fica em Contas a Pagar e só sai do caixa quando você confirmar o pagamento.'}
            </p>
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

        {/* Descrição */}
        <div>
          <label
            className="block text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: theme.textSecondary }}
          >
            Descrição da Compra / Despesa *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compra de esmaltes, cremes hidratantes, manutenção..."
            className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{
              borderColor: theme.border,
              background: theme.inputBg,
              color: theme.textPrimary,
            }}
            required
          />
        </div>

        {/* Valor e Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Valor (R$) *
            </label>
            <div
              className="flex items-center rounded-xl border overflow-hidden"
              style={{ borderColor: theme.border, background: theme.inputBg }}
            >
              <span
                className="px-3 py-2.5 text-sm font-bold border-r select-none"
                style={{
                  borderColor: theme.border,
                  color: theme.accent,
                  background: theme.accentMuted,
                }}
              >
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="45,00"
                className="w-full px-3 py-2.5 bg-transparent text-sm font-bold focus:outline-none"
                style={{ color: theme.textPrimary }}
                required
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Categoria *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
            >
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Datas progressivas conforme o status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              {statusChoice === 'paid' ? 'Data da Compra / Pagamento *' : 'Data da Compra *'}
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
              required
            />
          </div>

          {statusChoice !== 'paid' ? (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: theme.textSecondary }}
              >
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                  color: theme.textPrimary,
                }}
                required
              />
            </div>
          ) : (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: theme.textSecondary }}
              >
                Forma de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                  color: theme.textPrimary,
                }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Forma prevista + Profissional opcional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {statusChoice !== 'paid' && (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: theme.textSecondary }}
              >
                Forma Prevista
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                  color: theme.textPrimary,
                }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {professionals.length > 0 && (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: theme.textSecondary }}
              >
                Profissional (Opcional)
              </label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                  color: theme.textPrimary,
                }}
              >
                <option value="">Geral (Estabelecimento)</option>
                {professionals.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={statusChoice === 'paid' && professionals.length > 0 ? '' : 'sm:col-span-2'}>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Loja Cosméticos Centro, nota fiscal..."
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: theme.border }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer"
            style={{ borderColor: theme.border, color: theme.textSecondary }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:opacity-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: theme.accentGradient,
              color: theme.btnPrimaryText,
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              'Salvar Alterações'
            ) : statusChoice === 'paid' ? (
              'Registrar Despesa Paga'
            ) : (
              'Registrar Conta a Pagar'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

