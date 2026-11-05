import { ArrowRight, CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  computePayableDisplayStatus,
  formatCurrencyBRL,
  formatDateBR,
  getRemainingAmount,
} from '../../../services/financialService';
import type { ExpensePayable } from '../../../types/financial';
import { PayableStatusBadge } from './StatusBadge';

interface UpcomingExpensesCardProps {
  payables: ExpensePayable[];
  isLight: boolean;
  onPayClick: (payable: ExpensePayable) => void;
  onManageAllClick: () => void;
  canWrite?: boolean;
}

export function UpcomingExpensesCard({
  payables,
  isLight,
  onPayClick,
  onManageAllClick,
  canWrite = true,
}: UpcomingExpensesCardProps) {
  const { theme } = useTheme();

  // Somente obrigações ainda não quitadas, ordenadas cronologicamente
  const openPayables = payables
    .filter((p) => p.status !== 'paid' && p.status !== 'canceled')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const visibleItems = openPayables.slice(0, 5);
  const hiddenCount = Math.max(0, openPayables.length - visibleItems.length);

  return (
    <section
      className="border rounded-2xl p-4 sm:p-6 transition-all"
      style={{
        borderColor: isLight ? '#E2E8F0' : theme.border,
        background: isLight ? '#FFFFFF' : theme.cardBg,
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: theme.accentMuted, color: theme.accent }}
          >
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-base sm:text-lg font-bold truncate"
              style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
            >
              Próximas Despesas
            </h3>
            <p className="text-xs truncate" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
              Obrigações pendentes organizadas por vencimento
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onManageAllClick}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold shrink-0 transition-all hover:opacity-90 cursor-pointer"
          style={{
            borderColor: isLight ? '#CBD5E1' : theme.border,
            background: isLight ? '#F8FAFC' : theme.inputBg,
            color: theme.accent,
          }}
        >
          <span>{hiddenCount > 0 ? `Ver todas (${openPayables.length})` : 'Gerenciar despesas'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {visibleItems.length === 0 ? (
        <div
          className="py-7 px-4 rounded-2xl border border-dashed text-center flex flex-col items-center justify-center"
          style={{
            borderColor: isLight ? '#E2E8F0' : theme.border,
            background: isLight ? '#F8FAFC' : 'transparent',
          }}
        >
          <Sparkles className="w-6 h-6 mb-2" style={{ color: theme.success }} />
          <p className="text-sm font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
            Tudo em dia por aqui!
          </p>
          <p className="text-xs mt-0.5 max-w-sm" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
            Você não possui contas atrasadas nem despesas pendentes cadastradas no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((item) => {
            const display = computePayableDisplayStatus(item);
            const remaining = getRemainingAmount(item);
            const isOverdue = display.code === 'overdue';
            const isTodayOrSoon = display.code === 'due_today' || display.code === 'due_soon';

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                style={{
                  borderColor: isOverdue
                    ? `${theme.error}45`
                    : isTodayOrSoon
                      ? `${theme.warning}45`
                      : isLight
                        ? '#E2E8F0'
                        : theme.border,
                  background: isOverdue
                    ? `${theme.error}08`
                    : isTodayOrSoon
                      ? `${theme.warning}08`
                      : isLight
                        ? '#F8FAFC'
                        : theme.inputBg,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm font-bold truncate"
                      style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                    >
                      {item.description}
                    </p>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border"
                      style={{
                        borderColor: isLight ? '#CBD5E1' : theme.border,
                        color: isLight ? '#475569' : theme.textSecondary,
                        background: isLight ? '#FFFFFF' : theme.cardBg,
                      }}
                    >
                      {item.expense_type === 'fixed' ? 'Fixa' : 'Variável'}
                    </span>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs mt-1"
                    style={{ color: isLight ? '#64748B' : theme.textSecondary }}
                  >
                    <span>{item.category}</span>
                    <span>•</span>
                    <span className="font-semibold" style={{ color: isOverdue ? theme.error : undefined }}>
                      Venc. {formatDateBR(item.due_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}>
                  <div className="flex items-center gap-2.5">
                    <PayableStatusBadge status={display.code} label={display.label} compact />
                    <span
                      className="text-sm sm:text-base font-extrabold whitespace-nowrap"
                      style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                    >
                      {formatCurrencyBRL(remaining)}
                    </span>
                  </div>

                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => onPayClick(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:opacity-95 active:scale-95 shrink-0 cursor-pointer"
                      style={{
                        background: theme.accentGradient,
                        color: theme.btnPrimaryText,
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Pagar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

