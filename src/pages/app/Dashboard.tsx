import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../integrations/supabase/client';
import { Calendar, DollarSign, UserPlus, Clock, ArrowUpRight, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfDay, endOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useProfessionals } from '../../hooks/useProfessionals';
import { useServices } from '../../hooks/useServices';
import { useCreateBooking, useBookingsRealtime } from '../../hooks/useBookings';
import BookingModal from './agenda/BookingModal';

export default function Dashboard() {
  const { profile, tenant } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const tenantId = tenant?.id ?? '';
  const firstName = profile?.full_name?.split(' ')[0] || 'Dono';

  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();
  // Para previsão futura da semana (hoje + 6 dias)
  const futureWeekStart = todayStart;
  const futureWeekEnd = endOfDay(addDays(new Date(), 6)).toISOString();

  // 1. Fetch Today's Bookings
  const { data: todayBookings = [], isLoading: isLoadingToday } = useQuery({
    queryKey: ['bookings', tenantId, 'dashboard_today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customers ( name ),
          professionals ( name ),
          services ( name, duration_minutes )
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', todayStart)
        .lte('scheduled_at', todayEnd)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // 2. Fetch Recent & Future Bookings (for charts and top services)
  // Fetch from 30 days ago to 7 days ahead
  const past30DaysStart = startOfDay(addDays(new Date(), -30)).toISOString();
  const { data: recentBookings = [], isLoading: isLoadingFuture } = useQuery({
    queryKey: ['bookings', tenantId, 'dashboard_recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, scheduled_at, amount_total, status,
          service:services ( name )
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', past30DaysStart)
        .lte('scheduled_at', futureWeekEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // 3. Fetch new customers this week (created in the last 7 days)
  const { data: newCustomersCount, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['dashboard_new_customers', tenantId],
    queryFn: async () => {
      const pastWeekStart = startOfDay(addDays(new Date(), -7)).toISOString();
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', pastWeekStart)
        .lte('created_at', todayEnd);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenantId,
  });

  // 4. Fetch business hours (to calculate occupancy)
  const { data: businessHours = [] } = useQuery({
    queryKey: ['dashboard_business_hours', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: professionals = [] } = useProfessionals(tenantId || null);
  const { data: services = [] } = useServices(tenantId || null);
  const createBooking = useCreateBooking(tenantId || '');

  // Enable Real-time updates for the dashboard!
  useBookingsRealtime(tenantId || null);

  const loading = isLoadingToday || isLoadingFuture || isLoadingCustomers;

  // Total revenue today - count only confirmed/completed
  const validTodayBookings = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const totalRevenueToday = validTodayBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  
  let occupancy = 'Sem dados';
  const todayWeekday = new Date().getDay(); // 0-6
  const todayHours = businessHours.find(h => h.weekday === todayWeekday);
  
  if (todayBookings.length === 0) {
    occupancy = 'Ainda sem agendamentos';
  } else if (todayHours && todayHours.is_open && todayHours.open_time && todayHours.close_time) {
    const startHour = parseInt(todayHours.open_time.split(':')[0]);
    const endHour = parseInt(todayHours.close_time.split(':')[0]);
    const totalMinutesOpen = (endHour - startHour) * 60;
    
    // Sum duration of all today's bookings
    const totalBookedMinutes = todayBookings.reduce((sum, b) => {
      const dur = b.services?.duration_minutes || 0;
      return sum + dur;
    }, 0);
    
    if (totalMinutesOpen > 0) {
      const pct = Math.min(100, Math.round((totalBookedMinutes / totalMinutesOpen) * 100));
      occupancy = `${pct}%`;
    }
  } else if (todayHours && !todayHours.is_open) {
    occupancy = 'Fechado';
  }

  // Basic formatter
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const kpis = [
    {
      label: 'Agendamentos hoje',
      value: todayBookings.length.toString(),
      sub: 'agora',
      icon: Calendar,
      dark: true,
    },
    {
      label: 'Faturamento previsto',
      value: formatCurrency(totalRevenueToday),
      sub: 'hoje',
      icon: DollarSign,
      dark: false,
    },
    {
      label: 'Ocupação',
      value: occupancy,
      sub: 'hoje',
      icon: Clock,
      dark: false,
    },
    {
      label: 'Novos clientes',
      value: newCustomersCount === 0 ? 'Nenhum cliente novo' : (newCustomersCount !== undefined ? newCustomersCount.toString() : '...'), 
      sub: 'últimos 7 dias',
      icon: UserPlus,
      dark: false,
    },
  ];

  // Gráfico da semana (Previsão)
  const confirmedRecentBookings = recentBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const futureRevenue = confirmedRecentBookings
    .filter(b => new Date(b.scheduled_at) >= new Date())
    .reduce((sum, b) => sum + (b.amount_total || 0), 0);
  
  // Calculate heights per day (Next 7 days including today)
  const next7Days = Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));
  const weekDays = next7Days.map(d => format(d, 'E', { locale: ptBR }).charAt(0).toUpperCase());
  
  const dailyFutureRevenues = next7Days.map(day => {
    const dayStart = startOfDay(day).getTime();
    const dayEnd = endOfDay(day).getTime();
    return confirmedRecentBookings
      .filter(b => {
        const d = new Date(b.scheduled_at).getTime();
        return d >= dayStart && d <= dayEnd;
      })
      .reduce((sum, b) => sum + (b.amount_total || 0), 0);
  });
  
  const maxFutureRevenue = Math.max(...dailyFutureRevenues, 1);
  const futureWeekHeights = dailyFutureRevenues.map(r => (r / maxFutureRevenue) * 100);

  // Top Serviços (Based on recent 30 days + future confirmed bookings)
  const servicesStats: Record<string, { count: number, revenue: number }> = {};
  confirmedRecentBookings.forEach(b => {
    const serviceData = b.service as any;
    const serviceName = Array.isArray(serviceData) ? serviceData[0]?.name : serviceData?.name;
    
    if (serviceName) {
      if (!servicesStats[serviceName]) {
        servicesStats[serviceName] = { count: 0, revenue: 0 };
      }
      servicesStats[serviceName].count += 1;
      servicesStats[serviceName].revenue += (b.amount_total || 0);
    }
  });
  
  const topServices = Object.entries(servicesStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      revenue: stats.revenue
    }));

  const handleCreateBooking = async (input: any) => {
    await createBooking.mutateAsync(input);
    setBookingModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Saudação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Visão Geral</p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
            {getGreeting()}, <span style={{ color: theme.accent }}>{firstName}.</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>
            {todayBookings.length > 0 
              ? `Você tem ${todayBookings.length} agendamentos hoje.` 
              : 'Nenhum agendamento para hoje.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-1">
          <a 
            href={`/${tenant?.slug}`} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-xl transition-all"
            style={{ background: theme.bgHover, color: theme.textPrimary, border: `1px solid ${theme.border}` }}
          >
            <ArrowUpRight className="w-4 h-4" />
            Ver Minha Página
          </a>
          <button onClick={() => setBookingModalOpen(true)} className="btn-primary">+ Agendar</button>
        </div>
      </div>

      {/* Onboarding Setup Guide for New Users */}
      {(services.length === 0 || professionals.length === 0) && (
        <div className="mb-8 p-6 md:p-8 rounded-3xl relative overflow-hidden" style={{ background: theme.sidebarBg, border: `1px solid ${theme.border}` }}>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[#C9963B] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-2 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                <span className="text-2xl">👋</span> Bem-vindo ao seu novo sistema!
              </h2>
              <p className="text-sm max-w-2xl leading-relaxed" style={{ color: theme.textMuted }}>
                Sua barbearia está quase pronta. Para começar a receber agendamentos e ver os gráficos ganharem vida, você precisa configurar os pilares do seu negócio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 relative z-10">
            <button 
              onClick={() => navigate('/app/servicos')}
              className="flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.02]" 
              style={{ background: theme.bgHover, border: `1px solid ${theme.border}` }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${services.length > 0 ? 'bg-green-500/20 text-green-500' : 'bg-[#C9963B]/20 text-[#C9963B]'}`}>
                {services.length > 0 ? <CheckCircle className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Cadastrar Serviços</h3>
                <p className="text-xs" style={{ color: theme.textMuted }}>O que você vai oferecer? (Ex: Corte, Barba)</p>
              </div>
            </button>

            <button 
              onClick={() => navigate('/app/equipe')}
              className="flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.02]" 
              style={{ background: theme.bgHover, border: `1px solid ${theme.border}` }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${professionals.length > 0 ? 'bg-green-500/20 text-green-500' : 'bg-[#C9963B]/20 text-[#C9963B]'}`}>
                {professionals.length > 0 ? <CheckCircle className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Adicionar Profissionais</h3>
                <p className="text-xs" style={{ color: theme.textMuted }}>Quem vai atender os clientes?</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards — Clean Financeiro Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k, i) => {
          const isHighlight = i === 1; // Faturamento Previsto em destaque
          return isHighlight ? (
            <div key={i} className="p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5"
              style={{ background: theme.accentGradient, borderColor: theme.accent, color: theme.btnPrimaryText }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-full bg-black/15 flex items-center justify-center backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>
                  <k.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-black/20 rounded-full backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>Hoje</span>
              </div>
              <p className="text-sm font-bold opacity-80 mb-1 relative z-10">{k.label}</p>
              <h3 className="text-3xl font-black relative z-10 tracking-tight">
                {k.value}
              </h3>
            </div>
          ) : (
            <div key={i} className="p-6 rounded-3xl border shadow-sm glass-card flex flex-col justify-between transition-all hover:-translate-y-0.5"
              style={{ borderColor: theme.border }}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: theme.accentMuted, color: theme.accent }}>
                  <k.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>{k.sub}</span>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>{k.label}</p>
              <h3 className="text-3xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
                {k.value}
              </h3>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda do dia */}
        <div className="lg:col-span-2 border rounded-3xl p-6 shadow-sm glass-card" style={{ borderColor: theme.border }}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-xl" style={{ color: theme.textPrimary }}>Agenda de hoje</h3>
              <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{todayBookings.length} horários confirmados para atendimento</p>
            </div>
            <button onClick={() => navigate('/app/agenda')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all hover:opacity-80"
              style={{ background: theme.inputBg, borderColor: theme.border, color: theme.accent }}>
              Ver semana completa <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {todayBookings.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center" style={{ borderColor: theme.border }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: theme.accentMuted, color: theme.accent }}>
                  <Calendar className="w-7 h-7" />
                </div>
                <p className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>Nenhum agendamento para hoje</p>
                <p className="text-xs max-w-xs" style={{ color: theme.textSecondary }}>Assim que os clientes agendarem horários, eles aparecerão organizados aqui.</p>
              </div>
            ) : (
              todayBookings.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-[var(--theme-bg-hover)]"
                  style={{ borderColor: theme.border, background: theme.cardBg }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-bold text-base font-mono shrink-0 px-3 py-1.5 rounded-xl border"
                      style={{ background: theme.inputBg, borderColor: theme.border, color: theme.accent }}>
                      {formatTime(item.scheduled_at)}
                    </span>
                    <div className="truncate">
                      <p className="font-bold text-sm truncate flex items-center gap-2" style={{ color: theme.textPrimary }}>
                        {item.customers?.name || 'Cliente'}
                        {item.order_number && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: theme.textSecondary, borderColor: theme.border, background: theme.inputBg }}>
                            #{item.order_number}
                          </span>
                        )}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: theme.textSecondary }}>
                        {item.services?.name || 'Serviço'} · com {item.professionals?.name || 'Equipe'}
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-extrabold shrink-0 ml-4" style={{ color: theme.textPrimary }}>
                    {formatCurrency(item.amount_total || 0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-6">
          {/* Semana card */}
          <div className="border rounded-3xl p-6 shadow-sm glass-card flex flex-col justify-between" style={{ borderColor: theme.border }}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: theme.accentMuted, color: theme.accent }}>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Previsão da Semana</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>7 Dias</span>
              </div>
              <p className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: theme.textPrimary }}>
                {formatCurrency(futureRevenue)}
              </p>
              <p className="text-xs mb-6" style={{ color: theme.textSecondary }}>faturamento previsto nos próximos 7 dias</p>
            </div>

            {/* Mini bar chart */}
            <div className="flex items-end gap-2 h-20 pt-2 border-t" style={{ borderColor: theme.border }}>
              {futureWeekHeights.every(h => h === 0) ? (
                <div className="w-full flex items-center justify-center text-xs opacity-70" style={{ color: theme.textSecondary }}>
                  Nenhuma previsão disponível
                </div>
              ) : (
                futureWeekHeights.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className="chart-bar w-full transition-all rounded-lg"
                      style={{
                        height: `${Math.max(h, 8)}%`,
                        opacity: i === futureWeekHeights.indexOf(Math.max(...futureWeekHeights)) ? 1 : 0.45,
                        background: theme.accent,
                      }}
                    />
                    <span className="text-[10px] font-bold font-mono" style={{ color: theme.textSecondary }}>{weekDays[i]}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Serviços */}
          <div className="glass-card p-5">
            <h4 className="font-bold text-sm mb-4" style={{ color: theme.textPrimary }}>Top serviços</h4>
            
            {topServices.length === 0 ? (
              <div className="text-center py-4 text-xs opacity-70" style={{ color: theme.textSecondary }}>
                Sem informações suficientes
              </div>
            ) : (
              <div className="space-y-3">
                {topServices.map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold truncate mr-2" style={{ color: theme.textPrimary }}>{s.name}</span>
                      <span style={{ color: theme.textSecondary, flexShrink: 0 }}>{s.count} agend.</span>
                    </div>
                    <div className="text-xs font-medium text-right mb-2" style={{ color: theme.accent }}>
                      {formatCurrency(s.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Agendamento */}
      {bookingModalOpen && (
        <BookingModal
          tenantId={tenantId}
          services={services}
          professionals={professionals}
          businessHours={businessHours}
          onClose={() => setBookingModalOpen(false)}
          onCreate={handleCreateBooking}
          isLoading={createBooking.isPending}
        />
      )}
    </div>
  );
}
