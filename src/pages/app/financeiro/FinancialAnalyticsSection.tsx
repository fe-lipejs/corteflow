import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrencyBRL } from '../../../services/financialService';
import type { CategoryBreakdownItem, MonthlyComparisonPoint } from '../../../types/financial';

interface FinancialAnalyticsSectionProps {
  isLight: boolean;
  totalIncome: number;
  totalPaidExpenses: number;
  fixedPaidAmount: number;
  variablePaidAmount: number;
  otherPaidOutflows: number;
  pendingPayablesAmount: number;
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyEvolution: MonthlyComparisonPoint[];
}

export function FinancialAnalyticsSection({
  isLight,
  totalIncome,
  totalPaidExpenses,
  fixedPaidAmount,
  variablePaidAmount,
  otherPaidOutflows,
  pendingPayablesAmount,
  categoryBreakdown,
  monthlyEvolution,
}: FinancialAnalyticsSectionProps) {
  const { theme } = useTheme();

  const commitmentPct =
    totalIncome > 0
      ? Math.round((totalPaidExpenses / totalIncome) * 100)
      : totalPaidExpenses > 0
        ? 100
        : 0;

  const clampedBarPct = Math.min(100, Math.max(0, commitmentPct));
  const cashBalance = totalIncome - totalPaidExpenses;

  const maxEvolutionValue = Math.max(
    1,
    ...monthlyEvolution.map((m) => Math.max(m.income, m.expenses))
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* 1. Comprometimento do Faturamento + Gastos por Categoria */}
      <div
        className="lg:col-span-7 border rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-5"
        style={{
          borderColor: isLight ? '#E2E8F0' : theme.border,
          background: isLight ? '#FFFFFF' : theme.cardBg,
          boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        }}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: theme.accentMuted, color: theme.accent }}
              >
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className="text-sm sm:text-base font-bold"
                  style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                >
                  Para onde está indo o dinheiro
                </h3>
                <p className="text-xs" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Relação entre receitas recebidas e despesas pagas no período
                </p>
              </div>
            </div>

            <span
              className="px-2.5 py-1 rounded-full text-xs font-extrabold border shrink-0"
              style={{
                background:
                  commitmentPct > 80
                    ? `${theme.error}15`
                    : commitmentPct > 50
                      ? `${theme.warning}15`
                      : `${theme.success}15`,
                color:
                  commitmentPct > 80
                    ? theme.error
                    : commitmentPct > 50
                      ? theme.warning
                      : theme.success,
                borderColor:
                  commitmentPct > 80
                    ? `${theme.error}35`
                    : commitmentPct > 50
                      ? `${theme.warning}35`
                      : `${theme.success}35`,
              }}
            >
              {totalIncome > 0 ? `${commitmentPct}% gasto` : totalPaidExpenses > 0 ? 'Sem entradas' : '0% gasto'}
            </span>
          </div>

          {/* Barra de comprometimento do faturamento */}
          <div
            className="p-3.5 rounded-2xl border space-y-2.5"
            style={{
              background: isLight ? '#F8FAFC' : theme.inputBg,
              borderColor: isLight ? '#E2E8F0' : theme.border,
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                Faturamento recebido:{' '}
                <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {formatCurrencyBRL(totalIncome)}
                </strong>
              </span>
              <span style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                Saldo caixa:{' '}
                <strong style={{ color: cashBalance >= 0 ? theme.success : theme.error }}>
                  {formatCurrencyBRL(cashBalance)}
                </strong>
              </span>
            </div>

            <div
              className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ background: isLight ? '#E2E8F0' : theme.border }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${clampedBarPct}%`,
                  background: commitmentPct > 85 ? theme.error : theme.accentGradient,
                }}
              />
            </div>

            {/* Subdivisão Fixas x Variáveis x Pendentes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-xl border" style={{ borderColor: isLight ? '#E2E8F0' : theme.border, background: isLight ? '#FFFFFF' : theme.cardBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Fixas Pagas
                </p>
                <p className="text-xs sm:text-sm font-extrabold mt-0.5" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {formatCurrencyBRL(fixedPaidAmount)}
                </p>
              </div>

              <div className="p-2 rounded-xl border" style={{ borderColor: isLight ? '#E2E8F0' : theme.border, background: isLight ? '#FFFFFF' : theme.cardBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Variáveis Pagas
                </p>
                <p className="text-xs sm:text-sm font-extrabold mt-0.5" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {formatCurrencyBRL(variablePaidAmount)}
                </p>
              </div>

              <div className="p-2 rounded-xl border" style={{ borderColor: isLight ? '#E2E8F0' : theme.border, background: isLight ? '#FFFFFF' : theme.cardBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Repasses / Outros
                </p>
                <p className="text-xs sm:text-sm font-extrabold mt-0.5" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {formatCurrencyBRL(otherPaidOutflows)}
                </p>
              </div>

              <div className="p-2 rounded-xl border" style={{ borderColor: `${theme.warning}40`, background: `${theme.warning}08` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.warning }}>
                  Em Aberto
                </p>
                <p className="text-xs sm:text-sm font-extrabold mt-0.5" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {formatCurrencyBRL(pendingPayablesAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Ranking de gastos por categoria */}
        <div>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2.5"
            style={{ color: isLight ? '#475569' : theme.textSecondary }}
          >
            Gastos Pagos por Categoria
          </p>

          {categoryBreakdown.length === 0 ? (
            <p className="text-xs py-3" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
              Nenhuma despesa quitada neste mês ainda para exibir distribuição por categoria.
            </p>
          ) : (
            <div className="space-y-2.5">
              {categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span
                      className="font-semibold truncate"
                      style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
                    >
                      {cat.category}
                    </span>
                    <span
                      className="font-bold whitespace-nowrap"
                      style={{ color: isLight ? '#475569' : theme.textSecondary }}
                    >
                      {formatCurrencyBRL(cat.amount)} ({cat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ background: isLight ? '#E2E8F0' : theme.border }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(4, Math.min(100, cat.percentage))}%`,
                        background: theme.accentGradient,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Comparativo Receitas x Despesas (Últimos 6 Meses) */}
      <div
        className="lg:col-span-5 border rounded-2xl p-4 sm:p-6 flex flex-col justify-between"
        style={{
          borderColor: isLight ? '#E2E8F0' : theme.border,
          background: isLight ? '#FFFFFF' : theme.cardBg,
          boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: theme.accentMuted, color: theme.accent }}
            >
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3
                className="text-sm sm:text-base font-bold"
                style={{ color: isLight ? '#0F172A' : theme.textPrimary }}
              >
                Receitas × Despesas
              </h3>
              <p className="text-xs" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                Evolução realizada dos últimos 6 meses
              </p>
            </div>
          </div>

          <TrendingUp className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
        </div>

        {/* Legenda compacta */}
        <div className="flex items-center gap-4 text-xs mb-4" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.success }} />
            Receitas
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.error }} />
            Saídas Pagas
          </span>
        </div>

        {/* Gráfico de barras duplas responsivo e leve */}
        <div className="grid grid-cols-6 gap-2 items-end h-40 pt-4 pb-1 border-b" style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}>
          {monthlyEvolution.map((pt, idx) => {
            const incHeight = pt.income > 0 ? Math.max(8, Math.round((pt.income / maxEvolutionValue) * 100)) : 3;
            const expHeight = pt.expenses > 0 ? Math.max(8, Math.round((pt.expenses / maxEvolutionValue) * 100)) : 3;
            const isSelectedMonth = idx === monthlyEvolution.length - 1;

            return (
              <div
                key={pt.monthKey}
                className="flex flex-col items-center justify-end h-full gap-1.5 group"
                title={`${pt.label}: Receitas ${formatCurrencyBRL(pt.income)} | Saídas ${formatCurrencyBRL(pt.expenses)}`}
              >
                <div className="flex items-end justify-center gap-1 w-full h-full">
                  <div
                    className="w-2.5 sm:w-3 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${incHeight}%`,
                      background: pt.income > 0 ? theme.success : (isLight ? '#E2E8F0' : theme.border),
                      opacity: isSelectedMonth ? 1 : 0.78,
                    }}
                  />
                  <div
                    className="w-2.5 sm:w-3 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${expHeight}%`,
                      background: pt.expenses > 0 ? theme.error : (isLight ? '#E2E8F0' : theme.border),
                      opacity: isSelectedMonth ? 1 : 0.78,
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] sm:text-xs ${isSelectedMonth ? 'font-extrabold' : 'font-medium'}`}
                  style={{
                    color: isSelectedMonth
                      ? theme.accent
                      : isLight
                        ? '#64748B'
                        : theme.textSecondary,
                  }}
                >
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] mt-3" style={{ color: isLight ? '#64748B' : theme.textMuted }}>
          Toque ou passe o cursor nas barras para conferir os valores exatos de cada mês.
        </p>
      </div>
    </section>
  );
}

