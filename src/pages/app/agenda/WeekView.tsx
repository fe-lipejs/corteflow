import { useMemo, useRef, useEffect, useState } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { type Booking, BOOKING_STATUS_CONFIG } from '../../../hooks/useBookings';
import { supabase } from '../../../integrations/supabase/client';

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
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

const HOUR_HEIGHT = 96; // px per hour

export default function WeekView({
  weekStart,
  bookings,
  businessHours,
  selectedProfessionalId,
  onBookingClick,
  onSlotClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [proWorkingHours, setProWorkingHours] = useState<any[]>([]);

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
          const dayCount = bookings.filter((b) => isSameDay(new Date(b.scheduled_at), day)).length;
          return (
            <div
              key={idx}
              className={`py-3 px-1 text-center border-r last:border-r-0 transition-colors ${!open ? 'opacity-40' : ''}`}
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: today ? 'rgba(201,150,59,0.06)' : undefined,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: today ? 'var(--theme-accent)' : 'var(--theme-text-secondary)' }}
              >
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold text-sm transition-all"
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
                  // Só considera passado se o FIM daquela hora já passou (permite agendar na hora atual de hoje)
                  const slotEnd = new Date(day);
                  slotEnd.setHours(h + 1, 0, 0, 0);
                  const isPast = slotEnd.getTime() <= now.getTime();
                  const canSchedule = open && inHours && !isPast;

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
                  const accentColor =
                    booking.professional?.agenda_color ||
                    booking.pro_color ||
                    booking.service?.color ||
                    '#C9963B';

                  const isCompact = height < 62;
                  const isNarrow = widthPercent < 55;

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
                      title={`${format(new Date(booking.scheduled_at), 'HH:mm')} • ${booking.customer?.name ?? 'Cliente'} • ${booking.service?.name ?? 'Serviço'}${booking.professional?.name ? ` (${booking.professional.name})` : ''}`}
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
                              style={{ backgroundColor: statusCfg.color }}
                              title={statusCfg.label}
                            />
                          </div>
                          <p
                            className="text-[9.5px] font-semibold truncate opacity-85"
                            style={{ color: 'var(--theme-text-secondary)' }}
                          >
                            {booking.service?.name ?? 'Serviço'}
                            {!isNarrow && booking.professional?.name ? ` • ${booking.professional.name.split(' ')[0]}` : ''}
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
                                style={{ backgroundColor: statusCfg.color }}
                                title={statusCfg.label}
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
