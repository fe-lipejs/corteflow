import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  formatCurrencyBRL,
  formatDateBR,
  getRemainingAmount,
  getTodayLocalISO,
  parseCurrencyInput,
} from '../../../services/financialService';
import { PAYMENT_METHODS, type ExpensePayable, type PayObligationInput } from '../../../types/financial';

interface PayObligationModalProps {
  isOpen: boolean;
  payable: ExpensePayable | null;
  onClose: () => void;
  onConfirm: (input: PayObligationInput) => Promise<void>;
  isLoading?: boolean;
}

const QUICK_METHODS = ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência Bancária'];

export function PayObligationModal({
  isOpen,
  payable,
  onClose,
  onConfirm,
  isLoading = false,
}: PayObligationModalProps) {
  const { theme } = useTheme();
  const [amountStr, setAmountStr] = useState('');
  const [paidAt, setPaidAt] = useState(getTodayLocalISO());
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [notes, setNotes] = useState('');
  const [settleFull, setSettleFull] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const remaining = payable ? getRemainingAmount(payable) : 0;

  useEffect(() => {
    if (payable && isOpen) {
      const rem = getRemainingAmount(payable);
      setAmountStr(rem.toFixed(2).replace('.', ','));
      setPaidAt(getTodayLocalISO());
      setPaymentMethod(payable.payment_method || 'PIX');
      setNotes('');
      setSettleFull(true);
      setError(null);
    }
  }, [payable, isOpen]);

  if (!payable) return null;

  const parsedVal = parseCurrencyInput(amountStr);
  const isLowerThanRemaining =
    Number.isFinite(parsedVal) && parsedVal > 0 && parsedVal < remaining - 0.009;
  const leftoverBalance = isLowerThanRemaining ? Math.max(0, remaining - parsedVal) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(parsedVal) || parsedVal <= 0) {
      setError('Informe um valor pago maior que zero.');
      return;
    }
    if (!paidAt) {
      setError('Informe a data do pagamento.');
      return;
    }

    try {
      setError(null);
      await onConfirm({
        payableId: payable.id,
        amount: parsedVal,
        paidAt,
        paymentMethod,
        notes: notes.trim() || undefined,
        settleFull: isLowerThanRemaining ? settleFull : true,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar o pagamento.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Pagamento"
      subtitle="A saída será registrada automaticamente no Fluxo de Caixa"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resumo compacto da obrigação */}
        <div
          className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
          style={{ background: theme.inputBg, borderColor: theme.border }}
        >
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: theme.textPrimary }}>
              {payable.description}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: theme.textSecondary }}>
              {payable.category} • Venc. {formatDateBR(payable.due_date)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              {payable.paid_amount > 0 ? 'Restante' : 'Previsto'}
            </p>
            <p className="text-base font-extrabold" style={{ color: theme.textPrimary }}>
              {formatCurrencyBRL(remaining)}
            </p>
          </div>
        </div>

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

        {/* Valor efetivamente pago + Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Valor Pago (R$) *
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
                onChange={(e) => {
                  const next = e.target.value.replace(/[^0-9.,]/g, '');
                  setAmountStr(next);
                  const numeric = parseCurrencyInput(next);
                  if (Number.isFinite(numeric) && numeric < remaining - 0.009) {
                    setSettleFull(false);
                  } else {
                    setSettleFull(true);
                  }
                }}
                className="w-full px-3 py-2.5 bg-transparent text-sm font-bold focus:outline-none"
                style={{ color: theme.textPrimary }}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: theme.textSecondary }}
            >
              Data do Pagamento *
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none"
              style={{
                borderColor: theme.border,
                background: theme.inputBg,
                color: theme.textPrimary,
              }}
              required
            />
          </div>
        </div>

        {/* Opção progressiva quando o valor é menor que o previsto (Parcial vs Ajuste de Fatura) */}
        {isLowerThanRemaining && (
          <div
            className="p-3 rounded-2xl border space-y-2"
            style={{ background: theme.inputBg, borderColor: theme.border }}
          >
            <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
              O valor informado é menor que o saldo previsto. Como deseja registrar?
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setSettleFull(false)}
                className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor: !settleFull ? theme.accent : theme.border,
                  background: !settleFull ? theme.accentMuted : 'transparent',
                }}
              >
                <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                  Pagamento parcial (manter {formatCurrencyBRL(leftoverBalance)} pendente)
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textSecondary }}>
                  O restante continuará em Contas a Pagar até a quitação final.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSettleFull(true)}
                className="p-2.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor: settleFull ? theme.accent : theme.border,
                  background: settleFull ? theme.accentMuted : 'transparent',
                }}
              >
                <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                  Quitar conta integralmente com este valor
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textSecondary }}>
                  Ideal quando a fatura veio mais barata ou houve desconto.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Forma de Pagamento rápida para 1 toque no celular */}
        <div>
          <label
            className="block text-xs font-bold uppercase tracking-wider mb-1.5"
            style={{ color: theme.textSecondary }}
          >
            Forma de Pagamento
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_METHODS.map((method) => {
              const active = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className="py-2 px-2.5 rounded-xl border text-xs font-bold transition-all truncate cursor-pointer"
                  style={{
                    borderColor: active ? theme.accent : theme.border,
                    background: active ? theme.accentGradient : theme.inputBg,
                    color: active ? theme.btnPrimaryText : theme.textSecondary,
                  }}
                >
                  {method === 'Transferência Bancária' ? 'Transferência' : method}
                </button>
              );
            })}
          </div>
          {!QUICK_METHODS.includes(paymentMethod) && (
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-2 w-full px-3.5 py-2 rounded-xl border text-xs font-medium"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Observação opcional */}
        <div>
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
            placeholder="Ex: Pago via app do banco, comprovante salvo..."
            className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{
              borderColor: theme.border,
              background: theme.inputBg,
              color: theme.textPrimary,
            }}
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-2">
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
            className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            style={{
              background: theme.accentGradient,
              color: theme.btnPrimaryText,
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pagamento</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

