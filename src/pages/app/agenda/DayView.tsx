import { useMemo, useRef, useEffect, useState } from 'react';
import { format, isToday } from 'date-fns';
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

interface DayViewProps {
  day: Date;
  bookings: Booking[];
  businessHours: BusinessHour[];
  selectedProfessionalId?: string | null;
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

const HOUR_HEIGHT = 88; // px per hour

export default function DayView({
  day,
  bookings,
  businessHours,
  selectedProfessionalId,
  onBookingClick,
  onSlotClick,
}: DayViewProps) {
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

  const weekday = day.getDay();
  const bh = effectiveHours.find((b) => b.weekday === weekday);

  const { startHour, endHour } = useMemo(() => {
    if (!bh || !bh.is_open) return { startHour: 7, endHour: 21 };
    const openH = parseInt(bh.open_time.split(':')[0], 10);
    const [ch, cm] = bh.close_time.split(':').map(Number);
    const closeH = cm > 0 ? ch + 1 : ch;
    return {
      startHour: Math.max(0, openH - 1),
      endHour: Math.min(23, closeH + 1),
    };
  }, [bh]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const now = new Date();
  const today = isToday(day);
  const currentMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
  const nowOffset = (currentMinutes / 60) * HOUR_HEIGHT;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, nowOffset - 200);
    }
  }, [nowOffset]);

  // Posicionamento em colunas lado a lado quando 2+ profissionais têm agendamento no mesmo horário
  const positionedBookings = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    const items = sorted.map((b) => {
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
  }, [bookings, startHour]);

  const lunchBand = useMemo(() => {
    if (!bh?.lunch_start || !bh?.lunch_end) return null;
    const [lsh, lsm] = bh.lunch_start.split(':').map(Number);
    const [leh, lem] = bh.lunch_end.split(':').map(Number);
    const startMins = (lsh - startHour) * 60 + lsm;
    const endMins = (leh - startHour) * 60 + lem;
    return {
      top: (startMins / 60) * HOUR_HEIGHT,
      height: ((endMins - startMins) / 60) * HOUR_HEIGHT,
    };
  }, [bh, startHour]);

  const isInBusinessHours = (hour: number) => {
    if (!bh || !bh.is_open) return false;
    const openH = parseInt(bh.open_time.split(':')[0], 10);
    const closeH = parseInt(bh.close_time.split(':')[0], 10);
    return hour >= openH && hour < closeH;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden select-none">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-3.5 border-b shrink-0"
        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-bold transition-all"
          style={{
            backgroundColor: today ? 'var(--theme-accent)' : 'var(--theme-card-bg)',
            color: today ? '#090A0B' : 'var(--theme-text-primary)',
            boxShadow: today ? '0 0 16px rgba(201,150,59,0.4)' : undefined,
          }}
        >
          <span className="text-[9px] uppercase tracking-wider font-black">
            {format(day, 'EEE', { locale: ptBR })}
          </span>
          <span className="text-base font-black leading-none">{format(day, 'd')}</span>
        </div>
        <div>
          <p className="font-bold text-sm capitalize" style={{ color: 'var(--theme-text-primary)' }}>
            {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            {bh && bh.is_open
              ? `Aberto das ${bh.open_time.slice(0, 5)} às ${bh.close_time.slice(0, 5)} · ${bookings.length} agendamento${bookings.length !== 1 ? 's' : ''}`
              : 'Estabelecimento fechado neste dia'}
          </p>
        </div>
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: '64px 1fr' }}>
          {/* Hour labels */}
          <div className="border-r" style={{ borderColor: 'var(--theme-border)' }}>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT, borderColor: 'rgba(255,255,255,0.03)' }}
                className="border-b pr-3 pt-2 text-right"
              >
                <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Main column */}
          <div className="relative">
            {hours.map((h) => {
              const inHours = isInBusinessHours(h);
              const slotEnd = new Date(day);
              slotEnd.setHours(h + 1, 0, 0, 0);
              const isPast = slotEnd.getTime() <= now.getTime();
              const canSchedule = inHours && !isPast;

              return (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT, borderColor: 'var(--theme-border)' }}
                  onClick={() => canSchedule && onSlotClick(day, h)}
                  className={`border-b relative transition-colors group ${
                    canSchedule
                      ? 'cursor-pointer hover:bg-[rgba(201,150,59,0.05)]'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  {/* 15-min lines */}
                  {[0.25, 0.5, 0.75].map((f, fi) => (
                    <div
                      key={fi}
                      style={{
                        top: `${f * 100}%`,
                        borderColor: f === 0.5 ? 'var(--theme-border)' : 'rgba(255,255,255,0.02)',
                      }}
                      className="absolute inset-x-0 border-b border-dashed pointer-events-none"
                    />
                  ))}
                  {canSchedule && (
                    <span
                      className="absolute top-1.5 right-3 text-xs font-bold opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none"
                      style={{ color: 'var(--theme-accent)' }}
                    >
                      + Agendar às {String(h).padStart(2, '0')}:00
                    </span>
                  )}
                </div>
              );
            })}

            {/* Lunch break */}
            {lunchBand && lunchBand.top >= 0 && (
              <div
                style={{ top: lunchBand.top, height: lunchBand.height }}
                className="absolute inset-x-0 pointer-events-none z-5 flex items-center justify-center"
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 6px, transparent 6px, transparent 12px)',
                    borderTop: '1px dashed rgba(255,255,255,0.1)',
                    borderBottom: '1px dashed rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg)' }}
                  >
                    Intervalo de Almoço
                  </span>
                </div>
              </div>
            )}

            {/* Current time line */}
            {today && nowOffset >= 0 && nowOffset <= hours.length * HOUR_HEIGHT && (
              <div
                style={{ top: nowOffset }}
                className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
              >
                <div className="w-3 h-3 rounded-full bg-rose-500 -ml-1.5 shrink-0 shadow-[0_0_8px_#f43f5e]" />
                <div className="flex-1 h-[2px] bg-rose-500" />
              </div>
            )}

            {/* Bookings */}
            {positionedBookings.map(({ booking, top, height, widthPercent, leftPercent }) => {
              const statusCfg = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.confirmed;
              const accentColor =
                booking.professional?.agenda_color ||
                booking.pro_color ||
                booking.service?.color ||
                '#C9963B';
              const isCompact = height < 58;

              return (
                <div
                  key={booking.id}
                  style={{
                    top: `${top + 1}px`,
                    height: `${height}px`,
                    left: `calc(${leftPercent}% + 8px)`,
                    width: `calc(${widthPercent}% - 16px)`,
                    borderLeftColor: accentColor,
                    backgroundColor: 'var(--theme-card-bg)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookingClick(booking);
                  }}
                  className={`absolute rounded-xl border-l-4 cursor-pointer z-10 overflow-hidden
                    hover:z-30 hover:scale-[1.005] transition-all shadow-lg flex items-center justify-between gap-3 ${
                      isCompact ? 'px-3 py-1.5' : 'px-4 py-2.5'
                    }`}
                >
                  <div
                    className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{ backgroundColor: `${accentColor}15` }}
                  />
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-black" style={{ color: accentColor }}>
                        {format(new Date(booking.scheduled_at), 'HH:mm')}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                      {booking.professional?.name && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
                        >
                          {booking.professional.name}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>
                      {booking.customer?.name ?? 'Cliente'}{' '}
                      <span className="font-normal text-xs opacity-75">
                        — {booking.service?.name ?? 'Serviço'}
                      </span>
                    </p>
                  </div>
                  <div className="relative z-10 text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: accentColor }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        booking.amount_total || 0
                      )}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--theme-text-secondary)' }}>
                      {booking.duration_minutes || booking.service?.duration_minutes || 30}min
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
