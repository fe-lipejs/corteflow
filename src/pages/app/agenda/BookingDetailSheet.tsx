import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { X, User, Scissors, Clock, CreditCard, MessageSquare, Phone, Mail, Loader2, CalendarClock, MapPin, AlertTriangle } from 'lucide-react';
import { BOOKING_STATUS_CONFIG, type Booking, type BookingStatus } from '../../../hooks/useBookings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';

interface Props {
  booking: Booking;
  onClose: () => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  onDelete?: (id: string) => void;
  isUpdating?: boolean;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const STATUS_FLOW: BookingStatus[] = ['pending', 'confirmed', 'arrived', 'in_progress', 'completed'];

const SEGMENT_STYLES: Record<string, { bg: string; color: string }> = {
  vip: { bg: 'rgba(201,150,59,0.15)', color: '#c9963b' },
  fiel: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  novo: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  inativo: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

import { useAuth } from '../../../contexts/AuthContext';

export default function BookingDetailSheet({ booking, onClose, onStatusChange, onDelete, isUpdating }: Props) {
  const { profile } = useAuth();
  // BUG-04: Inline confirm state — evita window.confirm nativo que quebra no iOS
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusCfg = BOOKING_STATUS_CONFIG[booking.status];
  const scheduledAt = new Date(booking.scheduled_at);
  const endTime = new Date(scheduledAt.getTime() + (booking.duration_minutes * 60 * 1000));

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(booking.status) + 1];
  const isFinished = booking.status === 'completed' || booking.status === 'canceled' || booking.status === 'no_show';


  // Fix #4: Fetch ALL completed bookings for this customer to calculate real history
  const { data: allPastBookings, isLoading: loadingHistory } = useQuery({
    queryKey: ['customer_history_bookings', booking.customer_id],
    queryFn: async () => {
      if (!booking.customer_id) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('id, scheduled_at, amount_total, status, services(id, name), professionals(id, name, photo_url)')
        .eq('customer_id', booking.customer_id)
        .neq('id', booking.id) // exclude current booking
        .not('status', 'in', '("canceled","no_show")')
        .order('scheduled_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!booking.customer_id
  });

  // Fix #4: Compute real history metrics from actual bookings
  const customerHistory = useMemo(() => {
    if (!allPastBookings) return null;

    const completedBookings = allPastBookings.filter((b: any) => b.status === 'completed');
    
    const totalSpent = completedBookings.reduce((sum: number, b: any) => sum + (b.amount_total || 0), 0);
    const visitCount = completedBookings.length;
    
    const lastVisit = completedBookings.length > 0
      ? new Date(completedBookings[0].scheduled_at)
      : null;

    // Count service frequency
    const serviceCounts: Record<string, number> = {};
    allPastBookings.forEach((b: any) => {
      const svcName = b.services?.name;
      if (svcName) serviceCounts[svcName] = (serviceCounts[svcName] || 0) + 1;
    });
    const frequentServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Last 3 past bookings for the list
    const recentList = allPastBookings.slice(0, 3);

    return { totalSpent, visitCount, lastVisit, frequentServices, recentList };
  }, [allPastBookings]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-[var(--theme-bg-overlay)] backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — slides up from bottom on mobile, right panel on desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:right-0 md:left-auto md:bottom-0 z-50 flex flex-col w-full md:w-[480px] h-[92vh] md:h-full"
        style={{ background: 'var(--theme-bg)', borderTop: '1px solid var(--theme-border)', borderLeft: '1px solid var(--theme-border)', borderRadius: '28px 28px 0 0' }}>

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-12 h-1 rounded-full" style={{ background: 'var(--theme-border)' }} />
        </div>

        {/* Header (Customer Info) */}
        <div className="flex items-start justify-between px-6 py-6 border-b shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
               <p className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Agendamento #{booking.order_number}</p>
               {booking.customer?.segment && (
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: (SEGMENT_STYLES[booking.customer.segment] ?? SEGMENT_STYLES.novo).bg,
                      color: (SEGMENT_STYLES[booking.customer.segment] ?? SEGMENT_STYLES.novo).color,
                    }}
                  >
                    {booking.customer.segment}
                  </span>
               )}
            </div>
            <h3 className="font-serif text-2xl font-bold mb-3 truncate" style={{ color: 'var(--theme-text-primary)' }}>{booking.customer?.name ?? 'Cliente'}</h3>
            
            {/* Contatos Reais */}
            <div className="flex flex-col gap-1.5">
              {booking.customer?.phone && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                  <Phone className="w-3.5 h-3.5 opacity-70" /> {booking.customer.phone}
                </div>
              )}
              {booking.customer?.email && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                  <Mail className="w-3.5 h-3.5 opacity-70" /> {booking.customer.email}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: 'var(--theme-text-secondary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-7">

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style={{ background: statusCfg.bg, color: statusCfg.color }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
              {statusCfg.label}
            </span>
          </div>

          {/* Info cards (Booking context) */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Detalhes da reserva</p>
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
                sub: `${booking.duration_minutes} min ${booking.buffer_minutes > 0 ? `+ ${booking.buffer_minutes} min buffer` : ''}`,
                photo: null,
                color: null,
              },
              {
                icon: User,
                label: 'Profissional',
                value: booking.professional?.name ?? 'Não atribuído',
                sub: null,
                // Fix #4: Use the professional's photo_url from the joined data
                photo: booking.professional?.photo_url ?? null,
                color: booking.pro_color,
              },
              {
                icon: CreditCard,
                label: 'Valor',
                value: fmt.format(booking.amount_total),
                sub: `Pago: ${fmt.format(booking.amount_paid)} (${(booking.payment_mode as string) === 'local' || (booking.payment_mode as string) === 'pay_local' ? 'No local' : (booking.payment_mode as string) === 'full' || (booking.payment_mode as string) === 'full_100' ? 'Integral' : 'Sinal'})`,
                photo: null,
                color: null,
              },
              ...(booking.service_location === 'home' ? [{
                icon: MapPin,
                label: 'Endereço (domicílio)',
                value: booking.client_address ?? 'Não informado',
                sub: booking.travel_fee ? `Taxa de deslocamento: ${fmt.format(booking.travel_fee)}` : 'Sem taxa de deslocamento',
                photo: null,
                color: '#facc15',
              }] : []),
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                {/* Fix #4: Show professional photo if available, else colored icon */}
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.value}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color ? `${item.color}20` : 'var(--theme-bg-hover)' }}>
                    <item.icon className="w-4.5 h-4.5" style={{ color: item.color ?? 'var(--theme-text-secondary)' }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider mb-1 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>{item.label}</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>{item.value}</p>
                  {item.sub && <p className="text-xs mt-1 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>{item.sub}</p>}
                </div>
              </div>
            ))}

            {/* Notes */}
            {booking.notes && (
              <div className="flex items-start gap-4 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--theme-bg-hover)' }}>
                  <MessageSquare className="w-4.5 h-4.5" style={{ color: 'var(--theme-text-secondary)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider mb-1 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Observações</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-primary)' }}>{booking.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Customer CRM History — Fix #4: computed from real bookings */}
          <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
             <div className="flex items-center gap-2">
               <CalendarClock className="w-4 h-4 opacity-70" style={{ color: 'var(--theme-accent)' }} />
               <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-accent)' }}>Histórico do cliente</p>
             </div>
             
             {loadingHistory ? (
               <div className="flex items-center justify-center py-8">
                 <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />
               </div>
             ) : customerHistory ? (
               <>
                 <div className="grid grid-cols-2 gap-2.5">
                   <div className="p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Total gasto</p>
                     <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>{fmt.format(customerHistory.totalSpent)}</p>
                   </div>
                   <div className="p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Visitas concluídas</p>
                     <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>{customerHistory.visitCount} {customerHistory.visitCount === 1 ? 'vez' : 'vezes'}</p>
                   </div>
                   <div className="col-span-2 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1.5 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Última visita</p>
                     <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                       {customerHistory.lastVisit
                         ? format(customerHistory.lastVisit, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                         : 'Primeiro atendimento'}
                     </p>
                   </div>
                   
                   {/* Frequent Services */}
                   {customerHistory.frequentServices.length > 0 && (
                     <div className="col-span-2 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                       <p className="text-[10px] uppercase tracking-wider mb-3 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Serviços frequentes</p>
                       <div className="flex flex-wrap gap-2">
                         {customerHistory.frequentServices.map((srv: string) => (
                           <span key={srv} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)' }}>{srv}</span>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
                 
                 {/* Recent Bookings List */}
                 {profile?.role !== 'professional' && (
                   <div className="pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-3 opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Últimos atendimentos</p>
                      {customerHistory.recentList.length > 0 ? (
                        <div className="space-y-2">
                          {customerHistory.recentList.map((pb: any) => (
                            <div key={pb.id} className="flex items-center justify-between p-3.5 rounded-xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--theme-text-primary)' }}>{pb.services?.name}</p>
                                <p className="text-[11px] mt-0.5 opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>com {pb.professionals?.name}</p>
                              </div>
                              <span className="text-xs font-mono font-medium px-2 py-1 rounded-md shrink-0" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)' }}>
                                {format(new Date(pb.scheduled_at), "dd/MM/yy")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-5 rounded-xl border border-dashed" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                          <p className="text-xs opacity-75" style={{ color: 'var(--theme-text-secondary)' }}>Este é o primeiro agendamento deste cliente.</p>
                        </div>
                      )}
                   </div>
                 )}
               </>
             ) : null}
          </div>

          {/* Status actions */}
          {!isFinished ? (
            <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>Mudar status</p>
              
              {/* Opções principais (em atendimento e finalizado) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onStatusChange(booking.id, 'in_progress')}
                  disabled={isUpdating || booking.status === 'in_progress'}
                  className="py-3 rounded-xl text-xs font-bold border transition-colors"
                  style={{
                    backgroundColor: booking.status === 'in_progress' ? 'var(--theme-accent)' : 'transparent',
                    borderColor: 'var(--theme-accent)',
                    color: booking.status === 'in_progress' ? '#000' : 'var(--theme-accent)',
                  }}
                >
                  Em atendimento
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'completed')}
                  disabled={isUpdating}
                  className="py-3 rounded-xl text-xs font-bold transition-opacity text-white hover:opacity-90"
                  style={{ backgroundColor: '#10b981' }} // Verde esmeralda para concluído
                >
                  Finalizado
                </button>
              </div>

              {/* Cancelamentos */}
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => onStatusChange(booking.id, 'no_show')}
                  disabled={isUpdating}
                  className="text-xs font-bold text-orange-500/80 hover:text-orange-500 transition-colors py-1"
                >
                  Não compareceu
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'canceled')}
                  disabled={isUpdating}
                  className="text-xs font-bold text-red-500/80 hover:text-red-500 transition-colors py-1"
                >
                  Cancelar reserva
                </button>
              </div>
            </div>
          ) : (
             <div className="pt-6 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                {onDelete && (
                  confirmDelete ? (
                    <div className="space-y-3">
                      <p className="text-xs text-center font-medium opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                        Tem certeza? Esta ação não pode ser desfeita.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          disabled={isUpdating}
                          className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors"
                          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => { onDelete(booking.id); setConfirmDelete(false); }}
                          disabled={isUpdating}
                          className="flex-1 py-3 rounded-xl text-sm font-bold border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                        >
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
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
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Excluir definitivamente
                    </button>
                  )
                )}
             </div>
          )}


          {/* Contact Actions */}
          <div className="pt-6 pb-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            {booking.customer?.phone ? (
              <a
                href={`https://wa.me/${booking.customer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-xl border text-sm font-bold transition-colors"
                style={{ 
                  background: 'var(--theme-card-bg)',
                  borderColor: '#25D366', 
                  color: 'var(--theme-text-primary)' 
                }}
              >
                <Phone className="w-4.5 h-4.5" style={{ color: '#25D366' }} />
                Conversar no WhatsApp
              </a>
            ) : (
               <button disabled className="w-full py-4 rounded-xl border text-sm font-semibold cursor-not-allowed opacity-50" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)' }}>
                 Telefone não cadastrado
               </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
