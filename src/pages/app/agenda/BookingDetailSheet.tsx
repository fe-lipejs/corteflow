import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { X, User, Scissors, Clock, CreditCard, MessageSquare, ChevronDown, Loader2 } from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking, type BookingStatus } from '../../../hooks/useBookings';

interface Props {
  booking: Booking;
  onClose: () => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  isUpdating?: boolean;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const STATUS_FLOW: BookingStatus[] = ['pending', 'confirmed', 'arrived', 'in_progress', 'completed'];

export default function BookingDetailSheet({ booking, onClose, onStatusChange, isUpdating }: Props) {
  const statusCfg = BOOKING_STATUS_CONFIG[booking.status];
  const scheduledAt = new Date(booking.scheduled_at);
  const endTime = new Date(scheduledAt.getTime() + (booking.duration_minutes * 60 * 1000));

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(booking.status) + 1];
  const isFinished = booking.status === 'completed' || booking.status === 'canceled' || booking.status === 'no_show';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — slides up from bottom on mobile, right panel on desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:right-0 md:left-auto md:bottom-0 z-50 flex flex-col w-full md:w-[420px]"
        style={{ background: '#1C1A17', borderTop: '1px solid #3A3530', borderLeft: '1px solid #3A3530', borderRadius: '24px 24px 0 0' }}>

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1 rounded-full bg-[#3A3530]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3530]">
          <div>
            <p className="text-[10px] font-bold text-[#A09888] uppercase tracking-wider">Agendamento</p>
            <h3 className="font-serif text-xl font-bold text-white">{booking.customer?.name ?? 'Cliente'}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-[#A09888] hover:text-white hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style={{ background: statusCfg.bg, color: statusCfg.color }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusCfg.color }} />
              {statusCfg.label}
            </span>
            <p className="text-xs text-[#A09888]">#{booking.order_number}</p>
          </div>

          {/* Info cards */}
          <div className="space-y-3">
            {[
              {
                icon: Clock,
                label: 'Horário',
                value: `${format(scheduledAt, 'HH:mm')} – ${format(endTime, 'HH:mm')}`,
                sub: format(scheduledAt, "EEEE, dd 'de' MMMM", { locale: ptBR }),
              },
              {
                icon: Scissors,
                label: 'Serviço',
                value: booking.service?.name ?? '—',
                sub: `${booking.duration_minutes} min ${booking.buffer_minutes > 0 ? `+ ${booking.buffer_minutes} min buffer` : ''}`,
              },
              {
                icon: User,
                label: 'Profissional',
                value: booking.professional?.name ?? 'Não atribuído',
                sub: null,
                color: booking.pro_color,
              },
              {
                icon: CreditCard,
                label: 'Valor',
                value: fmt.format(booking.amount_total),
                sub: `Pago: ${fmt.format(booking.amount_paid)}`,
              },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-4 p-4 rounded-2xl bg-[#252118] border border-[#3A3530]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color ? `${item.color}20` : '#3A3530' }}>
                  <item.icon className="w-4 h-4" style={{ color: item.color ?? '#A09888' }} />
                </div>
                <div>
                  <p className="text-xs text-[#A09888]">{item.label}</p>
                  <p className="text-sm font-bold text-white">{item.value}</p>
                  {item.sub && <p className="text-xs text-[#A09888]">{item.sub}</p>}
                </div>
              </div>
            ))}

            {/* Notes */}
            {booking.notes && (
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#252118] border border-[#3A3530]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#3A3530] shrink-0">
                  <MessageSquare className="w-4 h-4 text-[#A09888]" />
                </div>
                <div>
                  <p className="text-xs text-[#A09888]">Observações</p>
                  <p className="text-sm text-white">{booking.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Status actions */}
          {!isFinished && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#A09888] uppercase tracking-wider">Ações</p>
              {nextStatus && (
                <button
                  onClick={() => onStatusChange(booking.id, nextStatus)}
                  disabled={isUpdating}
                  className="w-full py-3 rounded-xl font-bold text-sm text-[#1A1714] flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)]"
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)' }}
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  → {BOOKING_STATUS_CONFIG[nextStatus].label}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onStatusChange(booking.id, 'no_show')}
                  disabled={isUpdating}
                  className="py-2.5 rounded-xl text-sm font-semibold border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all"
                >
                  Não compareceu
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'canceled')}
                  disabled={isUpdating}
                  className="py-2.5 rounded-xl text-sm font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Contact */}
          {booking.customer?.phone && (
            <a
              href={`https://wa.me/${booking.customer.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#3A3530] text-[#A09888] hover:text-white hover:border-[#3A3530]/80 text-sm font-semibold transition-all"
            >
              📱 Contatar via WhatsApp
            </a>
          )}
        </div>
      </div>
    </>
  );
}
