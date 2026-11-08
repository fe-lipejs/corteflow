import { useMemo, useState } from 'react';
import { format, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  AlertCircle,
  Loader2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type { Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';
import { getBookingConfirmationInfo, type BookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { BookingMetaIcons, WhatsAppSvgIcon } from './BookingMetaIcons';

interface UpcomingConfirmationsCenterProps {
  bookings: Booking[];
  isLoading?: boolean;
  canConfirm: boolean;
  onBookingClick: (booking: Booking) => void;
  onConfirmBooking: (bookingId: string, booking?: Booking) => void | Promise<void>;
}

type FilterTab = 'all' | 'overdue' | 'pending' | 'confirmed';
type SortOrder = 'oldest_first' | 'newest_first';

interface EnrichedBookingItem {
  booking: Booking;
  info: BookingConfirmationInfo;
  scheduledDate: Date;
}

interface BookingGroup {
  key: string;
  title: string;
  subtitle?: string;
  isAlertGroup?: boolean;
  items: EnrichedBookingItem[];
}

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
});

const ITEMS_PER_PAGE = 8;

export default function UpcomingConfirmationsCenter({
  bookings,
  isLoading = false,
  onBookingClick,
}: UpcomingConfirmationsCenterProps) {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('oldest_first');
  const [currentPage, setCurrentPage] = useState(1);

  const now = new Date();
  const todayStartMs = startOfDay(now).getTime();

  // Enriquecer e manter todos os agendamentos ativos (não concluídos e não cancelados)
  const enrichedItems = useMemo<EnrichedBookingItem[]>(() => {
    const currentNow = new Date();
    return bookings
      .filter((b) => b.status !== 'canceled' && b.status !== 'no_show' && b.status !== 'completed')
      .map((booking) => ({
        booking,
        info: getBookingConfirmationInfo(booking, currentNow),
        scheduledDate: new Date(booking.scheduled_at),
      }));
  }, [bookings]);

  // Contadores para os filtros
  const counts = useMemo(() => {
    let overdueCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;

    for (const item of enrichedItems) {
      const isPastDay = item.scheduledDate.getTime() < todayStartMs;
      const isPastTime = isToday(item.scheduledDate) && item.scheduledDate.getTime() < now.getTime();

      if (isPastDay || isPastTime) {
        overdueCount += 1;
      }

      if (item.info.isPending) {
        pendingCount += 1;
      }

      if (item.info.isConfirmed) {
        confirmedCount += 1;
      }
    }

    return {
      total: enrichedItems.length,
      overdue: overdueCount,
      pending: pendingCount,
      confirmed: confirmedCount,
    };
  }, [enrichedItems, todayStartMs, now]);

  // Filtragem e Ordenação por data (Mais antigo primeiro padrão por solicitação)
  const filteredItems = useMemo(() => {
    let list = enrichedItems;

    if (activeFilter === 'overdue') {
      list = list.filter(
        (item) =>
          item.scheduledDate.getTime() < todayStartMs ||
          (isToday(item.scheduledDate) && item.scheduledDate.getTime() < now.getTime())
      );
    } else if (activeFilter === 'pending') {
      list = list.filter((item) => item.info.isPending);
    } else if (activeFilter === 'confirmed') {
      list = list.filter((item) => item.info.isConfirmed);
    }

    return [...list].sort((a, b) => {
      const diff = a.scheduledDate.getTime() - b.scheduledDate.getTime();
      return sortOrder === 'oldest_first' ? diff : -diff;
    });
  }, [enrichedItems, activeFilter, sortOrder, todayStartMs, now]);

  // Paginação limpa
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, safePage]);

  // Agrupar por data de forma limpa no padrão Apple Calendar
  const groups = useMemo<BookingGroup[]>(() => {
    const groupMap = new Map<string, BookingGroup>();

    for (const item of pagedItems) {
      const schedMs = item.scheduledDate.getTime();
      const isPastDay = schedMs < todayStartMs;

      let key: string;
      let title: string;
      let subtitle: string | undefined;
      let isAlertGroup = false;

      if (isPastDay) {
        key = `past_${format(item.scheduledDate, 'yyyy-MM-dd')}`;
        title = format(item.scheduledDate, "dd 'de' MMMM", { locale: ptBR });
        subtitle = 'Atrasado';
        isAlertGroup = true;
      } else if (isToday(item.scheduledDate)) {
        key = `today_${format(item.scheduledDate, 'yyyy-MM-dd')}`;
        title = 'Hoje';
        subtitle = format(item.scheduledDate, "dd 'de' MMMM", { locale: ptBR });
      } else if (isTomorrow(item.scheduledDate)) {
        key = `tomorrow_${format(item.scheduledDate, 'yyyy-MM-dd')}`;
        title = 'Amanhã';
        subtitle = format(item.scheduledDate, "dd 'de' MMMM", { locale: ptBR });
      } else {
        key = `day_${format(item.scheduledDate, 'yyyy-MM-dd')}`;
        title = format(item.scheduledDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          title,
          subtitle,
          isAlertGroup,
          items: [],
        });
      }

      groupMap.get(key)!.items.push(item);
    }

    return Array.from(groupMap.values());
  }, [pagedItems, todayStartMs]);

  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    setCurrentPage(1);
  };

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === 'oldest_first' ? 'newest_first' : 'oldest_first'));
    setCurrentPage(1);
  };

  const totalVisibleItems = pagedItems.length;

  return (
    <section
      aria-label="Central de agendamentos: atrasados, recentes e próximos"
      className="mt-6 rounded-3xl border p-5 sm:p-6 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
      style={{
        borderColor: theme.border,
        backgroundColor: theme.cardBg,
      }}
    >
      {/* ── Header da Central ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: theme.border }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
              Central de agendamentos
            </h2>

            {counts.overdue > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{
                  backgroundColor: 'rgba(255, 59, 48, 0.12)',
                  color: '#FF3B30',
                }}
                title={`${counts.overdue} agendamento(s) atrasados`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {counts.overdue} atrasado{counts.overdue > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 opacity-70" style={{ color: theme.textSecondary }}>
            Acompanhamento centralizado: atrasados, hoje e próximos
          </p>
        </div>

        {/* Controles de Filtros e Ordenação */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Tabs de Filtro — Grade 2x2 no mobile para nunca vazar da tela, pill horizontal no desktop */}
          <div
            className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 rounded-2xl border w-full sm:w-auto"
            style={{ borderColor: theme.border, backgroundColor: 'var(--theme-bg)' }}
          >
            {[
              { id: 'all' as FilterTab, label: `Todos (${counts.total})` },
              { id: 'overdue' as FilterTab, label: `Atrasados (${counts.overdue})`, isAlert: counts.overdue > 0 },
              { id: 'pending' as FilterTab, label: `Pendentes (${counts.pending})` },
              { id: 'confirmed' as FilterTab, label: `Confirmados (${counts.confirmed})` },
            ].map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleFilterChange(tab.id)}
                  className="px-2.5 py-1.5 sm:py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap text-center flex items-center justify-center"
                  style={{
                    backgroundColor: active ? `${theme.accent}18` : 'transparent',
                    color: active ? theme.accent : tab.isAlert ? '#EF4444' : theme.textSecondary,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Toggle de Ordenação por Data (Padrão: Mais antigos primeiro) */}
          <button
            type="button"
            onClick={handleSortToggle}
            className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all hover:bg-[var(--theme-bg-hover)] cursor-pointer shrink-0"
            style={{
              borderColor: theme.border,
              backgroundColor: 'var(--theme-bg)',
              color: theme.textPrimary,
            }}
            title="Alternar ordem de exibição das datas"
          >
            <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
            <span>
              {sortOrder === 'oldest_first' ? 'Mais antigos primeiro' : 'Mais distantes primeiro'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Lista de Agendamentos (Scroll interno no mobile após 3 itens) ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar className="w-8 h-8 opacity-40 mb-2" style={{ color: theme.textSecondary }} />
          <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
            {activeFilter === 'overdue'
              ? 'Nenhum agendamento atrasado'
              : activeFilter === 'pending'
                ? 'Nenhuma confirmação pendente'
                : 'Nenhum agendamento ativo encontrado'}
          </p>
          <p className="text-xs mt-0.5 opacity-65" style={{ color: theme.textSecondary }}>
            {activeFilter === 'overdue'
              ? 'Todos os agendamentos anteriores estão em dia ou finalizados.'
              : 'Novos agendamentos aparecerão aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <div
          className={`pt-4 space-y-5 ${
            totalVisibleItems > 3
              ? 'max-h-[385px] sm:max-h-[520px] overflow-y-auto overscroll-contain pr-1 scrollbar-thin'
              : ''
          }`}
        >
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              {/* Header do Grupo com estética Apple */}
              <div className="flex items-center gap-2 px-1 pb-0.5">
                {group.isAlertGroup && <AlertCircle className="w-3.5 h-3.5 text-[#FF3B30] shrink-0" />}
                <span
                  className="text-[11px] font-bold uppercase tracking-wider capitalize"
                  style={{ color: group.isAlertGroup ? '#FF3B30' : theme.textSecondary }}
                >
                  {group.title}
                </span>
                {group.subtitle && (
                  <span
                    className="text-[11px] font-medium opacity-65"
                    style={{ color: group.isAlertGroup ? '#FF3B30' : theme.textSecondary }}
                  >
                    · {group.subtitle}
                  </span>
                )}
              </div>

              {/* Cards Padrão Apple 2026 */}
              <div className="flex flex-col gap-2">
                {group.items.map(({ booking, info, scheduledDate }) => {
                  const timeStr = format(scheduledDate, 'HH:mm');
                  const schedMs = scheduledDate.getTime();
                  const isPastDay = schedMs < todayStartMs;
                  const isPastTime = isToday(scheduledDate) && schedMs < now.getTime();
                  const isPastSchedule = isPastDay || isPastTime;
                  const isPending = info.isPending;

                  return (
                    <div
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className="group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer hover:bg-[var(--theme-bg-hover)] active:scale-[0.99] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                      style={{
                        backgroundColor: isPastDay
                          ? 'rgba(239, 68, 68, 0.04)'
                          : isPastTime
                            ? 'rgba(239, 68, 68, 0.02)'
                            : 'var(--theme-bg)',
                        borderColor: isPastDay
                          ? 'rgba(239, 68, 68, 0.45)'
                          : isPastTime
                            ? 'rgba(239, 68, 68, 0.25)'
                            : isPending
                              ? `color-mix(in srgb, ${theme.accent} 25%, transparent)`
                              : theme.border,
                      }}
                    >
                      {/* Esquerda: Horário com Pontinho Redondo + Data */}
                      <div className="flex flex-col shrink-0 min-w-[62px] sm:min-w-[72px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-bold text-xs sm:text-sm tabular-nums leading-tight tracking-tight"
                            style={{ color: isPastSchedule ? '#EF4444' : theme.textPrimary }}
                          >
                            {timeStr}
                          </span>

                          {/* Pontinho Redondo: Vermelho para atrasados, Accent apenas para pendentes */}
                          {isPastSchedule ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: '#EF4444' }}
                              title="Atrasado"
                            />
                          ) : isPending ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: theme.accent }}
                              title="Pendente de confirmação"
                            />
                          ) : null}
                        </div>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider leading-tight opacity-65 tabular-nums mt-0.5"
                          style={{ color: isPastSchedule ? '#EF4444' : theme.textSecondary }}
                        >
                          {format(scheduledDate, 'dd MMM', { locale: ptBR })}
                        </span>
                      </div>

                      {/* Centro: Nome do Cliente + Ícones Neutros + Serviço e Status */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-bold text-sm sm:text-[15px] truncate tracking-tight"
                            style={{ color: theme.textPrimary }}
                          >
                            {booking.customer?.name ?? 'Cliente'}
                          </span>

                          <BookingMetaIcons
                            origin={info.origin}
                            originLabel={info.originLabel}
                            paymentType={info.paymentType}
                            paymentLabel={info.paymentLabel}
                          />
                        </div>

                        <p
                          className="text-xs truncate mt-0.5"
                          style={{ color: theme.textSecondary }}
                        >
                          <span className="opacity-80">{booking.service?.name ?? 'Serviço'}</span>
                          {booking.professional?.name && (
                            <span className="opacity-60">
                              {' '}· com {booking.professional.name.split(' ')[0]}
                            </span>
                          )}

                          {/* Status Diferenciado: Atrasado (Vermelho) e Pendente (Accent) */}
                          {isPastSchedule && isPending ? (
                            <>
                              <span className="font-bold ml-1.5 text-[#EF4444]">· Atrasado</span>
                              <span className="font-semibold ml-1" style={{ color: theme.accent }}>· Aguarda confirmação</span>
                            </>
                          ) : isPastSchedule ? (
                            <span className="font-bold ml-1.5 text-[#EF4444]">
                              · {isPastDay ? 'Dia atrasado' : 'Horário atrasado'}
                            </span>
                          ) : isPending ? (
                            <span className="font-semibold ml-1.5" style={{ color: theme.accent }}>
                              · Aguarda confirmação
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {/* Direita: Botão Quadrado Arredondado WhatsApp na cor do Accent + Preço */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {info.whatsappUrl && (
                          <a
                            href={info.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`WhatsApp: ${booking.customer?.name ?? 'Cliente'} (${info.formattedPhone})`}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border hover:opacity-85 active:scale-90 transition-transform flex items-center justify-center shrink-0 cursor-pointer"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${theme.accent} 12%, transparent)`,
                              borderColor: `color-mix(in srgb, ${theme.accent} 25%, transparent)`,
                              color: theme.accent,
                            }}
                          >
                            <WhatsAppSvgIcon className="w-4 h-4" />
                          </a>
                        )}
                        <span
                          className="text-xs sm:text-sm font-bold tabular-nums text-right"
                          style={{ color: theme.textPrimary }}
                        >
                          {fmt.format(booking.amount_total || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Paginação Limpa ── */}
          {totalPages > 1 && (
            <div className="pt-3 border-t flex items-center justify-between gap-3" style={{ borderColor: theme.border }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--theme-bg-hover)] cursor-pointer"
                style={{
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span className="text-xs font-medium opacity-75" style={{ color: theme.textSecondary }}>
                Página <strong style={{ color: theme.textPrimary }}>{safePage}</strong> de{' '}
                <strong style={{ color: theme.textPrimary }}>{totalPages}</strong>{' '}
                <span className="hidden sm:inline">· Total de {filteredItems.length} agendamentos</span>
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--theme-bg-hover)] cursor-pointer"
                style={{
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
