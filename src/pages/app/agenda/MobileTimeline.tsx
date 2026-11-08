import { useEffect, useRef, useState, useMemo } from 'react';
import { format, addDays, startOfDay, isSameDay, isToday, addMinutes, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  User,
  Check,
  Loader2,
  Lock,
  Unlock,
  SlidersHorizontal,
  ListChecks,
} from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';
import { isDateWithinBookingHorizon } from '../../../lib/bookingHorizon';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { BookingMetaIcons, WhatsAppSvgIcon } from './BookingMetaIcons';
import {
  type NormalizedBlock,
  isDayPartiallyOrFullyBlocked,
  getConsolidatedDayBlocks,
} from '../../../hooks/useBlockedTimes';

interface Props {
  currentDay: Date;
  bookings: Booking[];
  blocks?: NormalizedBlock[];
  targetProIds?: string[];
  businessHours?: any[];
  maxAdvanceDays?: number | null;
  canConfirm?: boolean;
  isTogglingDayBlock?: boolean;
  onDayChange: (d: Date) => void;
  onBookingClick: (b: Booking) => void;
  onConfirmBooking?: (bookingId: string, booking?: Booking) => void | Promise<void>;
  onNewBooking: (preferredDate?: Date) => void;
  onOpenBlockManager?: (date?: Date) => void;
  onQuickToggleFullDay?: (date: Date, currentlyBlocked: boolean) => void | Promise<void>;
  onOpenMonthCalendar?: () => void;
  onOpenBlockedOverview?: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function MobileTimeline({
  currentDay,
  bookings,
  blocks = [],
  targetProIds = [],
  businessHours = [],
  maxAdvanceDays,
  canConfirm = false,
  isTogglingDayBlock = false,
  onDayChange,
  onBookingClick,
  onConfirmBooking,
  onNewBooking,
  onOpenBlockManager,
  onQuickToggleFullDay,
  onOpenMonthCalendar,
  onOpenBlockedOverview,
}: Props) {
  const { theme } = useTheme();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const days = Array.from({ length: 15 }, (_, i) => addDays(startOfDay(currentDay), i - 7));
  const activeDayRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDayRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeDayRef.current;

      const containerWidth = container.clientWidth;
      const elementOffset = element.offsetLeft;
      const elementWidth = element.clientWidth;

      const scrollPosition = elementOffset - containerWidth / 2 + elementWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, [currentDay]);

  const getScheduleForDay = (d: Date) => {
    const bh = businessHours.find((x: any) => x.weekday === d.getDay());
    return {
      openTime: bh?.open_time ? String(bh.open_time).slice(0, 5) : '08:00',
      closeTime: bh?.close_time ? String(bh.close_time).slice(0, 5) : '20:00',
    };
  };

  const currentDaySched = useMemo(() => getScheduleForDay(currentDay), [currentDay, businessHours]);

  const currentDayBlockStatus = useMemo(
    () =>
      isDayPartiallyOrFullyBlocked(
        currentDay,
        blocks,
        targetProIds,
        currentDaySched.openTime,
        currentDaySched.closeTime
      ),
    [currentDay, blocks, targetProIds, currentDaySched]
  );

  const consolidatedDayBlocks = useMemo(
    () =>
      getConsolidatedDayBlocks(
        currentDay,
        blocks,
        targetProIds,
        currentDaySched.openTime,
        currentDaySched.closeTime
      ),
    [currentDay, blocks, targetProIds, currentDaySched]
  );

  const dayBookings = bookings.filter((b) => isSameDay(new Date(b.scheduled_at), currentDay));
  const sorted = [...dayBookings].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  const today = startOfDay(new Date());
  const isPastDay = isBefore(startOfDay(currentDay), today);
  const canScheduleOnCurrentDay =
    maxAdvanceDays === undefined
      ? !isPastDay
      : isDateWithinBookingHorizon(currentDay, maxAdvanceDays);

  const handleConfirm = async (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    if (!onConfirmBooking || !canConfirm || confirmingId) return;
    setConfirmingId(booking.id);
    try {
      await onConfirmBooking(booking.id, booking);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="flex flex-col bg-transparent pb-6">
      {/* Header Strip */}
      <div
        className="shrink-0 pt-5 pb-3.5 relative z-10 glass-card mx-3 mt-3 rounded-3xl mb-4 border"
        style={{ borderColor: theme.border, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
      >
        {/* Month/Year and Nav */}
        <div className="flex items-center justify-between px-5 mb-4 relative">
          <button
            onClick={() => onDayChange(addDays(currentDay, -7))}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: theme.textSecondary }}
            title="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => onOpenMonthCalendar?.()}
              className="relative font-serif text-[17px] font-bold capitalize tracking-tight cursor-pointer px-3.5 py-1.5 rounded-2xl border active:scale-95 transition-all flex items-center gap-2"
              style={{
                color: theme.textPrimary,
                backgroundColor: 'var(--theme-bg)',
                borderColor: theme.border,
              }}
              title="Toque para abrir o calendário do mês"
            >
              <Calendar className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
              <span>{format(currentDay, 'MMMM yyyy', { locale: ptBR })}</span>
              <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
            </button>
            <div className="flex items-center gap-2 mt-1.5">
              <p
                className="text-[10px] uppercase tracking-widest font-semibold opacity-70"
                style={{ color: theme.textSecondary }}
              >
                {format(currentDay, "EEEE, dd 'de' MMM", { locale: ptBR })}
              </p>
              {!isToday(currentDay) && (
                <button
                  onClick={() => onDayChange(new Date())}
                  className="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider transition-transform active:scale-95"
                  style={{ background: theme.accent, color: theme.btnPrimaryText }}
                >
                  Ir para Hoje
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => onDayChange(addDays(currentDay, 7))}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: theme.textSecondary }}
            title="Próxima semana"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Day Strip */}
        <div
          ref={containerRef}
          className="flex items-center gap-3 overflow-x-auto px-4 pb-4 scrollbar-none snap-x snap-mandatory relative pt-2"
        >
          {days.map((day) => {
            const selected = isSameDay(day, currentDay);
            const hasBookings = bookings.some(
              (b) => b.status !== 'canceled' && b.status !== 'no_show' && isSameDay(new Date(b.scheduled_at), day)
            );
            const sched = getScheduleForDay(day);
            const dayBlockInfo = isDayPartiallyOrFullyBlocked(
              day,
              blocks,
              targetProIds,
              sched.openTime,
              sched.closeTime
            );

            return (
              <button
                key={day.toISOString()}
                ref={selected ? activeDayRef : null}
                onClick={() => onDayChange(day)}
                className={`snap-center shrink-0 flex flex-col items-center justify-center w-[64px] h-[96px] rounded-[20px] transition-all relative ${selected ? 'scale-105 z-10' : 'hover:-translate-y-1'
                  }`}
                style={{
                  background: selected
                    ? theme.accentGradient
                    : dayBlockInfo.isFullyBlocked
                      ? `color-mix(in srgb, ${theme.accent} 10%, ${theme.cardBg})`
                      : theme.cardBg,
                  border: `1px solid ${selected
                      ? 'transparent'
                      : dayBlockInfo.isFullyBlocked
                        ? `color-mix(in srgb, ${theme.accent} 45%, transparent)`
                        : theme.border
                    }`,
                  opacity: !selected && dayBlockInfo.isFullyBlocked ? 0.85 : 1,
                }}
              >
                {/* Badge de cadeado no topo direito se o dia estiver bloqueado */}
                {dayBlockInfo.isFullyBlocked && (
                  <div
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: selected
                        ? 'rgba(0,0,0,0.2)'
                        : `color-mix(in srgb, ${theme.accent} 18%, transparent)`,
                      color: selected ? theme.btnPrimaryText : theme.accent,
                    }}
                    title="Dia bloqueado"
                  >
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                )}

                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: selected ? theme.btnPrimaryText : theme.textSecondary }}
                >
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span
                  className="text-[28px] font-extrabold leading-none tracking-tight my-1"
                  style={{ color: selected ? theme.btnPrimaryText : theme.textPrimary }}
                >
                  {format(day, 'dd')}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: selected ? theme.btnPrimaryText : theme.textSecondary }}
                >
                  {format(day, 'MMM', { locale: ptBR })}
                </span>

                {/* Dot indicator for existing bookings or partial block */}
                <div className="absolute bottom-2 flex items-center gap-1">
                  {hasBookings && (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: selected ? theme.btnPrimaryText : theme.accent }}
                    />
                  )}
                  {!dayBlockInfo.isFullyBlocked && dayBlockInfo.isPartiallyBlocked && (
                    <Lock
                      className="w-2.5 h-2.5 opacity-80"
                      style={{ color: selected ? theme.btnPrimaryText : theme.accent }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Barra Rápida de Bloqueio de Dia / Horários (Apple Quick Action Strip) */}
        {(onQuickToggleFullDay || onOpenBlockManager) && (
          <div
            className="mx-3 pt-3 border-t grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center"
            style={{ borderColor: theme.border }}
          >
            {onQuickToggleFullDay && (
              <button
                type="button"
                disabled={isTogglingDayBlock}
                onClick={() => onQuickToggleFullDay(currentDay, currentDayBlockStatus.isFullyBlocked)}
                className="w-full py-2 px-2 rounded-xl text-[11px] font-bold border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer min-w-0"
                style={{
                  backgroundColor: currentDayBlockStatus.isFullyBlocked
                    ? `color-mix(in srgb, ${theme.accent} 16%, transparent)`
                    : 'var(--theme-bg)',
                  borderColor: currentDayBlockStatus.isFullyBlocked ? theme.accent : theme.border,
                  color: currentDayBlockStatus.isFullyBlocked ? theme.accent : theme.textPrimary,
                }}
              >
                {isTogglingDayBlock ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : currentDayBlockStatus.isFullyBlocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Liberar dia</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                    <span className="truncate">Bloquear dia</span>
                  </>
                )}
              </button>
            )}

            {onOpenBlockManager && (
              <button
                type="button"
                onClick={() => onOpenBlockManager(currentDay)}
                className="w-full py-2 px-2 rounded-xl text-[11px] font-bold border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer min-w-0"
                style={{
                  backgroundColor: currentDayBlockStatus.isPartiallyBlocked
                    ? `color-mix(in srgb, ${theme.accent} 14%, transparent)`
                    : 'var(--theme-bg)',
                  borderColor: currentDayBlockStatus.isPartiallyBlocked ? theme.accent : theme.border,
                  color: currentDayBlockStatus.isPartiallyBlocked ? theme.accent : theme.textPrimary,
                }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                <span className="truncate">
                  {currentDayBlockStatus.isPartiallyBlocked
                    ? `Horários (${currentDayBlockStatus.blockedSlotsCount})`
                    : 'Horários'}
                </span>
              </button>
            )}

            {onOpenBlockedOverview && (
              <button
                type="button"
                onClick={onOpenBlockedOverview}
                className="py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shrink-0"
                style={{
                  backgroundColor: 'var(--theme-bg)',
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
                title="Ver todos os dias e horários bloqueados (Beta)"
              >
                <ListChecks className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accent }} />
                <span className="whitespace-nowrap">Bloqueios</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Faixa de Horários Bloqueados Parcialmente no Dia */}
      {!currentDayBlockStatus.isFullyBlocked && consolidatedDayBlocks.length > 0 && (
        <div className="px-3 mb-3">
          <div
            onClick={() => onOpenBlockManager?.(currentDay)}
            className="p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.99]"
            style={{
              backgroundColor: `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
              borderColor: `color-mix(in srgb, ${theme.accent} 30%, transparent)`,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${theme.accent} 18%, transparent)`,
                  color: theme.accent,
                }}
              >
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>
                  Horários bloqueados hoje
                </p>
                <p className="text-[11px] font-semibold truncate" style={{ color: theme.accent }}>
                  {consolidatedDayBlocks
                    .map((r) => `${format(r.start, 'HH:mm')}–${format(r.end, 'HH:mm')}`)
                    .join(' · ')}
                </p>
              </div>
            </div>

            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-xl border shrink-0"
              style={{
                borderColor: `color-mix(in srgb, ${theme.accent} 35%, transparent)`,
                color: theme.accent,
              }}
            >
              Editar
            </span>
          </div>
        </div>
      )}

      {/* Main Timeline (Cards) */}
      <div className="px-3 space-y-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 glass-card border"
              style={{
                borderColor: currentDayBlockStatus.isFullyBlocked
                  ? `color-mix(in srgb, ${theme.accent} 40%, transparent)`
                  : theme.border,
              }}
            >
              {currentDayBlockStatus.isFullyBlocked ? (
                <Lock className="w-9 h-9" style={{ color: theme.accent }} />
              ) : (
                <Clock className="w-9 h-9 opacity-30" style={{ color: theme.textSecondary }} />
              )}
            </div>
            <p className="font-serif text-2xl font-bold mb-2 tracking-tight" style={{ color: theme.textPrimary }}>
              {currentDayBlockStatus.isFullyBlocked ? 'Dia bloqueado' : 'Dia livre'}
            </p>
            <p className="text-sm max-w-[260px] leading-relaxed opacity-80" style={{ color: theme.textSecondary }}>
              {currentDayBlockStatus.isFullyBlocked
                ? 'Todos os horários deste dia estão bloqueados para novos agendamentos.'
                : canScheduleOnCurrentDay
                  ? 'Nenhum agendamento marcado para esta data.'
                  : isPastDay
                    ? 'Nenhum agendamento registrado nesta data passada.'
                    : 'Esta data está além da antecedência máxima configurada para novos agendamentos.'}
            </p>
            {currentDayBlockStatus.isFullyBlocked ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                {onQuickToggleFullDay && (
                  <button
                    type="button"
                    onClick={() => onQuickToggleFullDay(currentDay, true)}
                    className="px-6 py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90 flex items-center gap-2 cursor-pointer"
                    style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Liberar dia inteiro</span>
                  </button>
                )}
                {onOpenBlockManager && (
                  <button
                    type="button"
                    onClick={() => onOpenBlockManager(currentDay)}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border transition-opacity hover:opacity-90 cursor-pointer"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.cardBg,
                      color: theme.textPrimary,
                    }}
                  >
                    Liberar horários específicos
                  </button>
                )}
              </div>
            ) : (
              canScheduleOnCurrentDay && (
                <button
                  onClick={() => onNewBooking(currentDay)}
                  className="mt-7 px-7 py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                >
                  Criar agendamento
                </button>
              )
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 pb-1">
              <span
                className="text-xs uppercase tracking-widest font-semibold opacity-70"
                style={{ color: theme.textSecondary }}
              >
                {sorted.length} {sorted.length === 1 ? 'agendamento' : 'agendamentos'}
              </span>
              {currentDayBlockStatus.isFullyBlocked && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
                    color: theme.accent,
                  }}
                >
                  <Lock className="w-3 h-3" />
                  Novas reservas bloqueadas
                </span>
              )}
            </div>

            <div
              className={
                sorted.length > 3
                  ? 'max-h-[430px] overflow-y-auto overscroll-contain pr-1 space-y-3 scrollbar-thin'
                  : 'space-y-3'
              }
            >
              {sorted.map((b) => {
                const statusCfg = BOOKING_STATUS_CONFIG[b.status] || BOOKING_STATUS_CONFIG.confirmed;
                const confInfo = getBookingConfirmationInfo(b);
                const start = new Date(b.scheduled_at);
                const durationMins = Number(b.duration_minutes) || Number(b.service?.duration_minutes) || 30;
                const end = addMinutes(start, durationMins);
                const isConfirmingThis = confirmingId === b.id;

                const isOverdue = confInfo.confirmationState === 'overdue';
                const isPending = confInfo.confirmationState === 'pending';

                const badgeStyle = isOverdue
                  ? { bg: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', label: 'Atrasado' }
                  : isPending
                    ? {
                        bg: `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
                        color: theme.accent,
                        label: 'Aguarda confirmação',
                      }
                    : { bg: statusCfg.bg, color: statusCfg.color, label: statusCfg.label };

                return (
                  <div
                    key={b.id}
                    onClick={() => onBookingClick(b)}
                    className="rounded-3xl p-5 active:scale-[0.98] transition-transform glass-card cursor-pointer border"
                    style={{
                      borderColor: isOverdue
                        ? 'rgba(239, 68, 68, 0.35)'
                        : isPending
                          ? `color-mix(in srgb, ${theme.accent} 30%, ${theme.border})`
                          : theme.border,
                    }}
                  >
                    {/* Top: Time & Confirmation / Status */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                          style={{
                            background: theme.cardBg,
                            border: `1px solid ${
                              isOverdue
                                ? 'rgba(239, 68, 68, 0.35)'
                                : isPending
                                  ? `color-mix(in srgb, ${theme.accent} 35%, transparent)`
                                  : theme.border
                            }`,
                          }}
                        >
                          {isOverdue ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: '#ef4444' }}
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
                            style={{ color: isOverdue ? '#ef4444' : theme.textPrimary }}
                          >
                            {format(start, 'HH:mm')}
                          </span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                          até {format(end, 'HH:mm')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}
                        >
                          {badgeStyle.label}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Client, Origin/Payment Badges & Service */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-lg leading-snug" style={{ color: theme.textPrimary }}>
                            {b.customer?.name ?? 'Cliente'}
                          </h4>
                          <BookingMetaIcons
                            origin={confInfo.origin}
                            originLabel={confInfo.originLabel}
                            paymentType={confInfo.paymentType}
                            paymentLabel={confInfo.paymentLabel}
                          />
                        </div>
                        <p className="text-sm font-medium mt-0.5" style={{ color: theme.textSecondary }}>
                          {b.service?.name ?? 'Serviço'}
                        </p>
                      </div>

                      {confInfo.whatsappUrl && (
                        <a
                          href={confInfo.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`WhatsApp: ${b.customer?.name ?? 'Cliente'}`}
                          className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-opacity hover:opacity-80"
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

                    {/* Bottom: Professional, Price & Direct Confirm Action */}
                    <div
                      className="pt-3.5 border-t flex items-center justify-between gap-2"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
                        >
                          <User className="w-3.5 h-3.5" style={{ color: theme.textSecondary }} />
                        </div>
                        <span className="text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>
                          {b.professional?.name ?? 'Sem profissional'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {confInfo.isPending && canConfirm && onConfirmBooking && (
                          <button
                            type="button"
                            onClick={(e) => handleConfirm(e, b)}
                            disabled={isConfirmingThis}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
                            style={{
                              background: 'var(--theme-accent-gradient)',
                              color: 'var(--theme-btn-primary-text)',
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

                        <span className="text-base font-bold" style={{ color: theme.textPrimary }}>
                          {fmt.format(b.amount_total || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
