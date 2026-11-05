import { CheckCircle2, Calendar, CreditCard } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  computePayableDisplayStatus,
  formatCompetenceLabel,
  formatCurrencyBRL,
  formatDateBR,
  getFrequencyLabel,
  getRemainingAmount,
} from '../../../services/financialService';
import type { ExpensePayable, RecurringExpenseRule } from '../../../types/financial';
import { PayableStatusBadge } from './StatusBadge';

interface RecurringHistoryModalProps {
  isOpen: boolean;
  rule: RecurringExpenseRule | null;
  occurrences: ExpensePayable[];
  onClose: () => void;
  onPayClick: (payable: ExpensePayable) => void;
}

export function RecurringHistoryModal({
  isOpen,
  rule,
  occurrences,
  onClose,
  onPayClick,
}: RecurringHistoryModalProps) {
  const { theme } = useTheme();

  if (!rule) return null;

  const sorted = [...occurrences].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paidCount = sorted.filter((o) => o.status === 'paid').length;
  const totalPaid = sorted.reduce((acc, o) => acc + Number(o.paid_amount || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule.description}
      subtitle={`${rule.category} • ${getFrequencyLabel(rule.frequency)} • Previsto ${formatCurrencyBRL(rule.amount)}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Resumo rápido do histórico */}
        <div
          className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border"
          style={{ background: theme.inputBg, borderColor: theme.border }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              Competências Quitadas
            </p>
            <p className="text-base font-extrabold mt-0.5" style={{ color: theme.textPrimary }}>
              {paidCount} de {sorted.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
              Total Pago no Histórico
            </p>
            <p className="text-base font-extrabold mt-0.5" style={{ color: theme.success }}>
              {formatCurrencyBRL(totalPaid)}
            </p>
          </div>
        </div>

        {/* Lista de competências mobile-first */}
        {sorted.length === 0 ? (
          <div
            className="p-8 text-center rounded-2xl border border-dashed"
            style={{ borderColor: theme.border, color: theme.textSecondary }}
          >
            <p className="text-sm font-medium">Nenhuma competência gerada até o momento.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((item) => {
              const display = computePayableDisplayStatus(item);
              const remaining = getRemainingAmount(item);
              const isPaid = item.status === 'paid';

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border transition-all"
                  style={{
                    background: theme.cardBg,
                    borderColor:
                      display.code === 'overdue'
                        ? `${theme.error}45`
                        : display.code === 'due_today'
                          ? `${theme.warning}50`
                          : theme.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                        {formatCompetenceLabel(item.competence_date || item.due_date, rule.frequency)}
                      </p>
                      <div
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1"
                        style={{ color: theme.textSecondary }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Venc. {formatDateBR(item.due_date)}
                        </span>
                        <span>Previsto: {formatCurrencyBRL(item.expected_amount)}</span>
                      </div>
                    </div>

                    <PayableStatusBadge status={display.code} label={display.label} compact />
                  </div>

                  {/* Detalhes quando pago ou parcial */}
                  {item.paid_amount > 0 && (
                    <div
                      className="mt-2.5 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                      style={{ borderColor: theme.border, color: theme.textSecondary }}
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: theme.success }}>
                        <CreditCard className="w-3.5 h-3.5" />
                        Pago {formatCurrencyBRL(item.paid_amount)}
                        {item.paid_at ? ` em ${formatDateBR(item.paid_at)}` : ''}
                        {item.payment_method ? ` • ${item.payment_method}` : ''}
                      </span>
                      {!isPaid && (
                        <span className="font-bold" style={{ color: theme.warning }}>
                          Resta {formatCurrencyBRL(remaining)}
                        </span>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-xs mt-1.5 italic" style={{ color: theme.textMuted }}>
                      Obs: {item.notes}
                    </p>
                  )}

                  {!isPaid && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onPayClick(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:opacity-95 cursor-pointer"
                        style={{
                          background: theme.accentGradient,
                          color: theme.btnPrimaryText,
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar como Pago ({formatCurrencyBRL(remaining)})</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

