import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Repeat } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  getTodayLocalISO,
  parseCurrencyInput,
  toDateOnlyISO,
} from '../../../services/financialService';
import {
  FIXED_EXPENSE_CATEGORIES,
  FREQUENCY_OPTIONS,
  PAYMENT_METHODS,
  type RecurringExpenseRule,
  type RecurringFrequency,
  type RecurringRuleInput,
} from '../../../types/financial';

interface RecurringRuleModalProps {
  isOpen: boolean;
  rule: RecurringExpenseRule | null;
  onClose: () => void;
  onSave: (input: RecurringRuleInput) => Promise<void>;
  isLoading?: boolean;
}

export function RecurringRuleModal({
  isOpen,
  rule,
  onClose,
  onSave,
  isLoading = false,
}: RecurringRuleModalProps) {
  const { theme } = useTheme();
  const isEditing = !!rule?.id;

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(FIXED_EXPENSE_CATEGORIES[0]);
  const [amountStr, setAmountStr] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(getTodayLocalISO());
  const [dueDay, setDueDay] = useState<string>('5');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setDescription(rule.description || '');
      setCategory(rule.category || FIXED_EXPENSE_CATEGORIES[0]);
      setAmountStr(Number(rule.amount || 0).toFixed(2).replace('.', ','));
      setFrequency(rule.frequency || 'monthly');
      const startISO = toDateOnlyISO(rule.start_date);
      setStartDate(startISO);
      const fallbackDay = Number(startISO.split('-')[2] || 5);
      setDueDay(String(rule.due_day || fallbackDay));
      setPaymentMethod(rule.payment_method || 'PIX');
      setEndDate(rule.end_date ? toDateOnlyISO(rule.end_date) : '');
      setNotes(rule.notes || '');
      setShowExtra(Boolean(rule.end_date || rule.notes));
    } else {
      const today = getTodayLocalISO();
      const todayDay = Number(today.split('-')[2] || 1);
      setDescription('');
      setCategory(FIXED_EXPENSE_CATEGORIES[0]);
      setAmountStr('');
      setFrequency('monthly');
      setStartDate(today);
      setDueDay(String(todayDay));
      setPaymentMethod('PIX');
      setEndDate('');
      setNotes('');
      setShowExtra(false);
    }
    setError(null);
  }, [rule, isOpen]);

  const isDayBasedFrequency = frequency !== 'weekly' && frequency !== 'biweekly';

  const allCategories = FIXED_EXPENSE_CATEGORIES.includes(category)
    ? FIXED_EXPENSE_CATEGORIES
    : [category, ...FIXED_EXPENSE_CATEGORIES];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseCurrencyInput(amountStr);
    if (!description.trim()) {
      setError('Informe a descrição do gasto fixo (ex: Aluguel, Internet).');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor previsto maior que zero.');
      return;
    }
    if (!startDate) {
      setError('Informe a data inicial.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('A data final não pode ser anterior à data inicial.');
      return;
    }

    const parsedDay = parseInt(dueDay, 10);
    if (isDayBasedFrequency && (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31)) {
      setError('O dia de vencimento deve estar entre 1 e 31.');
      return;
    }

    try {
      setError(null);
      await onSave({
        id: rule?.id,
        description: description.trim(),
        category,
        amount: parsedAmount,
        frequency,
        due_day: isDayBasedFrequency ? parsedDay : Number(startDate.split('-')[2] || 1),
        start_date: startDate,
        end_date: endDate || null,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar gasto fixo.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
      subtitle={
        isEditing
          ? 'Pagamentos anteriores são preservados; alterações valem para os próximos vencimentos'
          : 'Configure uma vez e o sistema gera os vencimentos automaticamente'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {/* Descrição e Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Descrição *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel do Espaço, Internet Fibra..."
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
              required
            />
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

        {/* Valor Previsto e Frequência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Valor Previsto (R$) *
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
                placeholder="600,00"
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
              Frequência *
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dia de Vencimento e Data Inicial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isDayBasedFrequency ? (
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: theme.textSecondary }}
              >
                Dia do Vencimento (1 a 31) *
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold focus:outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.inputBg,
                  color: theme.textPrimary,
                }}
                required
              />
              <p className="text-[11px] mt-1" style={{ color: theme.textMuted }}>
                Ajustado automaticamente em meses mais curtos (ex: fev).
              </p>
            </div>
          ) : (
            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ background: theme.inputBg, borderColor: theme.border }}
            >
              <Repeat className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
              <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                Os vencimentos serão gerados a cada{' '}
                <strong style={{ color: theme.textPrimary }}>
                  {frequency === 'weekly' ? '7 dias' : '14 dias'}
                </strong>{' '}
                a partir da data inicial.
              </p>
            </div>
          )}

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Data Inicial *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const next = e.target.value;
                setStartDate(next);
                if (!isEditing && next) {
                  const dayPart = Number(next.split('-')[2]);
                  if (dayPart >= 1 && dayPart <= 31) {
                    setDueDay(String(dayPart));
                  }
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
              required
            />
          </div>
        </div>

        {/* Toggle progressivo para manter simplicidade no smartphone */}
        <div>
          <button
            type="button"
            onClick={() => setShowExtra((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold py-1 cursor-pointer"
            style={{ color: theme.accent }}
          >
            {showExtra ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Opções adicionais (forma padrão, data final, observação)</span>
          </button>

          {showExtra && (
            <div
              className="mt-2.5 p-3.5 rounded-2xl border space-y-3"
              style={{ background: theme.inputBg, borderColor: theme.border }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: theme.textSecondary }}
                  >
                    Forma de Pagamento Padrão
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.cardBg,
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

                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: theme.textSecondary }}
                  >
                    Data Final (Opcional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.cardBg,
                      color: theme.textPrimary,
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: theme.textSecondary }}
                >
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chave PIX da imobiliária, código do cliente..."
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                  style={{
                    borderColor: theme.border,
                    background: theme.cardBg,
                    color: theme.textPrimary,
                  }}
                />
              </div>
            </div>
          )}
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
            ) : (
              'Cadastrar Gasto Fixo'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

