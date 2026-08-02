import { useMemo, useRef, useEffect } from 'react';
import { format, isToday, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';

const HOUR_HEIGHT = 72;
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

interface Props {
  day: Date;
  bookings: Booking[];
  businessHours: any[];
  onBookingClick: (b: Booking) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export default function DayView({ day, bookings, businessHours, onBookingClick, onSlotClick }: Props) {
  const { theme } = useTheme();

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

    const start = Math.max(0, minH - 1); // 1 hora de margem antes
    const end = Math.min(23, maxH + 1);  // 1 hora de margem depois
    return {
      START_HOUR: start,
      END_HOUR: end,
      HOURS: Array.from({ length: end - start + 1 }, (_, i) => start + i)
    };
  }, [businessHours, bookings]);
  
  const now = new Date();
  const nowTop = ((now.getHours() - START_HOUR) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
  const showNowLine = isToday(day) && now.getHours() >= START_HOUR && now.getHours() <= END_HOUR;

  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const sortedBookings = useMemo(() =>
    [...bookings].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [bookings]
  );

  const getBookingStyle = (b: Booking) => {
    const start = new Date(b.scheduled_at);
    const topOffset = ((start.getHours() - START_HOUR) * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
    const height = Math.max(b.duration_minutes / 60 * HOUR_HEIGHT - 3, 36);
    return { top: `${topOffset}px`, height: `${height}px` };
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: theme.bgInput }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b text-center" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>{format(day, 'EEEE', { locale: ptBR })}</p>
        <p className="text-2xl font-bold font-serif" style={{ color: theme.textPrimary }}>{format(day, 'd')}</p>
        <p className="text-xs" style={{ color: theme.textSecondary }}>{format(day, 'MMMM yyyy', { locale: ptBR })}</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs" style={{ color: theme.textSecondary }}>
          <span className="font-semibold" style={{ color: theme.textPrimary }}>{bookings.length}</span> agendamento{bookings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth">
        <div className="flex">
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r sticky left-0 z-10" style={{ borderColor: theme.border, background: theme.bgInput }}>
            {HOURS.map(h => (
              <div key={h} className="border-b text-[10px] flex items-start pt-1 justify-center" style={{ height: `${HOUR_HEIGHT}px`, borderColor: theme.border, color: theme.textSecondary }}>
                {h}:00
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="flex-1 relative">
            {HOURS.map(h => {
              const slotTime = new Date(day);
              slotTime.setHours(h, 0, 0, 0);
              const isPast = slotTime.getTime() < now.getTime();
              
              return (
                <div 
                  key={h} 
                  onClick={() => { if (!isPast) onSlotClick(day, h); }}
                  className={`border-b transition-colors relative group ${!isPast ? 'cursor-pointer hover:bg-[var(--theme-calendar-available-bg)]' : ''}`}
                  style={{ height: `${HOUR_HEIGHT}px`, borderColor: `${theme.border}80` }}
                >
                  <div className="h-px mt-9 mx-3" style={{ background: `${theme.border}80` }} />
                  
                  {/* Hover Add Button */}
                  {!isPast && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10 pointer-events-none">
                      <span className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg" style={{ background: theme.accent }}>
                        + {h.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Now line */}
            {showNowLine && (
              <div ref={nowRef} className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTop}px` }}>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 -ml-1.5 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                  <div className="flex-1 h-px bg-red-400/70" />
                </div>
                <p className="absolute right-2 -top-3.5 text-[10px] text-red-400 font-bold">{format(now, 'HH:mm')}</p>
              </div>
            )}

            {/* Booking blocks */}
            {sortedBookings.map(b => {
              const style = getBookingStyle(b);
              const statusCfg = BOOKING_STATUS_CONFIG[b.status];
              const accent = b.pro_color || theme.accent;
              const start = new Date(b.scheduled_at);
              const end = addMinutes(start, b.duration_minutes);

              return (
                <div key={b.id}
                  onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                  className="absolute left-2 right-2 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:z-30 hover:-translate-y-0.5 transition-all"
                  style={{
                    ...style,
                    background: `linear-gradient(135deg, ${accent}25, ${accent}10)`,
                    border: `1px solid ${accent}50`,
                    borderLeft: `4px solid ${accent}`,
                  }}
                >
                  <div className="px-3 py-2 h-full flex flex-col min-w-0">
                    {/* Time */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold" style={{ color: accent }}>{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: `${accent}30`, color: accent }}>
                        {(b.customer?.name ?? 'C').substring(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-bold truncate" style={{ color: theme.textPrimary }}>{b.customer?.name ?? 'Cliente'}</p>
                    </div>

                    {/* Service */}
                    <p className="text-xs truncate mt-0.5 ml-8" style={{ color: theme.textSecondary }}>{b.service?.name}</p>

                    {/* Bottom row */}
                    {Number(style.height.replace('px', '')) > 60 && (
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <p className="text-xs" style={{ color: theme.textSecondary }}>{b.professional?.name ?? 'Profissional'}</p>
                        <p className="text-xs font-bold" style={{ color: accent }}>{fmt.format(b.amount_total)}</p>
                      </div>
                    )}
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
