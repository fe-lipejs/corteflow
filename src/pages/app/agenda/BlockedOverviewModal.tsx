import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ArrowLeft,
  X,
  Lock,
  Unlock,
  Clock,
  Calendar,
  SlidersHorizontal,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll';
import {
  type NormalizedBlock,
  useAllUpcomingTenantBlocks,
  groupBlocksByDaySummary,
  useManageBlockedTimes,
} from '../../../hooks/useBlockedTimes';
import toast from 'react-hot-toast';

interface Props {
  tenantId: string;
  targetProIds: string[];
  businessHours: any[];
  knownBlocks?: NormalizedBlock[];
  onOpenDaySlots?: (date: Date) => void;
  onSelectDayInAgenda?: (date: Date) => void;
  onBack?: () => void;
  onClose: () => void;
}

type FilterType = 'all' | 'days' | 'hours';

export default function BlockedOverviewModal({
  tenantId,
  targetProIds,
  businessHours,
  knownBlocks = [],
  onOpenDaySlots,
  onSelectDayInAgenda,
  onBack,
  onClose,
}: Props) {
  const { theme } = useTheme();
  useLockBodyScroll(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [unblockingKey, setUnblockingKey] = useState<string | null>(null);

  const { data: upcomingBlocks = [], isLoading } = useAllUpcomingTenantBlocks(tenantId);
  const { batchDaysBlock } = useManageBlockedTimes(tenantId);

  const mergedBlocks = useMemo(() => {
    const map = new Map<string, NormalizedBlock>();
    for (const b of knownBlocks) map.set(`${b.source}-${b.id}`, b);
    for (const b of upcomingBlocks) map.set(`${b.source}-${b.id}`, b);
    return Array.from(map.values());
  }, [knownBlocks, upcomingBlocks]);

  const allSummaries = useMemo(
    () => groupBlocksByDaySummary(mergedBlocks, targetProIds, businessHours),
    [mergedBlocks, targetProIds, businessHours]
  );

  const fullDaysList = useMemo(
    () => allSummaries.filter((s) => s.isFullDay),
    [allSummaries]
  );

  const partialHoursList = useMemo(
    () => allSummaries.filter((s) => !s.isFullDay),
    [allSummaries]
  );

  const filteredList = useMemo(() => {
    if (filter === 'days') return fullDaysList;
    if (filter === 'hours') return partialHoursList;
    return allSummaries;
  }, [filter, allSummaries, fullDaysList, partialHoursList]);

  const handleUnblockDay = async (date: Date, dateKey: string) => {
    setUnblockingKey(dateKey);
    try {
      await batchDaysBlock.mutateAsync({
        dates: [date],
        targetProIds,
        block: false,
      });
      toast.success(`Dia ${format(date, 'dd/MM')} liberado!`);
    } catch {
      toast.error('Não foi possível liberar este dia.');
    } finally {
      setUnblockingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.textPrimary,
        }}
      >
        {/* ── Header Clean com Botão de Retorno + Tag BETA ── */}
        <div
          className="px-5 pt-5 pb-4 border-b flex flex-col gap-3.5 shrink-0"
          style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onBack || onClose}
                className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.bg,
                  color: theme.textPrimary,
                }}
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                    Bloqueios Ativos
                  </h2>
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
                      color: theme.accent,
                    }}
                  >
                    Beta
                  </span>
                </div>
                <p className="text-xs font-medium truncate" style={{ color: theme.textSecondary }}>
                  Dias inteiros e horários específicos bloqueados
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer shrink-0"
              style={{ color: theme.textSecondary }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas de Filtro */}
          <div
            className="grid grid-cols-3 p-1 rounded-2xl border"
            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
          >
            {[
              { id: 'all' as FilterType, label: `Todos (${allSummaries.length})` },
              { id: 'days' as FilterType, label: `Dias (${fullDaysList.length})` },
              { id: 'hours' as FilterType, label: `Horários (${partialHoursList.length})` },
            ].map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className="py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer truncate"
                  style={{
                    backgroundColor: active ? `${theme.accent}18` : 'transparent',
                    color: active ? theme.accent : theme.textSecondary,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Lista de Dias e Horários Bloqueados ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
              <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                Carregando bloqueios...
              </span>
            </div>
          ) : filteredList.length === 0 ? (
            <div
              className="rounded-3xl border p-8 text-center flex flex-col items-center justify-center"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{
                  backgroundColor: `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                  color: theme.accent,
                }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold" style={{ color: theme.textPrimary }}>
                Nenhum bloqueio encontrado
              </p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: theme.textSecondary }}>
                {filter === 'days'
                  ? 'Não há nenhum dia inteiro bloqueado a partir de hoje.'
                  : filter === 'hours'
                    ? 'Não há horários específicos bloqueados a partir de hoje.'
                    : 'Sua agenda está 100% livre em todos os dias de funcionamento.'}
              </p>
            </div>
          ) : (
            filteredList.map((item) => {
              const isUnblocking = unblockingKey === item.dateKey;
              return (
                <div
                  key={item.dateKey}
                  className="rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    onClick={() => {
                      if (onSelectDayInAgenda) {
                        onSelectDayInAgenda(item.date);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer"
                  >
                    {/* Card Vertical da Data (Padrão img2) */}
                    <div
                      className="w-14 py-2 rounded-2xl border text-center shrink-0 flex flex-col items-center justify-center"
                      style={{
                        borderColor: item.isFullDay ? theme.accent : theme.border,
                        backgroundColor: item.isFullDay
                          ? `color-mix(in srgb, ${theme.accent} 14%, ${theme.bg})`
                          : theme.bg,
                      }}
                    >
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: item.isFullDay ? theme.accent : theme.textSecondary }}
                      >
                        {format(item.date, 'EEE', { locale: ptBR }).slice(0, 3)}
                      </span>
                      <span
                        className="text-lg font-black leading-none my-0.5 tabular-nums"
                        style={{ color: item.isFullDay ? theme.accent : theme.textPrimary }}
                      >
                        {format(item.date, 'dd')}
                      </span>
                      <span
                        className="text-[9px] font-semibold uppercase"
                        style={{ color: item.isFullDay ? theme.accent : theme.textSecondary }}
                      >
                        {format(item.date, 'MMM', { locale: ptBR })}
                      </span>
                    </div>

                    {/* Detalhes do Bloqueio */}
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold capitalize truncate" style={{ color: theme.textPrimary }}>
                        {format(item.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>

                      {item.isFullDay ? (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${theme.accent} 15%, transparent)`,
                            color: theme.accent,
                          }}
                        >
                          <Calendar className="w-3 h-3" />
                          Dia inteiro bloqueado
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {item.intervals.map((rng, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border"
                              style={{
                                borderColor: `color-mix(in srgb, ${theme.accent} 40%, transparent)`,
                                backgroundColor: `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
                                color: theme.accent,
                              }}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {format(rng.start, 'HH:mm')} – {format(rng.end, 'HH:mm')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas: Editar Horários / Liberar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenDaySlots && (
                      <button
                        type="button"
                        onClick={() => onOpenDaySlots(item.date)}
                        className="p-2 rounded-xl border transition-all active:scale-95 cursor-pointer"
                        style={{
                          borderColor: theme.border,
                          backgroundColor: theme.bg,
                          color: theme.textPrimary,
                        }}
                        title="Editar horários deste dia"
                      >
                        <SlidersHorizontal className="w-4 h-4" style={{ color: theme.accent }} />
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isUnblocking}
                      onClick={() => handleUnblockDay(item.date, item.dateKey)}
                      className="px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: theme.bg,
                        color: theme.textPrimary,
                      }}
                      title="Liberar dia"
                    >
                      {isUnblocking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      )}
                      <span>Liberar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Rodapé com Botão de Retorno ── */}
        <div
          className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
        >
          <button
            type="button"
            onClick={onBack || onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.bg,
              color: theme.textPrimary,
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            style={{
              background: theme.accentGradient || theme.accent,
              color: theme.btnPrimaryText,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

