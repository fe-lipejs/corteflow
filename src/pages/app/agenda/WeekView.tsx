import { useMemo, useRef, useEffect, useState } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Lock, Unlock } from 'lucide-react';
import { type Booking, BOOKING_STATUS_CONFIG } from '../../../hooks/useBookings';
import { supabase } from '../../../integrations/supabase/client';
import { isDateWithinBookingHorizon, sanitizeHexColor } from '../../../lib/bookingHorizon';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import {
  type NormalizedBlock,
  getConsolidatedDayBlocks,
  isDayFullyBlocked,
} from '../../../hooks/useBlockedTimes';

interface BusinessHour {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
}

interface WeekViewProps {
  weekStart: Date;
  bookings: Booking[];
  businessHours: BusinessHour[];
  selectedProfessionalId?: string | null;
  maxAdvanceDays?: number | null;
  canConfirm?: boolean;
  blocks?: NormalizedBlock[];
  targetProIds?: string[];
  onBookingClick: (booking: Booking) => void;
  onConfirmBooking?: (bookingId: string, booking?: Booking) => void | Promise<void>;
  onSlotClick: (date: Date, hour: number) => void;
  onOpenBlockManager?: (date?: Date) => void;
  onQuickToggleFullDay?: (date: Date, currentlyBlocked: boolean) => void;
}

const HOUR_HEIGHT = 96; // px per hour

export default function WeekView({
  weekStart,
  bookings,
  businessHours,
  selectedProfessionalId,
  maxAdvanceDays,
  canConfirm = false,
  blocks = [],
  targetProIds = [],
  onBookingClick,
  onConfirmBooking,
  onSlotClick,
  onOpenBlockManager,
  onQuickToggleFullDay,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [proWorkingHours, setProWorkingHours] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProfessionalId) {
      setProWorkingHours([]);
      return;
    }
    supabase
      .from('professional_working_hours')
      .select('*')
      .eq('professional_id', selectedProfessionalId)
      .then(({ data }) => setProWorkingHours(data ?? []));
  }, [selectedProfessionalId]);

  const effectiveHours = useMemo(() => {
    if (selectedProfessionalId && proWorkingHours.length > 0) {
      return proWorkingHours.map((ph) => ({
        weekday: ph.weekday,
        is_open: ph.is_working,
        open_time: ph.open_time,
        close_time: ph.close_time,
        lunch_start: ph.lunch_start,
        lunch_end: ph.lunch_end,
      }));
    }
    return businessHours;
  }, [businessHours, selectedProfessionalId, proWorkingHours]);

  // Dynamic hour range from effective hours
  const { startHour, endHour } = useMemo(() => {
    const openDays = effectiveHours.filter((b) => b.is_open);
    if (!openDays.length) return { startHour: 7, endHour: 22 };
    const opens = openDays.map((b) => parseInt(b.open_time.split(':')[0], 10));
    const closes = openDays.map((b) => {
      const [h, m] = b.close_time.split(':').map(Number);
      return m > 0 ? h + 1 : h;
    });
    return {
      startHour: Math.max(0, Math.min(...opens) - 1),
      endHour: Math.min(23, Math.max(...closes) + 1),
    };
  }, [effectiveHours]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Current time indicator
  const now = new Date();
  const currentMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
  const nowOffset = (currentMinutes / 60) * HOUR_HEIGHT;

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = Math.max(0, nowOffset - 200);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [nowOffset]);

  // Agrupamento em colunas reais sem colisão para agendamentos simultâneos
  const getPositionedBookingsForDay = (day: Date) => {
    const dayBookings = bookings
      .filter((b) => isSameDay(new Date(b.scheduled_at), day))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const items = dayBookings.map((b) => {
      const dt = new Date(b.scheduled_at);
      const mins = (dt.getHours() - startHour) * 60 + dt.getMinutes();
      const top = (mins / 60) * HOUR_HEIGHT;
      const duration = b.duration_minutes || b.service?.duration_minutes || 30;
      const height = Math.max((duration / 60) * HOUR_HEIGHT - 3, 44);
      return {
        booking: b,
        top,
        height,
        bottom: top + height,
        colIndex: 0,
        totalCols: 1,
      };
    });

    // Atribuição gulosa de colunas por cluster de colisão
    let cluster: typeof items = [];
    let clusterMaxBottom = -1;

    const finalizeCluster = (group: typeof items) => {
      if (group.length === 0) return;
      const colEnds: number[] = [];
      for (const item of group) {
        let placedCol = -1;
        for (let c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= item.top + 1) {
            placedCol = c;
            colEnds[c] = item.bottom;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = colEnds.length;
          colEnds.push(item.bottom);
        }
        item.colIndex = placedCol;
      }
      const totalCols = Math.max(1, colEnds.length);
      for (const item of group) {
        item.totalCols = totalCols;
      }
    };

    for (const item of items) {
      if (cluster.length === 0) {
        cluster.push(item);
        clusterMaxBottom = item.bottom;
      } else if (item.top < clusterMaxBottom - 1) {
        cluster.push(item);
        clusterMaxBottom = Math.max(clusterMaxBottom, item.bottom);
      } else {
        finalizeCluster(cluster);
        cluster = [item];
        clusterMaxBottom = item.bottom;
      }
    }
    finalizeCluster(cluster);

    return items.map((item) => {
      const widthPercent = 100 / item.totalCols;
      const leftPercent = item.colIndex * widthPercent;
      return {
        ...item,
        widthPercent,
        leftPercent,
      };
    });
  };

  const getDayOpenCloseStr = (day: Date) => {
    const weekday = day.getDay();
    const bh = effectiveHours.find((b) => b.weekday === weekday);
    return {
      openTimeStr: bh?.open_time ? bh.open_time.slice(0, 5) : '08:00',
      closeTimeStr: bh?.close_time ? bh.close_time.slice(0, 5) : '20:00',
    };
  };

  const isDayOpen = (day: Date) => {
    const weekday = day.getDay();
    const bh = effectiveHours.find((b) => b.weekday === weekday);
    return bh ? bh.is_open : true;
  };

  const getLunchBand = (day: Date): { top: number; height: number } | null => {
    const weekday = day.getDay();
    const bh = effectiveHours.find((b) => b.weekday === weekday);
    if (!bh?.lunch_start || !bh?.lunch_end) return null;
    const [lsh, lsm] = bh.lunch_start.split(':').map(Number);
    const [leh, lem] = bh.lunch_end.split(':').map(Number);
    const startMins = (lsh - startHour) * 60 + lsm;
    const endMins = (leh - startHour) * 60 + lem;
    return {
      top: (startMins / 60) * HOUR_HEIGHT,
      height: ((endMins - startMins) / 60) * HOUR_HEIGHT,
    };
  };

  const isHourInBusinessHours = (day: Date, hour: number) => {
    const weekday = day.getDay();
    const bh = effectiveHours.find((b) => b.weekday === weekday);
    if (!bh || !bh.is_open) return false;
    const openH = parseInt(bh.open_time.split(':')[0], 10);
    const closeH = parseInt(bh.close_time.split(':')[0], 10);
    return hour >= openH && hour < closeH;
  };

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden select-none">
      {/* ── Day headers ── */}
      <div
        className="grid border-b shrink-0"
        style={{
          gridTemplateColumns: '56px repeat(7, 1fr)',
          borderColor: 'var(--theme-border)',
          backgroundColor: 'var(--theme-bg)',
        }}
      >
        <div className="border-r py-3" style={{ borderColor: 'var(--theme-border)' }} />
        {days.map((day, idx) => {
          const today = isToday(day);
          const open = isDayOpen(day);
          const { openTimeStr, closeTimeStr } = getDayOpenCloseStr(day);
          const fullBlocked = isDayFullyBlocked(day, blocks, targetProIds, openTimeStr, closeTimeStr);
          const dayCount = bookings.filter((b) => isSameDay(new Date(b.scheduled_at), day)).length;
          return (
            <div
              key={idx}
              className={`py-2.5 px-1 text-center border-r last:border-r-0 transition-colors relative group ${!open ? 'opacity-40' : ''}`}
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: today ? 'rgba(201,150,59,0.06)' : undefined,
              }}
            >
              {/* Quick 1-click day block / unblock icon in corner */}
              {open && onQuickToggleFullDay && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickToggleFullDay(day, fullBlocked);
                  }}
                  title={fullBlocked ? 'Clique para liberar este dia' : 'Clique para bloquear este dia inteiro'}
                  className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                    fullBlocked
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: fullBlocked ? 'rgba(201,150,59,0.16)' : 'var(--theme-card-bg)',
                    borderColor: fullBlocked ? 'var(--theme-accent)' : 'var(--theme-border)',
                    color: 'var(--theme-accent)',
                  }}
                >
                  {fullBlocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-75" />}
                </button>
              )}

              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: today ? 'var(--theme-accent)' : 'var(--theme-text-secondary)' }}
              >
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <div
                onClick={() => onOpenBlockManager && onOpenBlockManager(day)}
                title={onOpenBlockManager ? 'Gerenciar horários deste dia' : undefined}
                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold text-sm transition-all ${
                  onOpenBlockManager ? 'cursor-pointer hover:scale-105' : ''
                } ${fullBlocked && !today ? 'line-through opacity-65' : ''}`}
                style={{
                  backgroundColor: today ? 'var(--theme-accent)' : 'transparent',
                  color: today ? 'var(--theme-btn-primary-text, #090A0B)' : 'var(--theme-text-primary)',
                  boxShadow: today ? '0 0 12px rgba(201,150,59,0.35)' : undefined,
                }}
              >
                {format(day, 'd')}
              </div>
              {dayCount > 0 && (
                <div className="flex justify-center gap-0.5 mt-1">
                  {Array.from({ length: Math.min(dayCount, 5) }).map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: today ? 'var(--theme-accent)' : 'var(--theme-text-secondary)' }}
                    />
                  ))}
                </div>
              )}
              {fullBlocked && open && (
                <p
                  onClick={() => onOpenBlockManager && onOpenBlockManager(day)}
                  className="text-[9px] font-bold mt-0.5 cursor-pointer flex items-center justify-center gap-0.5"
                  style={{ color: 'var(--theme-accent)' }}
                >
                  <Lock className="w-2.5 h-2.5" /> Bloqueado
                </p>
              )}
              {!open && (
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                  Fechado
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* Hour labels column */}
          <div className="border-r" style={{ borderColor: 'var(--theme-border)' }}>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT, borderColor: 'rgba(255,255,255,0.03)' }}
                className="border-b pr-2 pt-1.5 text-right"
              >
                <span className="text-[11px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {days.map((day, dayIdx) => {
            const positionedBookings = getPositionedBookingsForDay(day);
            const open = isDayOpen(day);
            const today = isToday(day);
            const lunch = getLunchBand(day);
            const { openTimeStr, closeTimeStr } = getDayOpenCloseStr(day);
            const fullBlocked = isDayFullyBlocked(day, blocks, targetProIds, openTimeStr, closeTimeStr);
            const consolidatedBlocks = getConsolidatedDayBlocks(
              day,
              blocks,
              targetProIds,
              openTimeStr,
              closeTimeStr
            );

            const blockedBands: Array<{
              startMs: number;
              endMs: number;
              startTime: string;
              endTime: string;
              isFullDay: boolean;
              top: number;
              height: number;
            }> = [];

            for (const cb of consolidatedBlocks) {
              const s = cb.start;
              const e = cb.end;
              const startMins = (s.getHours() - startHour) * 60 + s.getMinutes();
              const endMins = (e.getHours() - startHour) * 60 + e.getMinutes();
              const clampedStart = Math.max(0, startMins);
              const clampedEnd = Math.min(hours.length * 60, endMins);
              if (clampedEnd <= clampedStart) continue;
              blockedBands.push({
                startMs: s.getTime(),
                endMs: e.getTime(),
                startTime: format(s, 'HH:mm'),
                endTime: format(e, 'HH:mm'),
                isFullDay: fullBlocked,
                top: (clampedStart / 60) * HOUR_HEIGHT,
                height: Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, 24),
              });
            }

            const isHourBlocked = (hour: number) => {
              const hs = new Date(day);
              hs.setHours(hour, 0, 0, 0);
              const he = new Date(day);
              he.setHours(hour + 1, 0, 0, 0);
              return consolidatedBlocks.some(
                (cb) => cb.start.getTime() <= hs.getTime() && cb.end.getTime() >= he.getTime()
              );
            };

            return (
              <div
                key={dayIdx}
                className="border-r last:border-r-0 relative"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: !open
                    ? 'rgba(0,0,0,0.06)'
                    : today
                      ? 'rgba(201,150,59,0.025)'
                      : undefined,
                }}
              >
                {/* Hour rows (click targets) */}
                {hours.map((h) => {
                  const inHours = isHourInBusinessHours(day, h);
                  const hourBlocked = isHourBlocked(h);
                  // Só considera passado se o FIM daquela hora já passou (permite agendar na hora atual de hoje)
                  const slotEnd = new Date(day);
                  slotEnd.setHours(h + 1, 0, 0, 0);
                  const isPast = slotEnd.getTime() <= now.getTime();
                  const withinHorizon =
                    maxAdvanceDays === undefined
                      ? true
                      : isDateWithinBookingHorizon(day, maxAdvanceDays, now);
                  const canSchedule = open && inHours && !hourBlocked && !isPast && withinHorizon;

                  return (
                    <div
                      key={h}
                      style={{ height: HOUR_HEIGHT, borderColor: 'var(--theme-border)' }}
                      onClick={() => canSchedule && onSlotClick(day, h)}
                      className={`border-b relative transition-colors group ${
                        canSchedule
                          ? 'cursor-pointer hover:bg-[rgba(201,150,59,0.06)]'
                          : ' opacity-40 cursor-not-allowed'
                      }`}
                    >
                      {/* Half-hour dashed line */}
                      <div
                        className="absolute inset-x-0 top-1/2 border-b border-dashed pointer-events-none"
                        style={{ borderColor: 'var(--theme-border)', opacity: 0.45 }}
                      />
                      {/* Hover + hint */}
                      {canSchedule && (
                        <span
                          className="absolute top-1 right-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none"
                          style={{ color: 'var(--theme-accent)' }}
                        >
                          +
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Blocked bands */}
                {blockedBands.map((band, bIdx) => (
                  <div
                    key={`wk-block-${bIdx}`}
                    style={{
                      top: band.top,
                      height: band.height,
                      borderColor: 'var(--theme-accent)',
                      backgroundColor: 'rgba(0,0,0,0.24)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenBlockManager) onOpenBlockManager(day);
                    }}
                    title={
                      band.isFullDay
                        ? 'Dia bloqueado — clique para gerenciar ou liberar'
                        : `Bloqueado (${band.startTime} – ${band.endTime}) — clique para gerenciar`
                    }
                    className="absolute inset-x-1 rounded-lg border border-dashed z-[8] flex items-center justify-center px-1.5 cursor-pointer hover:opacity-90 transition-opacity backdrop-blur-[1px] overflow-hidden"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <Lock className="w-3 h-3 shrink-0" style={{ color: 'var(--theme-accent)' }} />
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        {band.isFullDay ? 'Dia bloqueado' : `${band.startTime}–${band.endTime}`}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Lunch break band */}
                {lunch && lunch.top >= 0 && (
                  <div
                    style={{ top: lunch.top, height: lunch.height }}
                    className="absolute inset-x-0 pointer-events-none flex items-center justify-center z-5"
                    title="Horário de almoço"
                  >
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background:
                          'repeating-linear-gradient(45deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 6px, transparent 6px, transparent 12px)',
                        borderTop: '1px dashed rgba(255,255,255,0.08)',
                        borderBottom: '1px dashed rgba(255,255,255,0.08)',
                      }}
                    >
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg)' }}
                      >
                        Almoço
                      </span>
                    </div>
                  </div>
                )}

                {/* Current time red line */}
                {today && nowOffset >= 0 && nowOffset <= hours.length * HOUR_HEIGHT && (
                  <div
                    style={{ top: nowOffset }}
                    className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shrink-0 shadow-[0_0_8px_#f43f5e]" />
                    <div className="flex-1 h-[1.5px] bg-rose-500 shadow-[0_0_4px_#f43f5e]" />
                  </div>
                )}

                {/* ── Booking blocks ── */}
                {positionedBookings.map(({ booking, top, height, widthPercent, leftPercent }) => {
                  const statusCfg = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.confirmed;
                  const confInfo = getBookingConfirmationInfo(booking);
                  const accentColor = sanitizeHexColor(
                    booking.professional?.agenda_color ||
                      booking.pro_color ||
                      booking.service?.color,
                    '#C9963B'
                  );

                  const isCompact = height < 62;
                  const isNarrow = widthPercent < 55;
                  const isConfirmingThis = confirmingId === booking.id;

                  const dotColor =
                    confInfo.confirmationState === 'overdue'
                      ? '#ef4444'
                      : confInfo.confirmationState === 'pending'
                        ? '#f59e0b'
                        : statusCfg.color;

                  const dotTitle =
                    confInfo.confirmationState === 'overdue'
                      ? 'Confirmação atrasada'
                      : confInfo.confirmationState === 'pending'
                        ? 'Aguarda confirmação'
                        : statusCfg.label;

                  return (
                    <div
                      key={booking.id}
                      style={{
                        top: `${top + 1}px`,
                        height: `${height}px`,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        borderLeftColor: accentColor,
                        backgroundColor: 'var(--theme-card-bg)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                      title={`${format(new Date(booking.scheduled_at), 'HH:mm')} • ${booking.customer?.name ?? 'Cliente'} • ${booking.service?.name ?? 'Serviço'} (${confInfo.originLabel} · ${confInfo.paymentLabel} · ${confInfo.confirmationLabel})`}
                      className={`absolute rounded-lg border-l-[3.5px] cursor-pointer z-10 overflow-hidden
                        hover:z-30 hover:scale-[1.01] transition-all shadow-md hover:shadow-xl flex flex-col justify-between ${
                          isCompact ? 'px-2 py-1' : 'px-2.5 py-1.5'
                        }`}
                    >
                      {/* Colored tint overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none rounded-lg"
                        style={{ backgroundColor: `${accentColor}16` }}
                      />

                      {isCompact ? (
                        /* Compact Mode (ex: 30min) — 2 linhas enxutas que cabem em 45px sem vazar para o horário de baixo */
                        <div className="relative z-10 flex flex-col justify-center h-full min-w-0 leading-tight">
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span
                              className="text-[10px] font-black tracking-tight truncate"
                              style={{ color: accentColor }}
                            >
                              {format(new Date(booking.scheduled_at), 'HH:mm')}{' '}
                              <span style={{ color: 'var(--theme-text-primary)' }}>
                                {booking.customer?.name ?? 'Cliente'}
                              </span>
                            </span>
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }}
                              title={dotTitle}
                            />
                          </div>
                          <p
                            className="text-[9.5px] font-semibold truncate opacity-85"
                            style={{ color: 'var(--theme-text-secondary)' }}
                          >
                            {booking.service?.name ?? 'Serviço'}
                            {!isNarrow && confInfo.isPending ? ` · ${confInfo.confirmationShortLabel}` : ''}
                          </p>
                        </div>
                      ) : (
                        /* Standard Mode (45min / 60min+) */
                        <>
                          <div className="relative z-10 flex items-center justify-between gap-1">
                            <span
                              className="text-[10px] font-black tracking-tight shrink-0"
                              style={{ color: accentColor }}
                            >
                              {format(new Date(booking.scheduled_at), 'HH:mm')}
                            </span>
                            <div className="flex items-center gap-1 min-w-0">
                              {!isNarrow && booking.professional?.name && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.2 rounded truncate max-w-[75px]"
                                  style={{
                                    backgroundColor: `${accentColor}22`,
                                    color: accentColor,
                                  }}
                                >
                                  {booking.professional.name.split(' ')[0]}
                                </span>
                              )}
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: dotColor }}
                                title={dotTitle}
                              />
                            </div>
                          </div>

                          <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0 my-0.5">
                            <p
                              className="text-[11.5px] font-extrabold leading-tight truncate"
                              style={{ color: 'var(--theme-text-primary)' }}
                            >
                              {booking.customer?.name ?? 'Cliente'}
                            </p>
                          </div>

                          <div className="relative z-10 flex items-center justify-between gap-1">
                            <p
                              className="text-[10px] font-semibold truncate opacity-85"
                              style={{ color: 'var(--theme-text-secondary)' }}
                            >
                              {booking.service?.name ?? 'Serviço'}
                              {!isNarrow && confInfo.isPending ? ` · ${confInfo.confirmationShortLabel}` : ''}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
