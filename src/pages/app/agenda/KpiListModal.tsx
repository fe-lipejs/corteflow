import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  X,
  ArrowDownUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type { Booking } from '../../../hooks/useBookings';
import { useTheme } from '../../../contexts/ThemeContext';
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { BookingMetaIcons, WhatsAppSvgIcon } from './BookingMetaIcons';

interface KpiListModalProps {
  title: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  bookings: Booking[];
  isLoading?: boolean;
  onClose: () => void;
  onBookingClick: (booking: Booking) => void;
}

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
});

export default function KpiListModal({
  title,
  subtitle,
  icon: IconComponent,
  iconColor,
  bookings,
  isLoading = false,
  onClose,
  onBookingClick,
}: KpiListModalProps) {
  useLockBodyScroll(true);
  const { theme } = useTheme();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const timeA = new Date(a.scheduled_at).getTime();
      const timeB = new Date(b.scheduled_at).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [bookings, sortOrder]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden overscroll-contain animate-slide-up"
        style={{
          background: 'var(--theme-card-bg)',
          borderColor: 'var(--theme-border)',
          borderWidth: '1px',
        }}
      >
        {/* Header do Modal Padrão Apple */}
        <div
          className="flex items-center justify-between p-5 border-b shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${iconColor}18`,
                color: iconColor,
              }}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className="font-serif text-lg font-bold tracking-tight truncate"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  {title}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                  style={{
                    backgroundColor: `${iconColor}15`,
                    color: iconColor,
                  }}
                >
                  {bookings.length}
                </span>
              </div>
              <p className="text-xs truncate opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 cursor-pointer shrink-0"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Ordenação */}
        {bookings.length > 1 && (
          <div
            className="flex items-center justify-between px-5 py-2.5 border-b shrink-0 bg-[var(--theme-bg)]/50"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <span className="text-xs opacity-65" style={{ color: 'var(--theme-text-secondary)' }}>
              {sortedBookings.length} agendamentos listados
            </span>
            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              <ArrowDownUp className="w-3.5 h-3.5 opacity-60" />
              <span>{sortOrder === 'asc' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</span>
            </button>
          </div>
        )}

        {/* Lista com scroll limpo */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="w-6 h-6 animate-spin" style={{ color: iconColor }} />
            </div>
          ) : sortedBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${theme.accent}14`, color: theme.accent }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                Nenhum agendamento nesta categoria
              </p>
              <p className="text-xs mt-0.5 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                Os agendamentos aparecerão aqui conforme o status mudar.
              </p>
            </div>
          ) : (
            sortedBookings.map((b) => {
              const schedDate = new Date(b.scheduled_at);
              const confInfo = getBookingConfirmationInfo(b);
              const now = new Date();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              const isPast = schedDate.getTime() < now.getTime();
              const isPastDay = schedDate.getTime() < todayStart;
              const isPastTime = isPast && !isPastDay;
              const isOverdue = isPast && b.status !== 'completed' && b.status !== 'canceled';

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    onClose();
                    onBookingClick(b);
                  }}
                  className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer hover:bg-[var(--theme-bg-hover)] active:scale-[0.99] shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                  style={{
                    backgroundColor: isPastDay
                      ? 'rgba(239, 68, 68, 0.04)'
                      : isPastTime
                        ? 'rgba(239, 68, 68, 0.02)'
                        : 'var(--theme-bg)',
                    borderColor: isPastDay
                      ? 'rgba(239, 68, 68, 0.45)'
                      : isPastTime
                        ? 'rgba(239, 68, 68, 0.25)'
                        : confInfo.isPending
                          ? `color-mix(in srgb, ${theme.accent} 25%, transparent)`
                          : 'var(--theme-border)',
                  }}
                >
                  {/* Esquerda: Horário com Pontinho Redondo + Data */}
                  <div className="flex flex-col shrink-0 min-w-[62px] sm:min-w-[72px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-bold text-xs sm:text-sm tabular-nums leading-tight tracking-tight"
                        style={{ color: isOverdue ? '#EF4444' : 'var(--theme-text-primary)' }}
                      >
                        {format(schedDate, 'HH:mm')}
                      </span>

                      {/* Pontinho Redondo: Vermelho para atrasados, Accent apenas para pendentes */}
                      {isOverdue ? (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: '#EF4444' }}
                          title="Atrasado"
                        />
                      ) : confInfo.isPending ? (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: theme.accent }}
                          title="Pendente de confirmação"
                        />
                      ) : null}
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider leading-tight opacity-65 tabular-nums mt-0.5"
                      style={{ color: isOverdue ? '#EF4444' : 'var(--theme-text-secondary)' }}
                    >
                      {format(schedDate, 'dd MMM', { locale: ptBR })}
                    </span>
                  </div>

                  {/* Centro: Cliente e Serviço */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className="font-bold text-sm sm:text-[15px] truncate tracking-tight"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        {b.customer?.name ?? 'Cliente'}
                      </p>
                      <BookingMetaIcons
                        origin={confInfo.origin}
                        originLabel={confInfo.originLabel}
                        paymentType={confInfo.paymentType}
                        paymentLabel={confInfo.paymentLabel}
                      />
                    </div>
                    <p
                      className="text-xs truncate mt-0.5 opacity-75"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      <span>{b.service?.name ?? 'Serviço'}</span>
                      {b.professional?.name && (
                        <span> · com {b.professional.name.split(' ')[0]}</span>
                      )}
                      {isPast && confInfo.isPending ? (
                        <>
                          <span className="font-bold ml-1.5 text-[#EF4444]">· Atrasado</span>
                          <span className="font-semibold ml-1" style={{ color: theme.accent }}>· Aguarda confirmação</span>
                        </>
                      ) : isPast ? (
                        <span className="font-bold ml-1.5 text-[#EF4444]">
                          · {isPastDay ? 'Dia atrasado' : 'Horário atrasado'}
                        </span>
                      ) : confInfo.isPending ? (
                        <span className="font-semibold ml-1.5" style={{ color: theme.accent }}>
                          · Aguarda confirmação
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {/* Direita: Botão Circular Apple WhatsApp na cor do Accent + Preço */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {confInfo.whatsappUrl && (
                      <a
                        href={confInfo.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`WhatsApp: ${b.customer?.name ?? 'Cliente'}`}
                        className="w-8 h-8 rounded-full hover:opacity-85 active:scale-90 transition-transform flex items-center justify-center shrink-0 cursor-pointer"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                          color: theme.accent,
                        }}
                      >
                        <WhatsAppSvgIcon className="w-4 h-4" />
                      </a>
                    )}
                    <span
                      className="text-xs sm:text-sm font-bold tabular-nums text-right"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {fmt.format(b.amount_total || 0)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
