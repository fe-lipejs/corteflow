import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelBooking, useRescheduleBooking } from '../../hooks/useBookings';
import { format, isBefore, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { usePhoneFormat } from '../../hooks/usePhoneFormat';
import { getThemeById } from '../../contexts/ThemeContext';
import { usePublicStore } from '../../hooks/usePublicStore';

export default function ClientPortal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const phoneFormat = usePhoneFormat("pt");

  const [phone, setPhone] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Reschedule State
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');

  // Tenant Info
  const { data: storeData } = usePublicStore(slug);
  const tenant = storeData?.tenant;

  // Bookings Fetch
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['customer-bookings', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (id, name, price, duration_minutes),
          professionals (id, name, photo_url)
        `)
        .eq('customer_id', customerId)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!customerId,
  });

  const cancelMutation = useCancelBooking();
  const rescheduleMutation = useRescheduleBooking();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !tenant) return;
    setLoading(true);

    try {
      const formattedPhone = phoneFormat.format(phone);
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (data) {
        setCustomerId(data.id);
        setIsLogged(true);
      } else {
        alert('Nenhum agendamento encontrado para este telefone.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (booking: any) => {
    if (!tenant?.tenant_settings?.[0]) return;
    const settings = tenant.tenant_settings[0];

    if (!settings.allow_cancel) {
      alert('O salão não permite cancelamentos pelo portal.');
      return;
    }

    const scheduledDate = new Date(booking.scheduled_at);
    const deadlineDate = addHours(new Date(), settings.cancel_deadline_hours || 24);

    if (isBefore(scheduledDate, deadlineDate)) {
      alert(`O prazo máximo para cancelamento é de ${settings.cancel_deadline_hours} horas de antecedência.`);
      return;
    }

    const reason = window.prompt('Motivo do cancelamento (opcional):', 'Imprevisto');
    if (reason === null) return;

    try {
      await cancelMutation.mutateAsync({
        bookingId: booking.id,
        reason,
        actorType: 'client'
      });
      alert('Agendamento cancelado com sucesso!');
      qc.invalidateQueries({ queryKey: ['customer-bookings', customerId] });
    } catch (err: any) {
      alert(`Erro ao cancelar: ${err.message}`);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newDate || !newTime) return;

    if (!tenant?.tenant_settings?.[0]) return;
    const settings = tenant.tenant_settings[0];

    const scheduledDate = new Date(rescheduleBooking.scheduled_at);
    const deadlineDate = addHours(new Date(), settings.reschedule_deadline_hours || 24);

    if (isBefore(scheduledDate, deadlineDate)) {
      alert(`O prazo máximo para reagendamento é de ${settings.reschedule_deadline_hours} horas de antecedência.`);
      return;
    }

    try {
      setLoading(true);
      await rescheduleMutation.mutateAsync({
        bookingId: rescheduleBooking.id,
        newTime: `${newDate}T${newTime}:00`,
        newProId: rescheduleBooking.professional_id, // keep the same professional for now
        actorType: 'client'
      });
      alert('Agendamento reagendado com sucesso!');
      setRescheduleBooking(null);
      qc.invalidateQueries({ queryKey: ['customer-bookings', customerId] });
    } catch (err: any) {
      alert(`Erro ao reagendar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const settings = storeData?.settings;
  const theme = getThemeById(settings?.theme_preset || 'classic');

  const storeHeader = (
    <div className="relative w-full overflow-hidden border-b mb-8" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
      {/* Banner */}
      <div className="relative h-44 sm:h-56 w-full overflow-hidden">
        {settings?.banner_url ? (
          <img src={settings.banner_url} alt="Banner" className="h-full w-full object-cover opacity-90" />
        ) : (
          <div className="h-full w-full opacity-90" style={{ background: `linear-gradient(135deg, ${theme.accent}40, ${theme.bg})` }} />
        )}
        <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to top, ${theme.cardBg} 0%, transparent 100%)` }} />

        {/* Back Button */}
        <button
          onClick={() => navigate(`/${slug}`)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-xl text-white text-[11px] font-medium shadow-xl border border-white/20 transition-all active:scale-95 hover:bg-black/60 font-sans"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-white/90" />
          <span>Voltar ao Salão</span>
        </button>
      </div>

      {/* Salon Logo + Title Info */}
      <div className="max-w-4xl mx-auto px-6 pb-6 -mt-16 relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
          <div className="h-24 w-24 rounded-3xl border-2 overflow-hidden shadow-2xl flex items-center justify-center backdrop-blur-md shrink-0" style={{ borderColor: theme.accent, backgroundColor: theme.cardBg }}>
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-black font-serif uppercase" style={{ color: theme.textPrimary }}>{tenant.name?.charAt(0)}</span>
            )}
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-1" style={{ borderColor: `${theme.accent}40`, backgroundColor: `${theme.accent}15`, color: theme.accent }}>
              Portal do Cliente
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight" style={{ color: theme.accent }}>
              {tenant.name}
            </h1>
            <p className="text-xs sm:text-sm mt-0.5 opacity-80" style={{ color: theme.textSecondary }}>
              {settings?.short_description || settings?.address || "Gerencie seus agendamentos e histórico completo."}
            </p>
          </div>
        </div>

        {isLogged && (
          <button
            onClick={() => { setIsLogged(false); setCustomerId(null); setPhone(''); }}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: theme.textSecondary }}
          >
            Sair da Conta
          </button>
        )}
      </div>
    </div>
  );

  if (!isLogged) {
    return (
      <div className="min-h-screen pb-16 transition-colors" style={{ backgroundColor: theme.bg }}>
        {storeHeader}

        <div className="max-w-md mx-auto px-4">
          <div className="rounded-3xl p-8 shadow-2xl border backdrop-blur-xl" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <div className="text-center mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border mx-auto mb-3" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30`, color: theme.accent }}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold mb-1" style={{ color: theme.textPrimary }}>Acessar Meus Agendamentos</h2>
              <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                Digite seu número de WhatsApp para consultar, reagendar ou cancelar seus horários no salão <strong>{tenant.name}</strong>.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textPrimary }}>Número do WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(phoneFormat.format(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="w-full p-3.5 rounded-2xl border focus:ring-2 focus:outline-none transition-all font-mono text-sm"
                  style={{ 
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                    outlineColor: theme.accent
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-98 shadow-lg"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Portal →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const futureBookings = bookings.filter((b) => new Date(b.scheduled_at) >= new Date() && !['canceled', 'no_show', 'completed'].includes(b.status));
  const pastBookings = bookings.filter((b) => new Date(b.scheduled_at) < new Date() || ['canceled', 'no_show', 'completed'].includes(b.status));

  return (
    <div className="min-h-screen pb-20 transition-colors" style={{ backgroundColor: theme.bg }}>
      {storeHeader}

      <div className="max-w-3xl mx-auto px-4 space-y-8">
        <section>
          <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
            <Calendar className="w-5 h-5" style={{ color: theme.accent }} /> 
            Próximos Agendamentos
          </h2>
          
          {futureBookings.length === 0 ? (
            <div className="p-8 text-center rounded-3xl border border-dashed backdrop-blur-xl" style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}>
              <p className="text-sm font-medium" style={{ color: theme.textSecondary }}>Você não tem nenhum agendamento futuro no momento.</p>
              <button
                onClick={() => navigate(`/${slug}`)}
                className="mt-4 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-transform hover:scale-105 active:scale-95"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Agendar Novo Horário
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {futureBookings.map((b) => (
                <div key={b.id} className="rounded-3xl p-6 shadow-xl border backdrop-blur-xl transition-all" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex justify-between items-start mb-4 border-b pb-4" style={{ borderColor: theme.border }}>
                    <div>
                      <h3 className="font-serif font-bold text-xl" style={{ color: theme.textPrimary }}>{b.services?.name}</h3>
                      <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>com <strong>{b.professionals?.name || 'Profissional'}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif font-extrabold text-2xl" style={{ color: theme.accent }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.amount_total)}
                      </p>
                      <div className="flex flex-col items-end gap-1 mt-1">
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}>
                          {b.status === 'confirmed' ? 'Confirmado' : b.status === 'pending' ? 'Pendente' : b.status}
                        </span>
                        {b.payment_status && (
                          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: b.payment_status === 'paid' ? '#10b98120' : b.payment_status === 'partial_paid' ? '#f59e0b20' : '#ef444420', color: b.payment_status === 'paid' ? '#10b981' : b.payment_status === 'partial_paid' ? '#f59e0b' : '#ef4444' }}>
                            {b.payment_status === 'paid' ? 'Pago Integral' : b.payment_status === 'partial_paid' ? 'Sinal Pago' : b.payment_status === 'refunded' ? 'Estornado' : b.payment_status === 'failed' ? 'Falha no Pagamento' : b.payment_status === 'pending' ? 'Aguardando Pagamento' : b.payment_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div className="flex items-center gap-4 text-sm" style={{ color: theme.textPrimary }}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="font-bold">{format(new Date(b.scheduled_at), "dd/MM/yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="font-bold">{format(new Date(b.scheduled_at), "HH:mm")}h</span>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {settings?.allow_cancel && (
                        <button 
                          onClick={() => handleCancel(b)}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      {settings?.allow_reschedule && (
                        <button 
                          onClick={() => {
                            setRescheduleBooking(b);
                            setNewDate(format(new Date(b.scheduled_at), 'yyyy-MM-dd'));
                            setNewTime('');
                          }}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-md"
                          style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
                        >
                          Reagendar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pt-4">
          <h2 className="text-xl font-serif font-bold mb-4 opacity-80" style={{ color: theme.textPrimary }}>Histórico Passado</h2>
          <div className="space-y-3">
            {pastBookings.map((b) => (
              <div key={b.id} className="rounded-2xl p-4 border opacity-75 flex items-center justify-between" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>{b.services?.name}</h4>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{format(new Date(b.scheduled_at), "dd/MM/yyyy 'às' HH:mm")} • com {b.professionals?.name}</p>
                </div>
                <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full border" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                  {b.status === 'canceled' ? 'Cancelado' : b.status === 'completed' ? 'Concluído' : b.status}
                </span>
              </div>
            ))}
            {pastBookings.length === 0 && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>Nenhum histórico passado encontrado.</p>
            )}
          </div>
        </section>
      </div>

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-md p-7 rounded-3xl shadow-2xl border" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <h3 className="text-2xl font-serif font-bold mb-2" style={{ color: theme.textPrimary }}>Reagendar Atendimento</h3>
            <p className="text-xs mb-5" style={{ color: theme.textSecondary }}>Escolha uma nova data e horário para o serviço <strong>{rescheduleBooking.services?.name}</strong>.</p>
            
            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textPrimary }}>Nova Data</label>
                <input 
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full p-3.5 rounded-2xl border focus:ring-2 focus:outline-none transition-all text-sm font-sans"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary, outlineColor: theme.accent }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textPrimary }}>Novo Horário</label>
                <input 
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border focus:ring-2 focus:outline-none transition-all text-sm font-sans"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary, outlineColor: theme.accent }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setRescheduleBooking(null)}
                  className="flex-1 py-3.5 rounded-2xl font-bold border text-xs transition-colors"
                  style={{ borderColor: theme.border, color: theme.textPrimary }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-xs flex justify-center items-center gap-2 transition-all hover:opacity-90 shadow-md"
                  style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Reagendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
