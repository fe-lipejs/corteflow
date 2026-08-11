import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { X, User, Scissors, Clock, CreditCard, MessageSquare, Phone, Mail, Loader2, CalendarClock, ChevronDown } from 'lucide-react';
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

export default function BookingDetailSheet({ booking, onClose, onStatusChange, onDelete, isUpdating }: Props) {
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
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:right-0 md:left-auto md:bottom-0 z-50 flex flex-col w-full md:w-[480px] h-[90vh] md:h-full"
        style={{ background: 'var(--theme-bg)', borderTop: '1px solid var(--theme-border)', borderLeft: '1px solid var(--theme-border)', borderRadius: '24px 24px 0 0' }}>

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1 rounded-full" style={{ background: 'var(--theme-border)' }} />
        </div>

        {/* Header (Customer Info) */}
        <div className="flex items-start justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
               <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Agendamento</p>
               {booking.customer?.segment && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    booking.customer.segment === 'vip' ? 'bg-[var(--theme-accent-muted)] text-[var(--theme-accent)] border border-[var(--theme-accent)]' :
                    booking.customer.segment === 'fiel' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    booking.customer.segment === 'novo' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    booking.customer.segment === 'inativo' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {booking.customer.segment}
                  </span>
               )}
            </div>
            <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>{booking.customer?.name ?? 'Cliente'}</h3>
            
            {/* Contatos Reais */}
            <div className="flex flex-col gap-1.5">
              {booking.customer?.phone && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                  <Phone className="w-3.5 h-3.5" /> {booking.customer.phone}
                </div>
              )}
              {booking.customer?.email && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                  <Mail className="w-3.5 h-3.5" /> {booking.customer.email}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all hover:bg-white/10" style={{ color: 'var(--theme-text-secondary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border" style={{ background: statusCfg.bg, color: statusCfg.color, borderColor: `${statusCfg.color}30` }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusCfg.color }} />
              {statusCfg.label}
            </span>
            <p className="text-xs font-mono" style={{ color: 'var(--theme-text-secondary)' }}>#{booking.order_number}</p>
          </div>

          {/* Info cards (Booking context) */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Detalhes da Reserva</p>
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
                sub: `Pago: ${fmt.format(booking.amount_paid)} (${booking.payment_mode === 'local' ? 'No local' : booking.payment_mode === 'full' ? 'Integral' : 'Sinal'})`,
                photo: null,
                color: null,
              },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-4 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                {/* Fix #4: Show professional photo if available, else colored icon */}
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.value}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border"
                    style={{ borderColor: item.color ? `${item.color}40` : 'var(--theme-border)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color ? `${item.color}20` : 'var(--theme-bg-hover)' }}>
                    <item.icon className="w-4.5 h-4.5" style={{ color: item.color ?? 'var(--theme-text-secondary)' }} />
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{item.label}</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>{item.value}</p>
                  {item.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{item.sub}</p>}
                </div>
              </div>
            ))}

            {/* Notes */}
            {booking.notes && (
              <div className="flex items-start gap-4 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--theme-bg-hover)' }}>
                  <MessageSquare className="w-4.5 h-4.5" style={{ color: 'var(--theme-text-secondary)' }} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--theme-text-secondary)' }}>Observações</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text-primary)' }}>{booking.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Customer CRM History — Fix #4: computed from real bookings */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
             <div className="flex items-center gap-2">
               <CalendarClock className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
               <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-accent)' }}>Histórico do Cliente</p>
             </div>
             
             {loadingHistory ? (
               <div className="flex items-center justify-center py-6">
                 <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />
               </div>
             ) : customerHistory ? (
               <>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Total Gasto</p>
                     <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>{fmt.format(customerHistory.totalSpent)}</p>
                   </div>
                   <div className="p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Visitas Concluídas</p>
                     <p className="text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>{customerHistory.visitCount} {customerHistory.visitCount === 1 ? 'vez' : 'vezes'}</p>
                   </div>
                   <div className="col-span-2 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                     <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Última Visita</p>
                     <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                       {customerHistory.lastVisit
                         ? format(customerHistory.lastVisit, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                         : 'Primeiro atendimento'}
                     </p>
                   </div>
                   
                   {/* Frequent Services */}
                   {customerHistory.frequentServices.length > 0 && (
                     <div className="col-span-2 p-4 rounded-2xl border" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                       <p className="text-[10px] uppercase tracking-wider mb-2.5" style={{ color: 'var(--theme-text-secondary)' }}>Serviços Frequentes</p>
                       <div className="flex flex-wrap gap-2">
                         {customerHistory.frequentServices.map((srv: string) => (
                           <span key={srv} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border" style={{ background: 'var(--theme-bg-hover)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{srv}</span>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
                 
                 {/* Recent Bookings List */}
                 <div className="pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-text-secondary)' }}>Últimos Atendimentos</p>
                    {customerHistory.recentList.length > 0 ? (
                      <div className="space-y-2">
                        {customerHistory.recentList.map((pb: any) => (
                          <div key={pb.id} className="flex items-center justify-between p-3.5 rounded-xl border transition-colors hover:opacity-80" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>{pb.services?.name}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>com {pb.professionals?.name}</p>
                            </div>
                            <span className="text-xs font-mono font-medium px-2 py-1 rounded-md" style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)' }}>
                              {format(new Date(pb.scheduled_at), "dd/MM/yy")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 rounded-xl border border-dashed" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg-hover)' }}>
                        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Este é o primeiro agendamento deste cliente.</p>
                      </div>
                    )}
                 </div>
               </>
             ) : null}
          </div>

          {/* Status actions */}
          {!isFinished ? (
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Mudar Status</p>
              {nextStatus && (
                <button
                  onClick={() => onStatusChange(booking.id, nextStatus)}
                  disabled={isUpdating}
                  className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all btn-primary"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Marcar como {BOOKING_STATUS_CONFIG[nextStatus].label}
                </button>
              )}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => onStatusChange(booking.id, 'no_show')}
                  disabled={isUpdating}
                  className="py-3 rounded-xl text-xs font-bold border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 transition-all"
                >
                  Não compareceu
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'canceled')}
                  disabled={isUpdating}
                  className="py-3 rounded-xl text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all"
                >
                  Cancelar Reserva
                </button>
              </div>
            </div>
          ) : (
             <div className="pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                {onDelete && (
                  <button
                    onClick={() => { if(window.confirm('Tem certeza que deseja excluir permanentemente este agendamento?')) onDelete(booking.id) }}
                    disabled={isUpdating}
                    className="w-full py-3.5 rounded-xl text-sm font-bold border border-red-500 text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Excluir Definitivamente
                  </button>
                )}
             </div>
          )}

          {/* Contact Actions */}
          <div className="pt-6 pb-8 border-t mt-4" style={{ borderColor: 'var(--theme-border)' }}>
            {booking.customer?.phone ? (
              <a
                href={`https://wa.me/${booking.customer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border text-sm font-bold transition-all shadow-sm hover:shadow-md"
                style={{ 
                  background: 'var(--theme-card-bg)',
                  borderColor: '#25D366', 
                  color: 'var(--theme-text-primary)' 
                }}
              >
                <Phone className="w-5 h-5" style={{ color: '#25D366' }} />
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
