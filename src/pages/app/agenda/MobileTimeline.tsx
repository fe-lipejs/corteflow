import { useEffect, useRef } from 'react';
import { format, addDays, startOfDay, isSameDay, isToday, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Plus, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
  currentDay: Date;
  bookings: Booking[];
  onDayChange: (d: Date) => void;
  onBookingClick: (b: Booking) => void;
  onNewBooking: () => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function MobileTimeline({ currentDay, bookings, onDayChange, onBookingClick, onNewBooking }: Props) {
  const { theme } = useTheme();
  
  // 15 days window (7 before, 7 after) for smooth scrolling
  const days = Array.from({ length: 15 }, (_, i) => addDays(startOfDay(new Date()), i - 7));
  const activeDayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeDayRef.current) {
      activeDayRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentDay]);

  const dayBookings = bookings.filter(b => isSameDay(new Date(b.scheduled_at), currentDay));
  const sorted = [...dayBookings].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="flex flex-col h-full pb-20" style={{ background: theme.bgInput }}>
      {/* Premium Header Strip */}
      <div className="border-b shrink-0 pt-4 pb-2 shadow-sm relative z-10" style={{ background: theme.cardBg, borderColor: theme.border }}>
        {/* Month/Year and Nav */}
        <div className="flex items-center justify-between px-4 mb-4">
          <button onClick={() => onDayChange(addDays(currentDay, -1))} className="p-2 -ml-2 rounded-full transition-colors hover:bg-[var(--theme-bg-hover)]" style={{ color: theme.textSecondary }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="font-bold text-lg font-serif capitalize" style={{ color: theme.textPrimary }}>
              {format(currentDay, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
              {isToday(currentDay) ? 'Hoje' : format(currentDay, 'EEEE', { locale: ptBR })}
            </p>
          </div>

          <button onClick={() => onDayChange(addDays(currentDay, 1))} className="p-2 -mr-2 rounded-full transition-colors hover:bg-[var(--theme-bg-hover)]" style={{ color: theme.textSecondary }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Day Strip */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 scrollbar-none snap-x snap-mandatory">
          {days.map(day => {
            const selected = isSameDay(day, currentDay);
            const today = isToday(day);
            const hasBookings = bookings.some(b => isSameDay(new Date(b.scheduled_at), day));
            
            return (
              <button
                key={day.toISOString()}
                ref={selected ? activeDayRef : null}
                onClick={() => onDayChange(day)}
                className={`snap-center shrink-0 flex flex-col items-center w-[54px] py-2.5 rounded-2xl transition-all border ${
                  selected 
                    ? 'shadow-lg' 
                    : today 
                      ? 'border-transparent'
                      : 'border-transparent hover:bg-[var(--theme-bg-hover)]'
                }`}
                style={
                  selected ? { background: theme.accentGradient, color: theme.btnPrimaryText, borderColor: theme.accent, boxShadow: theme.shadowAccent }
                  : today ? { background: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }
                  : { color: theme.textSecondary }
                }
              >
                <span className={`text-[10px] font-bold uppercase mb-1 ${selected ? 'opacity-80' : ''}`}>
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-lg font-bold leading-none">
                  {format(day, 'd')}
                </span>
                
                {/* Dot indicator for existing bookings */}
                <div className="h-1 flex items-center justify-center mt-1.5 w-full">
                  {hasBookings && (
                    <div className="w-1 h-1 rounded-full" style={{ background: selected ? theme.btnPrimaryText : theme.accent }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timeline (Cards) */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-20 h-20 rounded-full border flex items-center justify-center mb-4 opacity-50" style={{ background: theme.cardBg, borderColor: theme.border }}>
              <Clock className="w-8 h-8" style={{ color: theme.textSecondary }} />
            </div>
            <p className="font-serif text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>Dia Livre</p>
            <p className="text-sm max-w-[200px]" style={{ color: theme.textSecondary }}>
              Nenhum agendamento marcado para esta data.
            </p>
            <button 
              onClick={onNewBooking}
              className="mt-6 px-6 py-2.5 rounded-full border font-bold text-sm transition-colors"
              style={{ borderColor: theme.accent, color: theme.accent, background: 'transparent' }}
            >
              Criar Agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                {sorted.length} {sorted.length === 1 ? 'Agendamento' : 'Agendamentos'}
              </span>
            </div>

            {sorted.map((b) => {
              const statusCfg = BOOKING_STATUS_CONFIG[b.status];
              const accent = b.pro_color || theme.accent;
              const start = new Date(b.scheduled_at);
              const end = addMinutes(start, b.duration_minutes);

              return (
                <div 
                  key={b.id} 
                  onClick={() => onBookingClick(b)}
                  className="rounded-2xl p-4 shadow-lg border active:scale-[0.98] transition-transform overflow-hidden relative glass-card"
                  style={{ background: theme.cardBg, borderColor: theme.border }}
                >
                  {/* Left Accent Bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: accent }} />
                  
                  {/* Top: Time & Status */}
                  <div className="flex items-center justify-between mb-3 ml-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md border" style={{ background: theme.inputBg, borderColor: theme.border }}>
                        <Clock className="w-3.5 h-3.5" style={{ color: accent }} />
                        <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>{format(start, 'HH:mm')}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: theme.textSecondary }}>até {format(end, 'HH:mm')}</span>
                    </div>
                    
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ background: statusCfg.bg, color: statusCfg.color, borderColor: statusCfg.color + '30' }}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Center: Service & Customer */}
                  <div className="ml-2 mb-4">
                    <h3 className="font-serif text-lg font-bold mb-0.5 leading-tight" style={{ color: theme.textPrimary }}>{b.customer?.name ?? 'Cliente'}</h3>
                    <p className="text-sm font-medium" style={{ color: theme.textSecondary }}>{b.service?.name}</p>
                  </div>

                  {/* Bottom: Professional & Price */}
                  <div className="ml-2 pt-3 border-t flex items-center justify-between" style={{ borderColor: theme.border }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center border" style={{ background: theme.inputBg, borderColor: theme.border }}>
                        <User className="w-3 h-3" style={{ color: theme.textSecondary }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>{b.professional?.name ?? 'Sem profissional'}</span>
                    </div>
                    
                    <span className="text-sm font-bold" style={{ color: accent }}>{fmt.format(b.amount_total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={onNewBooking}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-95 transition-transform"
        style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

