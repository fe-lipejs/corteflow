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
  
  const days = Array.from({ length: 15 }, (_, i) => addDays(startOfDay(currentDay), i - 7));
  const activeDayRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDayRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeDayRef.current;
      
      // Calculate position to center the active element
      const containerWidth = container.clientWidth;
      const elementOffset = element.offsetLeft;
      const elementWidth = element.clientWidth;
      
      const scrollPosition = elementOffset - (containerWidth / 2) + (elementWidth / 2);
      
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, [currentDay]);

  const dayBookings = bookings.filter(b => isSameDay(new Date(b.scheduled_at), currentDay));
  const sorted = [...dayBookings].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="flex flex-col h-full pb-20 bg-transparent">
      {/* Header Strip */}
      <div className="shrink-0 pt-5 pb-3 relative z-10 glass-card mx-3 mt-3 rounded-3xl mb-5 border" style={{ borderColor: 'transparent', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
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
            <h2 className="font-serif text-[18px] font-bold capitalize tracking-tight" style={{ color: theme.textPrimary }}>
              {format(currentDay, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70" style={{ color: theme.textSecondary }}>
                {format(currentDay, 'EEEE', { locale: ptBR })}
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
        <div ref={containerRef} className="flex items-center gap-3 overflow-x-auto px-4 pb-6 scrollbar-none snap-x snap-mandatory relative pt-2">
          {days.map(day => {
            const selected = isSameDay(day, currentDay);
            const today = isToday(day);
            const hasBookings = bookings.some(b => isSameDay(new Date(b.scheduled_at), day));
            
            return (
              <button
                key={day.toISOString()}
                ref={selected ? activeDayRef : null}
                onClick={() => onDayChange(day)}
                className={`snap-center shrink-0 flex flex-col items-center justify-center w-[64px] h-[86px] rounded-[20px] transition-all relative ${
                  selected ? 'scale-105 z-10' : 'hover:-translate-y-1'
                }`}
                style={{
                  background: selected ? theme.accentGradient : '#ffffff',
                  boxShadow: selected 
                    ? `0 12px 24px -6px ${theme.accent}60, 0 4px 12px -4px ${theme.accent}40` 
                    : '0 4px 15px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)',
                }}
              >
                <span 
                  className="text-[10px] font-bold uppercase mb-1 tracking-wide" 
                  style={{ color: selected ? theme.btnPrimaryText : '#8B949E' }}
                >
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span 
                  className="text-[28px] font-extrabold leading-none tracking-tight mb-1"
                  style={{ color: selected ? theme.btnPrimaryText : '#0F172A' }}
                >
                  {format(day, 'dd')}
                </span>
                <span 
                  className="text-[10px] font-bold uppercase tracking-wide" 
                  style={{ color: selected ? theme.btnPrimaryText : '#8B949E' }}
                >
                  {format(day, 'MMM', { locale: ptBR })}
                </span>
                
                {/* Dot indicator for existing bookings */}
                {hasBookings && (
                  <div 
                    className="absolute bottom-2 w-1.5 h-1.5 rounded-full" 
                    style={{ background: selected ? '#1a1a1a' : theme.accent }} 
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timeline (Cards) */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-20 px-6">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 glass-card" style={{ borderColor: 'transparent' }}>
              <Clock className="w-9 h-9 opacity-30" style={{ color: theme.textSecondary }} />
            </div>
            <p className="font-serif text-2xl font-bold mb-2 tracking-tight" style={{ color: theme.textPrimary }}>Dia livre</p>
            <p className="text-sm max-w-[220px] leading-relaxed opacity-80" style={{ color: theme.textSecondary }}>
              Nenhum agendamento marcado para esta data.
            </p>
            <button 
              onClick={onNewBooking}
              className="mt-7 px-7 py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
            >
              Criar agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs uppercase tracking-widest font-semibold opacity-70" style={{ color: theme.textSecondary }}>
                {sorted.length} {sorted.length === 1 ? 'agendamento' : 'agendamentos'}
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
                  className="rounded-3xl p-5 active:scale-[0.98] transition-transform glass-card cursor-pointer"
                  style={{ borderColor: 'transparent' }}
                >
                  {/* Top: Time & Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                        <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>{format(start, 'HH:mm')}</span>
                      </div>
                      <span className="text-xs font-medium opacity-60" style={{ color: theme.textSecondary }}>até {format(end, 'HH:mm')}</span>
                    </div>
                    
                    <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Center: Service & Customer */}
                  <div className="mb-5">
                    <h3 className="font-serif text-xl font-bold mb-1 tracking-tight" style={{ color: theme.textPrimary }}>{b.customer?.name ?? 'Cliente'}</h3>
                    <p className="text-sm font-medium opacity-75" style={{ color: theme.textSecondary }}>{b.service?.name}</p>
                  </div>

                  {/* Bottom: Professional & Price */}
                  <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: `${theme.border}60` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                        <User className="w-3.5 h-3.5" style={{ color: theme.textSecondary }} />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{b.professional?.name ?? 'Sem profissional'}</span>
                    </div>
                    
                    <span className="text-base font-bold" style={{ color: theme.textPrimary }}>{fmt.format(b.amount_total)}</span>
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
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-30 active:scale-95 transition-transform"
        style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
