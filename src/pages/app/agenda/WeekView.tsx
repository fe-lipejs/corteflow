import { useMemo, useRef, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { Clock, User, Scissors, DollarSign } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

const HOUR_HEIGHT = 88;
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

interface Props {
  weekStart: Date;
  bookings: Booking[];
  businessHours: any[];
  selectedProfessionalId?: string | null;
  onBookingClick: (b: Booking) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

interface PositionedBooking {
  booking: Booking;
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
}

export default function WeekView({ weekStart, bookings, businessHours, selectedProfessionalId, onBookingClick, onSlotClick }: Props) {
  const { theme } = useTheme();
  
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), i)),
    [weekStart]
  );

  const { START_HOUR, END_HOUR, HOURS } = useMemo(() => {
    let minH = 24;
    let maxH = 0;
    let hasOpen = false;

    // 1. Verificamos os horários de funcionamento
    if (businessHours && businessHours.length > 0) {
      for (const h of businessHours) {
        if (h.is_open && h.open_time && h.close_time) {
          hasOpen = true;
          const openH = parseInt(h.open_time.split(':')[0], 10);
          const closeH = parseInt(h.close_time.split(':')[0], 10);
          if (openH < minH) minH = openH;
          if (closeH > maxH) maxH = closeH;
        }
      }
    }

    // 2. Verificamos se há algum agendamento fora do horário de funcionamento
    if (bookings && bookings.length > 0) {
      for (const b of bookings) {
        if (b.status !== 'canceled') {
          hasOpen = true;
          const start = new Date(b.scheduled_at);
          const end = new Date(start.getTime() + (b.duration_minutes + (b.buffer_minutes || 0)) * 60000);
          const startH = start.getHours();
          const endH = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
          if (startH < minH) minH = startH;
          if (endH > maxH) maxH = endH;
        }
      }
    }

    if (!hasOpen) return { START_HOUR: 7, END_HOUR: 21, HOURS: Array.from({ length: 15 }, (_, i) => 7 + i) };

    const start = Math.max(0, minH - 1);
    const end = Math.min(23, maxH + 1);
    return {
      START_HOUR: start,
      END_HOUR: end,
      HOURS: Array.from({ length: end - start + 1 }, (_, i) => start + i)
    };
  }, [businessHours, bookings]);

  const now = new Date();
  const nowTop = ((now.getHours() - START_HOUR) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
  const showNowLine = now.getHours() >= START_HOUR && now.getHours() <= END_HOUR;

  const nowLineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const filteredBookings = useMemo(() => {
    if (!selectedProfessionalId) return bookings;
    return bookings.filter(b => b.professional_id === selectedProfessionalId);
  }, [bookings, selectedProfessionalId]);

  // ─── Algoritmo Preciso de Colisão de Horários ──────────────────────────────
  const getPositionedBookingsForDay = (day: Date): PositionedBooking[] => {
    const dayBookings = filteredBookings
      .filter(b => isSameDay(new Date(b.scheduled_at), day))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    if (dayBookings.length === 0) return [];

    const items = dayBookings.map(b => {
      const start = new Date(b.scheduled_at);
      const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
      const top = (startMinutes / 60) * HOUR_HEIGHT;
      const duration = b.duration_minutes || 30;
      const height = Math.max((duration / 60) * HOUR_HEIGHT - 4, 52);
      const bottom = top + height;
      return { booking: b, top, bottom, height };
    });

    const result: PositionedBooking[] = [];

    items.forEach((item) => {
      // Procura outros agendamentos que realmente se sobrepõem no tempo
      const overlapping = items.filter(other =>
        other.top < item.bottom && item.top < other.bottom
      );

      if (overlapping.length <= 1) {
        // Agendamento único no horário: ocupa 100% da largura da coluna!
        result.push({
          booking: item.booking,
          top: item.top,
          height: item.height,
          leftPercent: 0,
          widthPercent: 100,
        });
      } else {
        // Há colisão de horários entre múltiplos profissionais: divide a coluna
        const colIdx = overlapping.indexOf(item);
        const totalCols = overlapping.length;
        const widthPercent = 100 / totalCols;
        result.push({
          booking: item.booking,
          top: item.top,
          height: item.height,
          leftPercent: colIdx * widthPercent,
          widthPercent: widthPercent - 1,
        });
      }
    });

    return result;
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full rounded-2xl border overflow-hidden shadow-2xl" style={{ background: theme.bg, borderColor: theme.border }}>
      {/* ── Day Headers ── */}
      <div className="flex border-b shrink-0 relative z-20" style={{ borderColor: theme.border, background: theme.cardBg }}>
        {/* Time column header */}
        <div className="w-20 shrink-0 border-r flex flex-col items-center justify-center py-3" style={{ borderColor: theme.border }}>
          <Clock className="w-4 h-4 opacity-50" style={{ color: theme.textSecondary }} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-50" style={{ color: theme.textSecondary }}>Hora</span>
        </div>

        {/* Day columns headers */}
        {days.map((day) => {
          const today = isToday(day);
          const dayBookings = filteredBookings.filter(b => isSameDay(new Date(b.scheduled_at), day));
          const dayCount = dayBookings.length;
          const dayHours = businessHours.find((h: any) => h.weekday === day.getDay());
          const isClosed = dayHours && !dayHours.is_open;

          return (
            <div 
              key={day.toISOString()} 
              className="flex-1 py-3.5 px-2 flex flex-col items-center justify-center border-r last:border-r-0 transition-all relative"
              style={{ 
                borderColor: theme.border,
                background: today ? `${theme.accent}12` : 'transparent',
                opacity: isClosed ? 0.45 : 1
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: today ? theme.accent : theme.textSecondary }}>
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                {dayCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full" style={{ background: theme.accent, color: theme.btnPrimaryText }}>
                    {dayCount}
                  </span>
                )}
              </div>

              <div 
                className="w-10 h-10 flex items-center justify-center rounded-2xl text-base font-bold transition-all shadow-sm"
                style={{
                  background: today ? theme.accentGradient : theme.inputBg,
                  color: today ? theme.btnPrimaryText : theme.textPrimary,
                  border: today ? 'none' : `1px solid ${theme.border}`,
                  boxShadow: today ? theme.shadowAccent : 'none'
                }}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Time Grid Container ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
        <div className="flex min-h-full">
          
          {/* Left Hour labels column */}
          <div className="w-20 shrink-0 border-r sticky left-0 z-30 select-none" style={{ borderColor: theme.border, background: theme.cardBg }}>
            {HOURS.map(h => (
              <div 
                key={h} 
                className="relative border-b text-xs font-semibold flex items-start pt-2 pr-3 justify-end" 
                style={{ height: `${HOUR_HEIGHT}px`, borderColor: `${theme.border}40`, color: theme.textSecondary }}
              >
                <span className="text-[11px] font-mono tracking-tight font-medium opacity-80">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day Columns Container */}
          <div className="flex-1 flex relative">
            
            {/* Global Horizontal Now Line */}
            {showNowLine && (
              <div 
                ref={nowLineRef}
                className="absolute left-0 right-0 z-40 pointer-events-none flex items-center" 
                style={{ top: `${nowTop}px` }}
              >
                <div className="w-full h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
                <span className="absolute left-2 -top-3 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-500 text-white shadow">
                  Agora {format(now, 'HH:mm')}
                </span>
              </div>
            )}

            {/* Day columns */}
            {days.map(day => {
              const positionedBookings = getPositionedBookingsForDay(day);
              const today = isToday(day);
              const dayHours = businessHours.find((h: any) => h.weekday === day.getDay());
              const isClosed = dayHours && !dayHours.is_open;

              return (
                <div 
                  key={day.toISOString()} 
                  className="flex-1 relative border-r last:border-r-0 transition-colors"
                  style={{
                    borderColor: `${theme.border}40`,
                    background: isClosed ? 'rgba(0,0,0,0.18)' : (today ? `${theme.accent}05` : 'transparent')
                  }}
                >
                  {/* Hour grid cells */}
                  {HOURS.map(h => {
                    const slotTime = new Date(day);
                    slotTime.setHours(h, 0, 0, 0);
                    const isPast = slotTime.getTime() < now.getTime();
                    const isUnavailable = isClosed || isPast;

                    return (
                      <div 
                        key={h} 
                        onClick={() => { if (!isUnavailable) onSlotClick(day, h); }}
                        className={`border-b transition-colors group relative flex flex-col justify-between ${!isUnavailable ? 'cursor-pointer hover:bg-white/5' : ''}`}
                        style={{ borderColor: `${theme.border}40`, height: `${HOUR_HEIGHT}px` }}
                      >
                        {/* Hover Quick Action Indicator */}
                        {!isUnavailable && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-[2px]" style={{ background: `${theme.accent}15` }}>
                            <span className="text-[11px] font-bold px-3 py-1 rounded-full shadow-lg" style={{ background: theme.accent, color: theme.btnPrimaryText }}>
                              + Agendar {h.toString().padStart(2, '0')}:00
                            </span>
                          </div>
                        )}

                        {/* Subtle 30-min divider line */}
                        <div className="w-full h-px mt-auto mb-auto" style={{ background: `${theme.border}25` }} />
                      </div>
                    );
                  })}

                  {/* Render Bookings (Ultra-Readable Cards) */}
                  {positionedBookings.map(({ booking: b, top, height, leftPercent, widthPercent }) => {
                    const statusCfg = BOOKING_STATUS_CONFIG[b.status] || { label: 'Agendado', bg: 'rgba(201,150,59,0.15)', color: theme.accent };
                    const proAccent = b.professional?.agenda_color || b.service?.color || theme.accent;
                    const start = new Date(b.scheduled_at);
                    const duration = b.duration_minutes || 30;
                    const end = addMinutes(start, duration);
                    const cardHeight = Math.max(height, 68);

                    return (
                      <div
                        key={b.id}
                        onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                        className="absolute rounded-xl cursor-pointer shadow-md hover:shadow-2xl hover:z-50 hover:scale-[1.02] transition-all group overflow-hidden border flex flex-col"
                        style={{
                          top: `${top}px`,
                          height: `${cardHeight}px`,
                          left: `calc(${leftPercent}% + 3px)`,
                          width: `calc(${widthPercent}% - 6px)`,
                          background: theme.cardBg,
                          borderColor: `${proAccent}50`,
                          borderLeft: `5px solid ${proAccent}`,
                          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                        }}
                      >
                        <div className="p-2 h-full flex flex-col justify-between min-w-0">
                          {/* Top Header: Customer Name & Status Badge */}
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <p className="text-[11px] font-extrabold truncate leading-tight" style={{ color: theme.textPrimary }}>
                                {b.customer?.name ?? 'Cliente'}
                              </p>
                              
                              <span 
                                className="shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider border leading-none" 
                                style={{
                                  background: `${statusCfg.color}20`,
                                  borderColor: `${statusCfg.color}40`,
                                  color: statusCfg.color
                                }}
                              >
                                {statusCfg.label}
                              </span>
                            </div>

                            {/* Service Title */}
                            <p className="text-[11px] font-bold truncate flex items-center gap-1 leading-tight" style={{ color: proAccent }}>
                              <Scissors className="w-3 h-3 shrink-0 opacity-85" />
                              <span className="truncate">{b.service?.name || 'Serviço'}</span>
                            </p>
                          </div>

                          {/* Bottom Row: Time & Price */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t mt-auto min-w-0" style={{ borderColor: theme.border }}>
                            <span className="font-semibold flex items-center gap-1" style={{ color: theme.textSecondary }}>
                              <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                              {format(start, 'HH:mm')}
                            </span>

                            <span className="font-bold shrink-0 text-[11px]" style={{ color: theme.textPrimary }}>
                              {fmt.format(b.amount_total || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
