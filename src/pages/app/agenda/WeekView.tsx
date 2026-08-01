import { useMemo, useRef, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { Clock, User } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

const HOUR_HEIGHT = 80;
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

interface Props {
  weekStart: Date;
  bookings: Booking[];
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

export default function WeekView({ weekStart, bookings, selectedProfessionalId, onBookingClick, onSlotClick }: Props) {
  const { theme } = useTheme();
  
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), i)),
    [weekStart]
  );

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

  const getPositionedBookingsForDay = (day: Date): PositionedBooking[] => {
    const dayBookings = filteredBookings
      .filter(b => isSameDay(new Date(b.scheduled_at), day))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    if (dayBookings.length === 0) return [];

    const items = dayBookings.map(b => {
      const start = new Date(b.scheduled_at);
      const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
      const top = (startMinutes / 60) * HOUR_HEIGHT;
      const height = Math.max((b.duration_minutes / 60) * HOUR_HEIGHT - 4, 32);
      return { booking: b, top, bottom: top + height, height };
    });

    const clusters: typeof items[] = [];
    let currentCluster: typeof items = [];
    let clusterMaxBottom = -1;

    items.forEach(item => {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterMaxBottom = item.bottom;
      } else if (item.top < clusterMaxBottom) {
        currentCluster.push(item);
        clusterMaxBottom = Math.max(clusterMaxBottom, item.bottom);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterMaxBottom = item.bottom;
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    const result: PositionedBooking[] = [];

    clusters.forEach(cluster => {
      const columns: typeof items[] = [];

      cluster.forEach(item => {
        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const lastInCol = columns[colIdx][columns[colIdx].length - 1];
          if (lastInCol.bottom <= item.top) {
            columns[colIdx].push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([item]);
        }
      });

      const totalCols = columns.length;
      columns.forEach((colItems, colIdx) => {
        colItems.forEach(item => {
          const widthPercent = 100 / totalCols;
          const leftPercent = colIdx * widthPercent;
          result.push({
            booking: item.booking,
            top: item.top,
            height: item.height,
            leftPercent,
            widthPercent: widthPercent - (totalCols > 1 ? 1 : 0),
          });
        });
      });
    });

    return result;
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: theme.bgInput }}>
      {/* Day headers */}
      <div className="flex border-b shrink-0 relative z-20 shadow-md" style={{ borderColor: theme.border, background: theme.bgCard }}>
        <div className="w-20 shrink-0 border-r flex items-center justify-center" style={{ borderColor: theme.border }}>
          <Clock className="w-4 h-4" style={{ color: theme.textSecondary }} />
        </div>
        {days.map((day) => {
          const today = isToday(day);
          const dayCount = filteredBookings.filter(b => isSameDay(new Date(b.scheduled_at), day)).length;

          return (
            <div 
              key={day.toISOString()} 
              className="flex-1 py-3 px-2 flex flex-col items-center border-r last:border-r-0 transition-colors"
              style={{ 
                borderColor: theme.border,
                background: today ? `${theme.accent}10` : 'transparent'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: today ? theme.accent : theme.textSecondary }}>
                  {format(day, 'EEEE', { locale: ptBR })}
                </span>
                {dayCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full text-white" style={{ background: theme.accent }}>
                    {dayCount}
                  </span>
                )}
              </div>

              <div 
                className="w-9 h-9 flex items-center justify-center rounded-2xl text-base font-serif font-bold transition-all"
                style={{
                  background: today ? theme.accentGradient : 'transparent',
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

      {/* Time grid container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
        <div className="flex min-h-full">
          
          {/* Left Hour labels column */}
          <div className="w-20 shrink-0 border-r sticky left-0 z-30 select-none" style={{ borderColor: theme.border, background: theme.bgInput }}>
            {HOURS.map(h => (
              <div 
                key={h} 
                className="relative border-b text-xs font-semibold flex items-start pt-2 pr-3 justify-end" 
                style={{ height: `${HOUR_HEIGHT}px`, borderColor: `${theme.border}80`, color: theme.textSecondary }}
              >
                <span>{String(h).padStart(2, '0')}:00</span>
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
                <div className="w-full h-[2px] bg-gradient-to-r from-red-500 via-red-500/80 to-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              </div>
            )}

            {/* Day columns */}
            {days.map(day => {
              const positionedBookings = getPositionedBookingsForDay(day);
              const today = isToday(day);

              return (
                <div 
                  key={day.toISOString()} 
                  className="flex-1 relative border-r last:border-r-0"
                  style={{ borderColor: `${theme.border}80`, background: today ? `${theme.accent}05` : 'transparent' }}
                >
                  {/* Hour grid cells */}
                  {HOURS.map(h => (
                    <div 
                      key={h} 
                      onClick={() => onSlotClick(day, h)}
                      className="border-b transition-colors cursor-pointer group relative hover:bg-[var(--theme-calendar-available-bg)]"
                      style={{ height: `${HOUR_HEIGHT}px`, borderColor: `${theme.border}80` }}
                    >
                      {/* Interactive Hover "+" */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="px-3 py-1 rounded-full text-xs font-bold shadow-lg transform scale-95 group-hover:scale-100 transition-transform" style={{ background: theme.accent, color: theme.btnPrimaryText }}>
                          + {String(h).padStart(2, '0')}:00
                        </span>
                      </div>

                      {/* Half-hour dashed divider */}
                      <div className="h-px border-b border-dashed mt-10 mx-2" style={{ borderColor: `${theme.border}50` }} />
                    </div>
                  ))}

                  {/* Red dot on Today's column only */}
                  {today && showNowLine && (
                    <div 
                      className="absolute left-2 z-50 pointer-events-none -mt-1.5" 
                      style={{ top: `${nowTop}px` }}
                    >
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2" style={{ borderColor: theme.bgInput }}></span>
                      </span>
                    </div>
                  )}

                  {/* Render Bookings */}
                  {positionedBookings.map(({ booking: b, top, height, leftPercent, widthPercent }) => {
                    const statusCfg = BOOKING_STATUS_CONFIG[b.status];
                    const accent = b.pro_color || theme.accent;
                    const start = new Date(b.scheduled_at);
                    const end = addMinutes(start, b.duration_minutes);
                    const isVeryShort = b.duration_minutes <= 25;

                    return (
                      <div
                        key={b.id}
                        onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                        className="absolute rounded-xl cursor-pointer shadow-md hover:shadow-2xl hover:z-50 hover:-translate-y-0.5 transition-all group overflow-hidden border"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPercent}% + 3px)`,
                          width: `calc(${widthPercent}% - 6px)`,
                          background: `linear-gradient(135deg, ${accent}30, ${accent}15)`,
                          borderColor: `${accent}50`,
                          borderLeft: `4px solid ${accent}`,
                        }}
                      >
                        <div className="p-2 h-full flex flex-col justify-between min-w-0">
                          {/* Top Row: Name & Status */}
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold truncate transition-colors leading-tight" style={{ color: theme.textPrimary }}>
                                {b.customer?.name ?? 'Cliente'}
                              </p>
                              
                              {!isVeryShort && widthPercent > 40 && (
                                <span 
                                  className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" 
                                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                                >
                                  {statusCfg.label}
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] truncate mt-0.5 font-medium" style={{ color: theme.textSecondary }}>
                              {b.service?.name}
                            </p>
                          </div>

                          {/* Bottom Row: Time, Professional & Price */}
                          {!isVeryShort && height >= 45 && (
                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t mt-auto min-w-0" style={{ borderColor: `${theme.textPrimary}20` }}>
                              <span className="font-semibold" style={{ color: theme.textPrimary }}>
                                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                              </span>

                              {widthPercent > 45 && (
                                <div className="flex items-center gap-1 min-w-0">
                                  <User className="w-3 h-3 shrink-0" style={{ color: theme.textSecondary }} />
                                  <span className="font-medium truncate max-w-[70px]" style={{ color: theme.textSecondary }}>
                                    {b.professional?.name?.split(' ')[0]}
                                  </span>
                                </div>
                              )}

                              <span className="font-bold shrink-0" style={{ color: accent }}>
                                {fmt.format(b.amount_total)}
                              </span>
                            </div>
                          )}
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
