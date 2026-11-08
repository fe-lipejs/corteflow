import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  X,
  User,
  Scissors,
  Clock,
  CreditCard,
  MessageSquare,
  Phone,
  Mail,
  Loader2,
  CalendarClock,
  MapPin,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking, type BookingStatus } from '../../../hooks/useBookings';
import { sanitizeHexColor } from '../../../lib/bookingHorizon';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';
import { useAuth } from '../../../contexts/AuthContext';
import { getBookingConfirmationInfo } from '../../../lib/bookingConfirmation';
import { BookingMetaIcons, WhatsAppSvgIcon } from './BookingMetaIcons';
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll';

interface Props {
  booking: Booking;
  canConfirm?: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  onConfirmBooking?: (id: string, booking?: Booking) => void | Promise<void>;
  onDelete?: (id: string) => void;
  onEdit?: (booking: Booking) => void;
  isUpdating?: boolean;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const SEGMENT_STYLES: Record<string, { bg: string; color: string }> = {
  vip: { bg: 'rgba(201,150,59,0.15)', color: '#c9963b' },
  fiel: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  novo: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  inativo: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

export default function BookingDetailSheet({
  booking,
  canConfirm = true,
  onClose,
  onStatusChange,
  onConfirmBooking,
  onDelete,
  onEdit,
  isUpdating,
}: Props) {
  useLockBodyScroll(true);

  const { profile } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const statusCfg = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.confirmed;
  const confInfo = getBookingConfirmationInfo(booking);

  const scheduledAt = new Date(booking.scheduled_at);
  const durationMins = booking.duration_minutes || booking.service?.duration_minutes || 30;
  const endTime = new Date(scheduledAt.getTime() + durationMins * 60 * 1000);

  const isFinished =
    booking.status === 'completed' || booking.status === 'canceled' || booking.status === 'no_show';

  const { data: allPastBookings, isLoading: loadingHistory } = useQuery({
    queryKey: ['customer_history_bookings', booking.customer_id],
    queryFn: async () => {
      if (!booking.customer_id) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, scheduled_at, amount_total, amount_paid, status, payment_mode, payment_status, services(id, name), professionals(id, name, photo_url)'
        )
        .eq('customer_id', booking.customer_id)
        .neq('id', booking.id)
        .not('status', 'in', '("canceled","no_show","pending")')
        .order('scheduled_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!booking.customer_id,
  });

  const customerHistory = useMemo(() => {
    if (!allPastBookings) return null;

    const completedOrPaidBookings = allPastBookings.filter(
      (b: any) =>
        b.status === 'completed' || (b.status === 'confirmed' && Number(b.amount_paid || 0) > 0)
    );

    const totalSpent = completedOrPaidBookings.reduce(
      (sum: number, b: any) =>
        sum +
        (b.status === 'completed' ? Number(b.amount_total || 0) : Number(b.amount_paid || 0)),
      0
    );
    const visitCount = completedOrPaidBookings.length;

    const lastVisit =
      completedOrPaidBookings.length > 0
        ? new Date(completedOrPaidBookings[0].scheduled_at)
        : null;

    const serviceCounts: Record<string, number> = {};
    allPastBookings.forEach((b: any) => {
      const svcName = b.services?.name;
      if (svcName) serviceCounts[svcName] = (serviceCounts[svcName] || 0) + 1;
    });
    const frequentServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const recentList = allPastBookings.slice(0, 3);

    return { totalSpent, visitCount, lastVisit, frequentServices, recentList };
  }, [allPastBookings]);

  const handleConfirmBookingClick = async () => {
    if (!canConfirm || isConfirming) return;
    setIsConfirming(true);
    try {
      if (onConfirmBooking) {
        await onConfirmBooking(booking.id, booking);
      } else {
        onStatusChange(booking.id, 'confirmed');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const confirmationBadge =
    confInfo.confirmationState === 'overdue'
      ? {
          bg: 'rgba(239, 68, 68, 0.14)',
          color: '#ef4444',
          label: 'Confirmação atrasada',
        }
      : confInfo.confirmationState === 'pending'
        ? {
            bg: 'rgba(245, 158, 11, 0.15)',
            color: '#d97706',
            label: 'Aguarda confirmação',
          }
        : {
            bg: 'rgba(74, 222, 128, 0.15)',
            color: '#22c55e',
            label: 'Confirmado',
          };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-x-0 top-16 bottom-0 md:inset-0 z-[90] bg-black/55 backdrop-blur-[2px] touch-none"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 top-[5.5rem] bottom-0 md:top-0 md:right-0 md:left-auto md:bottom-0 z-[100] flex flex-col w-full md:w-[480px] rounded-t-[28px] md:rounded-none shadow-2xl overflow-hidden overscroll-contain"
        style={{
          background: 'var(--theme-bg)',
          borderTop: '1px solid var(--theme-border)',
          borderLeft: '1px solid var(--theme-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div
            className="w-12 h-1.5 rounded-full opacity-45"
            style={{ background: 'var(--theme-text-secondary)' }}
          />
        </div>

        {/* Header (Customer Info) */}
        <div
          className="flex items-start justify-between px-6 py-4 sm:py-5 border-b shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="min-w-0 pr-3 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <p
                className="text-[10px] font-bold uppercase tracking-wider opacity-60"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Agendamento #{booking.order_number}
              </p>

              <BookingMetaIcons
                origin={confInfo.origin}
                originLabel={confInfo.originLabel}
                paymentType={confInfo.paymentType}
                paymentLabel={confInfo.paymentLabel}
              />

              {booking.customer?.segment && (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background:
                      (SEGMENT_STYLES[booking.customer.segment] ?? SEGMENT_STYLES.novo).bg,
                    color: (SEGMENT_STYLES[booking.customer.segment] ?? SEGMENT_STYLES.novo).color,
                  }}
                >
                  {booking.customer.segment}
                </span>
              )}
            </div>

            {booking.created_at && (
              <p
                className="text-[11px] font-medium mb-1.5"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Realizado em:{' '}
                <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                  {format(new Date(booking.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </p>
            )}

            {/* Client Name + Clean WhatsApp Icon + Pending Confirm Icon */}
            <div className="flex items-center gap-2.5 mb-2">
              <h3
                className="font-serif text-2xl font-bold truncate"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                {booking.customer?.name ?? 'Cliente'}
              </h3>

              {confInfo.whatsappUrl && (
                <a
                  href={confInfo.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Conversar no WhatsApp"
                  className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-card-bg)',
                    color: '#25D366',
                  }}
                >
                  <WhatsAppSvgIcon className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {booking.customer?.phone && (
                confInfo.whatsappUrl ? (
                  <a
                    href={confInfo.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Conversar no WhatsApp"
                    className="inline-flex items-center gap-2 text-xs hover:underline w-fit"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <Phone className="w-3.5 h-3.5 opacity-70" />
                    <span>{confInfo.formattedPhone || booking.customer.phone}</span>
                  </a>
                ) : (
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <Phone className="w-3.5 h-3.5 opacity-70" />{' '}
                    {confInfo.formattedPhone || booking.customer.phone}
                  </div>
                )
              )}
              {booking.customer?.email && (
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  <Mail className="w-3.5 h-3.5 opacity-70" /> {booking.customer.email}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-6 space-y-7">
          {/* Confirmation & Operational Status badges */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Confirmation Status Badge */}
              <span
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
                style={{ background: confirmationBadge.bg, color: confirmationBadge.color }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: confirmationBadge.color }}
                />
                {confirmationBadge.label}
              </span>

              {/* Operational Status Badge (when different from basic confirmed/pending) */}
              {booking.status !== 'confirmed' && booking.status !== 'pending' && (
                <span
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
                  {statusCfg.label}
                </span>
              )}
            </div>

            {booking.payment_mode &&
              booking.payment_mode !== 'local' &&
              Number(booking.amount_paid || 0) > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  {booking.payment_mode === 'deposit'
                    ? `Sinal Online Pago (${fmt.format(booking.amount_paid)})`
                    : `100% Pago Online (${fmt.format(booking.amount_paid)})`}
                </span>
              )}
          </div>

          {/* Direct Confirm Action Callout when pending */}
          {!isFinished && confInfo.isPending && canConfirm && (
            <div
              className="p-4 rounded-2xl border flex items-center justify-between gap-3"
              style={{
                borderColor:
                  confInfo.confirmationState === 'overdue'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : 'var(--theme-border)',
                backgroundColor: 'var(--theme-card-bg)',
              }}
            >
              <p
                className="text-xs font-semibold"
                style={{
                  color:
                    confInfo.confirmationState === 'overdue'
                      ? '#ef4444'
                      : 'var(--theme-text-primary)',
                }}
              >
                {confInfo.confirmationState === 'overdue'
                  ? 'Confirmação atrasada'
                  : 'Aguardando confirmação'}
              </p>
              <button
                type="button"
                onClick={handleConfirmBookingClick}
                disabled={isUpdating || isConfirming}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                style={{
                  background: 'var(--theme-accent-gradient)',
                  color: 'var(--theme-btn-primary-text)',
                }}
              >
                {isConfirming || isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Confirmar</span>
              </button>
            </div>
          )}

          {/* Info cards (Booking context) */}
          <div className="space-y-2.5">
            <p
              className="text-xs font-bold uppercase tracking-wider opacity-60"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              Detalhes da reserva
            </p>
            {[
              {
                icon: Clock,
                label: 'Horário',
                value: `${format(scheduledAt, 'HH:mm')} – ${format(endTime, 'HH:mm')}`,
                sub: format(scheduledAt, "EEEE, dd 'de' MMMM", { locale: ptBR }),
                photo: null,
                color: null,
              },
              {
                icon: Scissors,
                label: 'Serviço',
                value: booking.service?.name ?? '—',
                sub: `${durationMins} min ${booking.buffer_minutes > 0 ? `+ ${booking.buffer_minutes} min buffer` : ''}`,
                photo: null,
                color: null,
              },
              {
                icon: User,
                label: 'Profissional',
                value: booking.professional?.name ?? 'Não atribuído',
                sub: `Origem: ${confInfo.originLabel}`,
                photo: booking.professional?.photo_url ?? null,
                color:
                  booking.professional?.agenda_color || booking.pro_color
                    ? sanitizeHexColor(
                        booking.professional?.agenda_color || booking.pro_color,
                        '#C9963B'
                      )
                    : null,
              },
              {
                icon: CreditCard,
                label: 'Valor e Forma de Pagamento',
                value: `${fmt.format(booking.amount_total)} · ${confInfo.paymentLabel}`,
                sub: (() => {
                  const mode = (booking.payment_mode as string) || 'local';
                  if (booking.status === 'completed') {
                    return `Pagamento concluído integralmente (${fmt.format(booking.amount_total)})`;
                  }
                  if (mode === 'local' || mode === 'pay_local') {
                    return `Pagamento no local (${confInfo.paymentLabel}): ${fmt.format(booking.amount_total)}`;
                  }
                  if (mode === 'deposit' || mode === 'partial') {
                    const remaining = Math.max(
                      0,
                      Number(booking.amount_total) - Number(booking.amount_paid)
                    );
                    return `Sinal pago via ${confInfo.paymentType === 'pix' ? 'PIX' : 'Cartão'}: ${fmt.format(booking.amount_paid)} • Restante no local: ${fmt.format(remaining)}`;
                  }
                  return `Pago integral online (${confInfo.paymentLabel}): ${fmt.format(booking.amount_paid || booking.amount_total)}`;
                })(),
                photo: null,
                color: null,
              },
              ...(booking.service_location === 'home'
                ? [
                    {
                      icon: MapPin,
                      label: 'Endereço (domicílio)',
                      value: booking.client_address ?? 'Não informado',
                      sub: booking.travel_fee
                        ? `Taxa de deslocamento: ${fmt.format(booking.travel_fee)}`
                        : 'Sem taxa de deslocamento',
                      photo: null,
                      color: '#facc15',
                    },
                  ]
                : []),
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-2xl border"
                style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
              >
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.value}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: item.color ? `${item.color}20` : 'var(--theme-bg-hover)',
                    }}
                  >
                    <item.icon
                      className="w-4.5 h-4.5"
                      style={{ color: item.color ?? 'var(--theme-text-secondary)' }}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p
                    className="text-[11px] uppercase tracking-wider mb-1 opacity-60"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {item.label}
                  </p>
                  <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    {item.value}
                  </p>
                  {item.sub && (
                    <p
                      className="text-xs mt-1 opacity-75"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      {item.sub}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Notes */}
            {booking.notes && (
              <div
                className="flex items-start gap-4 p-4 rounded-2xl border"
                style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--theme-bg-hover)' }}
                >
                  <MessageSquare
                    className="w-4.5 h-4.5"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[11px] uppercase tracking-wider mb-1 opacity-60"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    Observações
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    {booking.notes}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Customer CRM History */}
          <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 opacity-70" style={{ color: 'var(--theme-accent)' }} />
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--theme-accent)' }}
              >
                Histórico do cliente
              </p>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className="w-5 h-5 animate-spin"
                  style={{ color: 'var(--theme-text-secondary)' }}
                />
              </div>
            ) : customerHistory ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    className="p-4 rounded-2xl border"
                    style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Total gasto (anteriores)
                    </p>
                    <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                      {fmt.format(customerHistory.totalSpent)}
                    </p>
                  </div>
                  <div
                    className="p-4 rounded-2xl border"
                    style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Visitas anteriores
                    </p>
                    <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                      {customerHistory.visitCount} {customerHistory.visitCount === 1 ? 'vez' : 'vezes'}
                    </p>
                  </div>
                  <div
                    className="col-span-2 p-4 rounded-2xl border"
                    style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Última visita
                    </p>
                    <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                      {customerHistory.lastVisit
                        ? format(customerHistory.lastVisit, "EEEE, dd 'de' MMMM 'de' yyyy", {
                            locale: ptBR,
                          })
                        : 'Primeiro atendimento'}
                    </p>
                  </div>

                  {customerHistory.frequentServices.length > 0 && (
                    <div
                      className="col-span-2 p-4 rounded-2xl border"
                      style={{
                        background: 'var(--theme-card-bg)',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      <p
                        className="text-[10px] uppercase tracking-wider mb-3 opacity-60"
                        style={{ color: 'var(--theme-text-secondary)' }}
                      >
                        Serviços frequentes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {customerHistory.frequentServices.map((srv: string) => (
                          <span
                            key={srv}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{
                              background: 'var(--theme-bg-hover)',
                              color: 'var(--theme-text-secondary)',
                            }}
                          >
                            {srv}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {profile?.role !== 'professional' && (
                  <div className="pt-2">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider mb-3 opacity-60"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Últimos atendimentos
                    </p>
                    {customerHistory.recentList.length > 0 ? (
                      <div className="space-y-2">
                        {customerHistory.recentList.map((pb: any) => (
                          <div
                            key={pb.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border"
                            style={{
                              background: 'var(--theme-card-bg)',
                              borderColor: 'var(--theme-border)',
                            }}
                          >
                            <div className="min-w-0">
                              <p
                                className="text-sm font-bold truncate"
                                style={{ color: 'var(--theme-text-primary)' }}
                              >
                                {pb.services?.name}
                              </p>
                              <p
                                className="text-[11px] mt-0.5 opacity-75"
                                style={{ color: 'var(--theme-text-secondary)' }}
                              >
                                com {pb.professionals?.name || 'Profissional'}
                              </p>
                            </div>
                            <span
                              className="text-xs font-mono font-medium px-2 py-1 rounded-md shrink-0"
                              style={{
                                background: 'var(--theme-bg-hover)',
                                color: 'var(--theme-text-secondary)',
                              }}
                            >
                              {format(new Date(pb.scheduled_at), 'dd/MM/yy')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="text-center py-5 rounded-xl border border-dashed"
                        style={{
                          borderColor: 'var(--theme-border)',
                          background: 'var(--theme-bg-hover)',
                        }}
                      >
                        <p
                          className="text-xs opacity-75"
                          style={{ color: 'var(--theme-text-secondary)' }}
                        >
                          Este é o primeiro agendamento deste cliente.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Action: Reagendar / Editar */}
          {!isFinished && onEdit && (
            <div className="pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <button
                type="button"
                onClick={() => onEdit(booking)}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <CalendarClock className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                Reagendar / Alterar Serviço ou Profissional
              </button>
            </div>
          )}

          {/* Status actions */}
          {!isFinished ? (
            <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <p
                className="text-xs font-bold uppercase tracking-wider opacity-60"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Mudar status
              </p>

              {confInfo.isPending && canConfirm && (
                <button
                  type="button"
                  onClick={handleConfirmBookingClick}
                  disabled={isUpdating || isConfirming}
                  className="w-full py-3 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isConfirming || isUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirmar agendamento
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onStatusChange(booking.id, 'in_progress')}
                  disabled={isUpdating || booking.status === 'in_progress'}
                  className="py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      booking.status === 'in_progress' ? 'var(--theme-accent)' : 'transparent',
                    borderColor: 'var(--theme-accent)',
                    color: booking.status === 'in_progress' ? '#000' : 'var(--theme-accent)',
                  }}
                >
                  Em atendimento
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'completed')}
                  disabled={isUpdating}
                  className="py-3 rounded-xl text-xs font-bold transition-opacity text-white hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: '#10b981' }}
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Finalizado
                </button>
              </div>

              {/* Cancelamentos */}
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => onStatusChange(booking.id, 'no_show')}
                  disabled={isUpdating}
                  className="text-xs font-bold text-orange-500/80 hover:text-orange-500 transition-colors py-1 cursor-pointer"
                >
                  Não compareceu
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'canceled')}
                  disabled={isUpdating}
                  className="text-xs font-bold text-red-500/80 hover:text-red-500 transition-colors py-1 cursor-pointer"
                >
                  Cancelar reserva
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              {onDelete &&
                (confirmDelete ? (
                  <div className="space-y-3">
                    <p
                      className="text-xs text-center font-medium opacity-80"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      Tem certeza? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        disabled={isUpdating}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors"
                        style={{
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text-primary)',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          onDelete(booking.id);
                          setConfirmDelete(false);
                        }}
                        disabled={isUpdating}
                        className="flex-1 py-3 rounded-xl text-sm font-bold border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        Confirmar exclusão
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={isUpdating}
                    className="w-full py-3.5 rounded-xl text-sm font-bold border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Excluir definitivamente
                  </button>
                ))}
            </div>
          )}

          {/* Contact Actions */}
          <div className="pt-6 pb-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            {confInfo.whatsappUrl ? (
              <a
                href={confInfo.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-xl border text-sm font-bold transition-colors"
                style={{
                  background: 'var(--theme-card-bg)',
                  borderColor: '#25D366',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <WhatsAppSvgIcon className="w-4.5 h-4.5 text-[#25D366]" />
                Conversar no WhatsApp
              </a>
            ) : (
              <button
                disabled
                className="w-full py-4 rounded-xl border text-sm font-semibold cursor-not-allowed opacity-50"
                style={{
                  borderColor: 'var(--theme-border)',
                  background: 'var(--theme-bg-hover)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                Telefone não cadastrado ou sem DDD válido
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
