import { useMemo, useState } from 'react';
import { format, isToday, isTomorrow, startOfDay, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  AlertCircle,
  Loader2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Check,
} from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
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

type FilterTab = 'all' | 'pending' | 'overdue' | 'confirmed';
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

const ITEMS_PER_PAGE = 6;

export default function UpcomingConfirmationsCenter({
  bookings,
  isLoading = false,
  canConfirm,
  onBookingClick,
  onConfirmBooking,
}: UpcomingConfirmationsCenterProps) {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('oldest_first');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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

  // Filtragem e Ordenação por data
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
        title = format(item.scheduledDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
        subtitle = 'Em atraso';
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

  const handleDirectConfirm = async (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    if (!canConfirm || confirmingId) return;
    setConfirmingId(booking.id);
    try {
      await onConfirmBooking(booking.id, booking);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <section
      aria-label="Central de agendamentos"
      className="mt-6 rounded-3xl border p-4 sm:p-6 transition-all glass-card"
      style={{
        borderColor: theme.border,
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Header da Central (Estilo Apple iOS) ── */}
      <div className="flex flex-col gap-3.5 pb-4 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
                Próximos & Pendentes
              </h2>

              {counts.overdue > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.14)',
                    color: '#EF4444',
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {counts.overdue} {counts.overdue === 1 ? 'atrasado' : 'atrasados'}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 opacity-75" style={{ color: theme.textSecondary }}>
              Confirme reservas pendentes ou converse com o cliente em um toque
            </p>
          </div>

          {/* Botão compacto de Ordenação */}
          <button
            type="button"
            onClick={handleSortToggle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.cardBg,
              color: theme.textPrimary,
            }}
            title="Alternar ordem das datas"
          >
            <ArrowUpDown className="w-3.5 h-3.5" style={{ color: theme.accent }} />
            <span className="hidden sm:inline">
              {sortOrder === 'oldest_first' ? 'Mais próximos' : 'Mais distantes'}
            </span>
          </button>
        </div>

        {/* Barra de Filtros Deslizante (Pills Estilo Apple) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { id: 'all' as FilterTab, label: 'Todos', count: counts.total },
            { id: 'pending' as FilterTab, label: 'Aguardando confirmação', count: counts.pending },
            { id: 'overdue' as FilterTab, label: 'Atrasados', count: counts.overdue, isAlert: counts.overdue > 0 },
            { id: 'confirmed' as FilterTab, label: 'Confirmados', count: counts.confirmed },
          ].map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterChange(tab.id)}
                className="px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 active:scale-95 border"
                style={{
                  background: active
                    ? tab.isAlert
                      ? '#EF4444'
                      : theme.accentGradient
                    : theme.cardBg,
                  borderColor: active
                    ? 'transparent'
                    : tab.isAlert
                      ? 'rgba(239, 68, 68, 0.35)'
                      : theme.border,
                  color: active
                    ? tab.isAlert
                      ? '#FFFFFF'
                      : theme.btnPrimaryText
                    : tab.isAlert
                      ? '#EF4444'
                      : theme.textSecondary,
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums"
                  style={{
                    backgroundColor: active ? 'rgba(0,0,0,0.18)' : 'rgba(128,128,128,0.12)',
                    color: active ? '#FFFFFF' : 'inherit',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista de Cards Unificados (Mesmo Design Limpo do Card Superior) ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border"
            style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
          >
            <Calendar className="w-6 h-6 opacity-40" style={{ color: theme.textSecondary }} />
          </div>
          <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>
            {activeFilter === 'overdue'
              ? 'Nenhum agendamento atrasado'
              : activeFilter === 'pending'
                ? 'Tudo confirmado por aqui'
                : 'Nenhum agendamento encontrado'}
          </p>
          <p className="text-xs mt-1 opacity-70 max-w-xs" style={{ color: theme.textSecondary }}>
            {activeFilter === 'overdue'
              ? 'Todos os atendimentos anteriores já foram concluídos ou atualizados.'
              : 'Novos agendamentos aparecerão aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <div className="pt-5 space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              {/* Cabeçalho do Dia */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {group.isAlertGroup && <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />}
                  <span
                    className="text-xs font-extrabold uppercase tracking-wider"
                    style={{ color: group.isAlertGroup ? '#EF4444' : theme.textSecondary }}
                  >
                    {group.title}
                  </span>
                  {group.subtitle && (
                    <span
                      className="text-xs font-semibold opacity-75"
                      style={{ color: group.isAlertGroup ? '#EF4444' : theme.textSecondary }}
                    >
                      · {group.subtitle}
                    </span>
                  )}
                </div>

                <span
                  className="text-[11px] font-bold opacity-60"
                  style={{ color: theme.textSecondary }}
                >
                  {group.items.length} {group.items.length === 1 ? 'horário' : 'horários'}
                </span>
              </div>

              {/* Grid de Cards (1 coluna no mobile, 2 colunas no desktop para máximo aproveitamento visual) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {group.items.map(({ booking, info, scheduledDate }) => {
                  const statusCfg = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.confirmed;
                  const schedMs = scheduledDate.getTime();
                  const isPastDay = schedMs < todayStartMs;
                  const isPastTime = isToday(scheduledDate) && schedMs < now.getTime();
                  const isPastSchedule = isPastDay || isPastTime;
                  const isPending = info.isPending;

                  const durationMins =
                    Number(booking.duration_minutes) ||
                    Number(booking.service?.duration_minutes) ||
                    30;
                  const endDate = addMinutes(scheduledDate, durationMins);
                  const isConfirmingThis = confirmingId === booking.id;

                  // Regra estrita de cores do badge e do dot:
                  // - Vermelho (#EF4444) quando atrasado
                  // - Accent (theme.accent) quando pendente de confirmação
                  const badgeStyle = isPastSchedule
                    ? { bg: 'rgba(239, 68, 68, 0.14)', color: '#EF4444', label: 'Atrasado' }
                    : isPending
                      ? {
                          bg: `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
                          color: theme.accent,
                          label: 'Aguarda confirmação',
                        }
                      : { bg: statusCfg.bg, color: statusCfg.color, label: statusCfg.label };

                  return (
                    <div
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className="rounded-3xl p-4 sm:p-5 active:scale-[0.99] transition-all cursor-pointer border flex flex-col justify-between"
                      style={{
                        backgroundColor: isPastSchedule
                          ? 'rgba(239, 68, 68, 0.03)'
                          : theme.cardBg,
                        borderColor: isPastSchedule
                          ? 'rgba(239, 68, 68, 0.35)'
                          : isPending
                            ? `color-mix(in srgb, ${theme.accent} 30%, ${theme.border})`
                            : theme.border,
                      }}
                    >
                      <div>
                        {/* Topo do Card: Pill de Horário (com dot redondo apenas p/ pendente ou atrasado) + Status */}
                        <div className="flex items-center justify-between gap-2 mb-3.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0"
                              style={{
                                background: 'var(--theme-bg)',
                                border: `1px solid ${
                                  isPastSchedule
                                    ? 'rgba(239, 68, 68, 0.35)'
                                    : isPending
                                      ? `color-mix(in srgb, ${theme.accent} 35%, transparent)`
                                      : theme.border
                                }`,
                              }}
                            >
                              {isPastSchedule ? (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: '#EF4444' }}
                                  title="Horário atrasado"
                                />
                              ) : isPending ? (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: theme.accent }}
                                  title="Aguarda confirmação"
                                />
                              ) : null}

                              <span
                                className="text-sm font-bold tabular-nums"
                                style={{ color: isPastSchedule ? '#EF4444' : theme.textPrimary }}
                              >
                                {format(scheduledDate, 'HH:mm')}
                              </span>
                            </div>

                            <span className="text-xs font-medium truncate" style={{ color: theme.textSecondary }}>
                              até {format(endDate, 'HH:mm')} · {format(scheduledDate, 'dd MMM', { locale: ptBR })}
                            </span>
                          </div>

                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
                            style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}
                          >
                            {badgeStyle.label}
                          </span>
                        </div>

                        {/* Meio do Card: Nome Completo do Cliente + Serviço + Botão WhatsApp na cor do Accent */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4
                                className="font-bold text-base sm:text-lg leading-snug break-words"
                                style={{ color: theme.textPrimary }}
                              >
                                {booking.customer?.name ?? 'Cliente'}
                              </h4>
                              <BookingMetaIcons
                                origin={info.origin}
                                originLabel={info.originLabel}
                                paymentType={info.paymentType}
                                paymentLabel={info.paymentLabel}
                              />
                            </div>
                            <p
                              className="text-sm font-medium mt-0.5 truncate"
                              style={{ color: theme.textSecondary }}
                            >
                              {booking.service?.name ?? 'Serviço'}
                            </p>
                          </div>

                          {info.whatsappUrl && (
                            <a
                              href={info.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={`Conversar no WhatsApp com ${booking.customer?.name ?? 'Cliente'}`}
                              className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-transform active:scale-90 hover:opacity-85"
                              style={{
                                borderColor: `color-mix(in srgb, ${theme.accent} 25%, transparent)`,
                                backgroundColor: `color-mix(in srgb, ${theme.accent} 12%, transparent)`,
                                color: theme.accent,
                              }}
                            >
                              <WhatsAppSvgIcon className="w-4.5 h-4.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Rodapé do Card: Profissional + Botão Confirmar Direto + Valor */}
                      <div
                        className="pt-3.5 border-t flex items-center justify-between gap-2"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: 'var(--theme-bg)', border: `1px solid ${theme.border}` }}
                          >
                            <User className="w-3.5 h-3.5" style={{ color: theme.textSecondary }} />
                          </div>
                          <span className="text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>
                            {booking.professional?.name ?? 'Sem profissional'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {isPending && canConfirm && (
                            <button
                              type="button"
                              onClick={(e) => handleDirectConfirm(e, booking)}
                              disabled={isConfirmingThis}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
                              style={{
                                background: theme.accentGradient,
                                color: theme.btnPrimaryText,
                              }}
                            >
                              {isConfirmingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              )}
                              <span>Confirmar</span>
                            </button>
                          )}

                          <span className="text-base font-bold tabular-nums" style={{ color: theme.textPrimary }}>
                            {fmt.format(booking.amount_total || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Paginação Limpa ── */}
          {totalPages > 1 && (
            <div
              className="pt-4 border-t flex items-center justify-between gap-3"
              style={{ borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--theme-bg-hover)] cursor-pointer"
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
                <strong style={{ color: theme.textPrimary }}>{totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--theme-bg-hover)] cursor-pointer"
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
