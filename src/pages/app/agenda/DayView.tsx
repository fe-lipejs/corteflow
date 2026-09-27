import { useMemo, useRef, useEffect } from 'react';
import { format, isToday, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { Clock, User, Scissors, Home, MapPin } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

const HOUR_HEIGHT = 96;
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
  const showNowLine = isToday(day) && now.getHours() >= START_HOUR && now.getHours() <= END_HOUR;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, nowTop - (containerHeight / 2)),
        behavior: 'smooth'
      });
    }
  }, [nowTop]);

  const sortedBookings = useMemo(() =>
    [...bookings].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [bookings]
  );

  const dayHours = businessHours.find((h: any) => h.weekday === day.getDay());
  const isClosed = dayHours && !dayHours.is_open;

  return (
    <div className="flex flex-col h-full min-h-0 w-full rounded-2xl border overflow-hidden shadow-sm" style={{ background: theme.bg, borderColor: theme.border }}>
      {/* ── Day Header ── */}
      <div className="shrink-0 px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: theme.border, background: theme.cardBg }}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 flex flex-col items-center justify-center rounded-2xl font-bold"
            style={{
              background: isToday(day) ? theme.accentGradient : theme.inputBg,
              color: isToday(day) ? theme.btnPrimaryText : theme.textPrimary,
              border: isToday(day) ? 'none' : `1px solid ${theme.border}`,
              boxShadow: isToday(day) ? theme.shadowAccent : 'none',
            }}
          >
            <span className="text-[10px] uppercase tracking-wider opacity-80">{format(day, 'EEE', { locale: ptBR })}</span>
            <span className="text-xl leading-none mt-0.5">{format(day, 'd')}</span>
          </div>

          <div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: theme.textPrimary }}>
              {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <p className="text-xs font-medium mt-1" style={{ color: theme.textSecondary }}>
              {isClosed ? 'Salão fechado neste dia' : `${bookings.length} agendamento${bookings.length !== 1 ? 's' : ''} registrado${bookings.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {bookings.length > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}>
            <Clock className="w-3.5 h-3.5" style={{ color: theme.accent }} />
            <span>{isToday(day) ? 'Hoje' : format(day, 'dd/MM')}</span>
          </div>
        )}
      </div>

      {/* ── Time Grid ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative scroll-smooth">
        <div className="flex min-h-full">
          {/* Left Hour labels */}
          <div className="w-16 shrink-0 border-r sticky left-0 z-30 select-none" style={{ borderColor: theme.border, background: theme.cardBg }}>
            {HOURS.map(h => (
              <div
                key={h}
                className="relative border-b text-xs font-semibold flex items-start pt-2.5 pr-3 justify-end"
                style={{ height: `${HOUR_HEIGHT}px`, borderColor: `${theme.border}30`, color: theme.textSecondary }}
              >
                <span className="text-[11px] font-mono tracking-tight font-medium opacity-70">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Slots & Bookings Area */}
          <div className="flex-1 relative">
            {/* Live Now Line */}
            {showNowLine && (
              <div className="absolute left-0 right-0 z-40 pointer-events-none flex items-center" style={{ top: `${nowTop}px` }}>
                <div className="w-full h-px" style={{ background: theme.accent }} />
                <div className="w-2 h-2 rounded-full -ml-1 shrink-0" style={{ background: theme.accent }} />
                <span className="absolute left-3 -top-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: theme.accent }}>
                  {format(now, 'HH:mm')}
                </span>
              </div>
            )}

            {/* Hour Rows */}
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
                  style={{ borderColor: `${theme.border}30`, height: `${HOUR_HEIGHT}px` }}
                >
                  {!isUnavailable && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none" style={{ background: `${theme.accent}0d` }}>
                      <span className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: theme.accent, color: theme.btnPrimaryText }}>
                        + Agendar às {h.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  )}

                  {/* Subtle 30-min divider */}
                  <div className="w-full h-px mt-auto mb-auto" style={{ background: `${theme.border}20` }} />
                </div>
              );
            })}

            {/* Render Day Bookings */}
            {sortedBookings.map(b => {
              const start = new Date(b.scheduled_at);
              const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
              const topOffset = (startMinutes / 60) * HOUR_HEIGHT;
              const duration = b.duration_minutes || 30;
              const height = Math.max((duration / 60) * HOUR_HEIGHT - 6, 60);
              const end = addMinutes(start, duration);
              const statusCfg = BOOKING_STATUS_CONFIG[b.status] || { label: 'Agendado', bg: `${theme.accent}15`, color: theme.accent };
              const accentColor = theme.accent;

              return (
                <div
                  key={b.id}
                  onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                  className="absolute left-3 right-3 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden border flex flex-col justify-between p-4 hover:-translate-y-0.5"
                  style={{
                    top: `${topOffset}px`,
                    height: `${height}px`,
                    background: theme.cardBg,
                    borderColor: `${theme.border}`,
                    boxShadow: `0 4px 15px -3px rgba(0,0,0,0.05)`,
                  }}
                >
                  {/* Premium left bar using the store's exact accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accentColor }} />
                  
                  {/* Subtle background glow */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ background: accentColor }} />

                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold truncate" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>
                        {b.customer?.name ?? 'Cliente'}
                      </p>

                      <p className="text-xs font-semibold mt-1 flex items-center gap-1.5 truncate" style={{ color: theme.textSecondary }}>
                        <Scissors className="w-3.5 h-3.5 shrink-0 opacity-80" style={{ color: accentColor }} />
                        <span className="truncate">{b.service?.name || 'Serviço'}</span>
                        {b.service_location === 'home' ? (
                          <Home className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide shadow-sm" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                      <span className="text-[14px] font-black tracking-tight" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>
                        {fmt.format(b.amount_total || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t mt-3 relative z-10" style={{ borderColor: `${theme.border}60` }}>
                    <span className="font-semibold flex items-center gap-1.5" style={{ color: theme.textSecondary }}>
                      <Clock className="w-3.5 h-3.5 opacity-70" />
                      {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                    </span>

                    {b.professional?.name && (
                      <span className="font-semibold flex items-center gap-1.5 truncate" style={{ color: theme.textSecondary }}>
                        <User className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="truncate">{b.professional.name}</span>
                      </span>
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
