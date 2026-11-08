import { useEffect, useRef, useState } from 'react';
import { format, addDays, startOfDay, isSameDay, isToday, addMinutes, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Check,
  Loader2,
} from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';
import { isDateWithinBookingHorizon, sanitizeHexColor } from '../../../lib/bookingHorizon';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { BookingMetaIcons, WhatsAppSvgIcon } from './BookingMetaIcons';

interface Props {
  currentDay: Date;
  bookings: Booking[];
  maxAdvanceDays?: number | null;
  canConfirm?: boolean;
  onDayChange: (d: Date) => void;
  onBookingClick: (b: Booking) => void;
  onConfirmBooking?: (bookingId: string, booking?: Booking) => void | Promise<void>;
  onNewBooking: (preferredDate?: Date) => void;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function MobileTimeline({
  currentDay,
  bookings,
  maxAdvanceDays,
  canConfirm = false,
  onDayChange,
  onBookingClick,
  onConfirmBooking,
  onNewBooking,
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
        className="shrink-0 pt-5 pb-3 relative z-10 glass-card mx-3 mt-3 rounded-3xl mb-5 border"
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
            <label
              className="relative font-serif text-[18px] font-bold capitalize tracking-tight cursor-pointer px-2 py-0.5 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: theme.textPrimary }}
              title="Toque para ir a uma data específica"
            >
              {format(currentDay, 'MMMM yyyy', { locale: ptBR })}
              <input
                type="date"
                value={format(currentDay, 'yyyy-MM-dd')}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [yy, mm, dd] = e.target.value.split('-').map(Number);
                  onDayChange(new Date(yy, mm - 1, dd));
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
            <div className="flex items-center gap-2 mt-1">
              <p
                className="text-[10px] uppercase tracking-widest font-semibold opacity-70"
                style={{ color: theme.textSecondary }}
              >
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
        <div
          ref={containerRef}
          className="flex items-center gap-3 overflow-x-auto px-4 pb-6 scrollbar-none snap-x snap-mandatory relative pt-2"
        >
          {days.map((day) => {
            const selected = isSameDay(day, currentDay);
            const hasBookings = bookings.some((b) => isSameDay(new Date(b.scheduled_at), day));

            return (
              <button
                key={day.toISOString()}
                ref={selected ? activeDayRef : null}
                onClick={() => onDayChange(day)}
                className={`snap-center shrink-0 flex flex-col items-center justify-center w-[64px] h-[96px] rounded-[20px] transition-all relative ${
                  selected ? 'scale-105 z-10' : 'hover:-translate-y-1'
                }`}
                style={{
                  background: selected ? theme.accentGradient : theme.cardBg,
                  border: `1px solid ${selected ? 'transparent' : theme.border}`,
                  boxShadow: 'none',
                }}
              >
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

                {/* Dot indicator for existing bookings */}
                {hasBookings && (
                  <div
                    className="absolute bottom-2 w-1.5 h-1.5 rounded-full"
                    style={{ background: selected ? theme.btnPrimaryText : theme.accent }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timeline (Cards) */}
      <div className="px-3 space-y-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 glass-card"
              style={{ borderColor: theme.border }}
            >
              <Clock className="w-9 h-9 opacity-30" style={{ color: theme.textSecondary }} />
            </div>
            <p className="font-serif text-2xl font-bold mb-2 tracking-tight" style={{ color: theme.textPrimary }}>
              Dia livre
            </p>
            <p className="text-sm max-w-[240px] leading-relaxed opacity-80" style={{ color: theme.textSecondary }}>
              {canScheduleOnCurrentDay
                ? 'Nenhum agendamento marcado para esta data.'
                : isPastDay
                  ? 'Nenhum agendamento registrado nesta data passada.'
                  : 'Esta data está além da antecedência máxima configurada para novos agendamentos.'}
            </p>
            {canScheduleOnCurrentDay && (
              <button
                onClick={() => onNewBooking(currentDay)}
                className="mt-7 px-7 py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Criar agendamento
              </button>
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
              const accent = sanitizeHexColor(
                b.professional?.agenda_color || b.pro_color || b.service?.color,
                theme.accent
              );
              const start = new Date(b.scheduled_at);
              const durationMins = Number(b.duration_minutes) || Number(b.service?.duration_minutes) || 30;
              const end = addMinutes(start, durationMins);
              const isConfirmingThis = confirmingId === b.id;

              const badgeStyle =
                confInfo.confirmationState === 'overdue'
                  ? { bg: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', label: 'Atrasado' }
                  : confInfo.confirmationState === 'pending'
                    ? { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706', label: 'Aguarda confirmação' }
                    : { bg: statusCfg.bg, color: statusCfg.color, label: statusCfg.label };

              return (
                <div
                  key={b.id}
                  onClick={() => onBookingClick(b)}
                  className="rounded-3xl p-5 active:scale-[0.98] transition-transform glass-card cursor-pointer border"
                  style={{ borderColor: theme.border }}
                >
                  {/* Top: Time & Confirmation / Status */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                        <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                          {format(start, 'HH:mm')}
                        </span>
                      </div>
                      <span className="text-xs font-medium opacity-60" style={{ color: theme.textSecondary }}>
                        até {format(end, 'HH:mm')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold"
                        style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                      >
                        {badgeStyle.label}
                      </span>
                    </div>
                  </div>

                  {/* Center: Customer & Service + WhatsApp button */}
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className="font-serif text-xl font-bold mb-0.5 tracking-tight truncate"
                        style={{ color: theme.textPrimary }}
                      >
                        {b.customer?.name ?? 'Cliente'}
                      </h3>
                      <p className="text-sm font-medium opacity-75 truncate" style={{ color: theme.textSecondary }}>
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
                          borderColor: theme.border,
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
