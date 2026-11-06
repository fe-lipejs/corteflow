import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
import { supabase } from '../../integrations/supabase/client';
import { Calendar, DollarSign, UserPlus, Clock, ArrowUpRight, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfDay, endOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useProfessionals } from '../../hooks/useProfessionals';
import { useServices } from '../../hooks/useServices';
import { useCreateBooking, useBookingsRealtime, useUpdateBookingStatus, useDeleteBooking, useUpdateBooking } from '../../hooks/useBookings';
import BookingModal from './agenda/BookingModal';
import EditBookingModal from './agenda/EditBookingModal';
import BookingDetailSheet from './agenda/BookingDetailSheet';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';

function isValidConfirmedOrLocalBooking(b: any): boolean {
  if (!b) return false;
  if (b.status === 'canceled' || b.status === 'no_show') return false;
  if (
    b.status === 'pending' &&
    (b.payment_mode === 'deposit' || b.payment_mode === 'full') &&
    (!b.payment_status || b.payment_status === 'pending')
  ) {
    return false;
  }
  return true;
}

export default function Dashboard() {
  const { profile, tenant, professionalProfile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const tenantId = tenant?.id ?? '';
  const firstName = profile?.full_name?.split(' ')[0] || 'Dono';

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const updateStatus = useUpdateBookingStatus(tenantId);
  const updateBooking = useUpdateBooking(tenantId);
  const deleteBooking = useDeleteBooking(tenantId);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();
  const futureWeekEnd = endOfDay(addDays(new Date(), 6)).toISOString();

  // 1. Fetch Today's Bookings (with both singular aliases for BookingDetailSheet and plural fallbacks)
  const { data: rawTodayBookings = [], isLoading: isLoadingToday } = useQuery({
    queryKey: ['bookings', tenantId, 'dashboard_today'],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          customer:customers ( id, name, phone, email, segment ),
          professional:professionals ( id, name, agenda_color, photo_url ),
          service:services ( id, name, duration_minutes, buffer_minutes, color, price )
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', todayStart)
        .lte('scheduled_at', todayEnd)
        .order('scheduled_at', { ascending: true });

      if (profile?.role === 'professional' && professionalProfile?.id) {
        query = query.eq('professional_id', professionalProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(isValidConfirmedOrLocalBooking);
    },
    enabled: !!tenantId,
  });

  // 1.5 Fetch Upcoming Bookings (for the next 7 days list)
  const { data: rawUpcomingBookings = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['bookings', tenantId, 'dashboard_upcoming'],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          customer:customers ( id, name, phone, email, segment ),
          professional:professionals ( id, name, agenda_color, photo_url ),
          service:services ( id, name, duration_minutes, buffer_minutes, color, price )
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', todayStart)
        .lte('scheduled_at', futureWeekEnd)
        .order('scheduled_at', { ascending: true });

      if (profile?.role === 'professional' && professionalProfile?.id) {
        query = query.eq('professional_id', professionalProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(isValidConfirmedOrLocalBooking);
    },
    enabled: !!tenantId,
  });

  // 2. Fetch Recent & Future Bookings (for charts and top services)
  const past30DaysStart = startOfDay(addDays(new Date(), -30)).toISOString();
  const { data: recentBookings = [], isLoading: isLoadingFuture } = useQuery({
    queryKey: ['bookings', tenantId, 'dashboard_recent'],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          id, scheduled_at, amount_total, status, payment_mode, payment_status,
          service:services ( name )
        `)
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', past30DaysStart)
        .lte('scheduled_at', futureWeekEnd);

      if (profile?.role === 'professional' && professionalProfile?.id) {
        query = query.eq('professional_id', professionalProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(isValidConfirmedOrLocalBooking);
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

  // 5. Fetch tenant settings (logo_url)
  const { data: tenantSettings } = useQuery({
    queryKey: ['dashboard_tenant_settings', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_settings')
        .select('logo_url')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: professionals = [] } = useProfessionals(tenantId || null);
  const { data: services = [] } = useServices(tenantId || null);
  const createBooking = useCreateBooking(tenantId || '');

  // Enable Real-time updates for the dashboard!
  useBookingsRealtime(tenantId || null);

  const loading = isLoadingToday || isLoadingFuture || isLoadingCustomers || isLoadingUpcoming;

  const todayBookings = rawTodayBookings;
  const upcomingBookings = rawUpcomingBookings;

  // Total revenue today - count confirmed/in_progress/arrived/completed
  const validTodayBookings = todayBookings.filter(
    b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'in_progress' || b.status === 'arrived'
  );
  const totalRevenueToday = validTodayBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  
  let occupancy = '0%';
  const todayWeekday = new Date().getDay(); // 0-6
  const todayHours = businessHours.find(h => h.weekday === todayWeekday);
  const activeProsCount = Math.max(1, professionals.filter(p => p.active !== false && (!p.status || p.status === 'active')).length);
  
  if (todayBookings.length === 0) {
    occupancy = '0%';
  } else if (todayHours && todayHours.is_open && todayHours.open_time && todayHours.close_time) {
    const startHour = parseInt(todayHours.open_time.split(':')[0], 10);
    const endHour = parseInt(todayHours.close_time.split(':')[0], 10);
    const totalMinutesOpen = Math.max(60, (endHour - startHour) * 60);
    
    const totalBookedMinutes = todayBookings.reduce((sum, b) => {
      return sum + (b.duration_minutes || b.service?.duration_minutes || 30);
    }, 0);
    
    const availableMinutes = totalMinutesOpen * activeProsCount;
    const occ = Math.round((totalBookedMinutes / availableMinutes) * 100);
    occupancy = `${Math.min(occ, 100)}%`;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const kpis = [
    {
      label: 'Agendamentos hoje',
      value: todayBookings.length.toString(),
      sub: 'hoje',
      icon: Calendar,
      dark: true,
    },
    {
      label: 'Faturamento do dia',
      value: formatCurrency(totalRevenueToday),
      sub: 'previsto hoje',
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
      value: newCustomersCount === 0 ? 'Nenhum' : (newCustomersCount !== undefined ? newCustomersCount.toString() : '...'), 
      sub: 'últimos 7 dias',
      icon: UserPlus,
      dark: false,
    },
  ];

  // Gráfico da semana (Previsão)
  const confirmedRecentBookings = recentBookings.filter(
    b => b.status === 'confirmed' || b.status === 'completed' || b.status === 'in_progress' || b.status === 'arrived'
  );
  const futureRevenue = confirmedRecentBookings
    .filter(b => new Date(b.scheduled_at) >= startOfDay(new Date()))
    .reduce((sum, b) => sum + (b.amount_total || 0), 0);
  
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

  // Top Serviços
  const servicesStats: Record<string, { count: number; revenue: number }> = {};
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
    .sort((a, b) => b[1].count - a[1].count || b[1].revenue - a[1].revenue)
    .slice(0, 3)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      revenue: stats.revenue
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header com Saudação e Foto/Logo Clicável */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate('/app/configuracoes')}
            className="cursor-pointer group flex-shrink-0 relative focus:outline-none transition-transform hover:scale-105 active:scale-95"
            title="Configurações do Salão"
          >
            {tenantSettings?.logo_url ? (
              <img 
                src={tenantSettings.logo_url} 
                alt="Logo do Estabelecimento" 
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border shadow-sm group-hover:border-blue-400 transition-all"
                style={{ borderColor: theme.border }} 
              />
            ) : (
              <div 
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-bold text-lg md:text-xl shadow-sm"
                style={{ background: theme.accent, color: theme.textInverse }}
              >
                {tenant?.name?.substring(0, 2).toUpperCase() || 'RF'}
              </div>
            )}
          </button>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Visão Geral</p>
            <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
              {getGreeting()}, <span style={{ color: theme.accent }}>{firstName}.</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>
              {todayBookings.length > 0 
                ? `Você tem ${todayBookings.length} agendamento${todayBookings.length > 1 ? 's' : ''} hoje.` 
                : 'Nenhum agendamento para hoje.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-1">
          <a 
            href={tenant?.slug ? getTenantPublicUrl(tenant.slug) : '#'} 
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

      {/* Banner de Instalação do App para o Dono/Profissional acessar direto da tela inicial */}
      <PWAInstallButton
        storeName={tenant?.name || 'Raffros'}
        logoUrl={tenantSettings?.logo_url}
        accentColor={theme.accent}
        textColor={theme.textInverse || '#FFFFFF'}
        isDark={true}
        variant="banner"
      />

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
                Seu estabelecimento está quase pronto. Para começar a receber agendamentos e ver os gráficos ganharem vida, configure os pilares do seu negócio.
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
                <p className="text-xs" style={{ color: theme.textMuted }}>O que você vai oferecer? (Ex: Corte, Barba, Manicure)</p>
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

      {/* 4 KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-5 md:mb-8">
        {kpis.map((k, i) => (
          <div key={i} className="glass-card p-4 md:p-6 relative overflow-hidden group">
            <div>
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <span className="text-[10px] md:text-xs font-medium" style={{ color: theme.textSecondary }}>
                  {k.label}
                </span>
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.accentMuted }}>
                  <k.icon className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: theme.accent }} />
                </div>
              </div>
              <p className={`font-serif ${typeof k.value === 'string' && k.value.length > 8 ? 'text-[17px] md:text-2xl lg:text-3xl' : 'text-xl md:text-3xl lg:text-4xl'} font-bold mb-1 truncate`} style={{ color: theme.textPrimary }}>
                {k.value}
              </p>
            </div>
            <p className="text-[10px] md:text-xs font-medium" style={{ color: theme.accent }}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Agenda do dia */}
        <div className="lg:col-span-2 glass-card p-4 md:p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg" style={{ color: theme.textPrimary }}>Próximos agendamentos</h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>Os seus próximos horários</p>
            </div>
            <button onClick={() => navigate('/app/agenda')} className="flex items-center gap-1 text-xs font-semibold cursor-pointer" style={{ color: theme.accent }}>
              Ver semana <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {(() => {
              const proximosAgendamentos = upcomingBookings.filter(item => {
                const isPast = new Date(item.scheduled_at) < new Date();
                const isFinished = item.status === 'completed' || item.status === 'canceled' || item.status === 'no_show';
                if (isPast && isFinished) return false;
                return true;
              }).slice(0, 15);

              if (proximosAgendamentos.length === 0) {
                return (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <p className="empty-state-title">Nenhum próximo agendamento</p>
                    <p className="empty-state-text">Você está livre pelo resto do dia.</p>
                  </div>
                );
              }

              return proximosAgendamentos.map((item) => {
                const isLate = new Date(item.scheduled_at) < new Date() && (item.status === 'pending' || item.status === 'confirmed');
                const customerName = item.customer?.name || item.customers?.name || 'Cliente';
                const serviceName = item.service?.name || item.services?.name || 'Serviço';
                const proName = item.professional?.name || item.professionals?.name || 'Equipe';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedBooking(item)}
                    className={`agenda-item flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg border cursor-pointer transition-colors hover:bg-[var(--theme-bg-hover)] ${isLate ? 'border-red-300 bg-red-50 hover:bg-red-100' : ''}`}
                    style={{ borderColor: isLate ? '#FCA5A5' : theme.border }}
                  >
                    <div className="flex flex-col items-center flex-shrink-0 w-12 md:w-14">
                      <span className={`font-bold text-xs md:text-sm ${isLate ? 'text-red-600' : ''}`} style={{ color: isLate ? '#DC2626' : theme.accent }}>{formatTime(item.scheduled_at)}</span>
                      <span className="text-[9px] md:text-[10px] font-medium" style={{ color: theme.textMuted }}>{format(new Date(item.scheduled_at), 'dd/MM')}</span>
                      {isLate && <span className="text-[8px] md:text-[9px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded-sm mt-0.5 uppercase tracking-wider">Atrasado</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 w-full mb-0.5">
                        <span className={`font-semibold text-[13px] md:text-sm truncate ${isLate ? 'text-red-900' : ''}`} style={{ color: isLate ? '#7F1D1D' : theme.textPrimary }}>
                          {customerName}
                        </span>
                        {item.order_number && (
                          <span className={`text-[9px] md:text-[10px] font-mono px-1 py-0.5 rounded-md border flex-shrink-0 ${isLate ? 'border-red-200 bg-red-100 text-red-700' : ''}`} style={!isLate ? { color: theme.textMuted, borderColor: theme.border, background: theme.bg } : {}}>
                            #{item.order_number}
                          </span>
                        )}
                        {item.payment_mode && item.payment_mode !== 'local' && Number(item.amount_paid || 0) > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 shrink-0">
                            {item.payment_mode === 'deposit' ? 'Sinal Pago' : 'Pago Online'}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] md:text-xs truncate ${isLate ? 'text-red-700/80' : ''}`} style={{ color: isLate ? 'rgb(185 28 28 / 0.8)' : theme.textMuted }}>
                        {serviceName} · {proName}
                      </p>
                    </div>
                    <span className={`text-[13px] md:text-sm font-semibold flex-shrink-0 ${isLate ? 'text-red-700' : ''}`} style={{ color: isLate ? '#B91C1C' : theme.textSecondary }}>
                      {formatCurrency(item.amount_total || 0)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* Semana card */}
          <div className="glass-card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4" style={{ color: theme.accent }} />
              <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>Previsão da Semana</span>
            </div>
            <p className="font-serif text-3xl font-bold mb-0.5" style={{ color: theme.textPrimary }}>
              {formatCurrency(futureRevenue)}
            </p>
            <p className="text-xs mb-5" style={{ color: theme.textMuted }}>faturamento previsto</p>

            {/* Mini bar chart */}
            <div className="flex items-end gap-1.5 h-16 mt-auto">
              {futureWeekHeights.every(h => h === 0) ? (
                <div className="w-full flex items-center justify-center text-xs opacity-70" style={{ color: theme.textSecondary }}>
                  Nenhuma previsão disponível
                </div>
              ) : (
                futureWeekHeights.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div
                      className="chart-bar w-full"
                      style={{ height: `${Math.max(4, h)}%`, opacity: i === futureWeekHeights.indexOf(Math.max(...futureWeekHeights)) ? 1 : 0.45, background: theme.accent, borderRadius: '2px' }}
                    />
                    <span className="text-[9px]" style={{ color: theme.textMuted }}>{weekDays[i]}</span>
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
          services={services.filter(s => s.active)}
          professionals={professionals.filter(p => p.active !== false && (!p.status || p.status === 'active'))}
          businessHours={businessHours}
          onClose={() => setBookingModalOpen(false)}
          onCreate={async (input) => {
            await createBooking.mutateAsync(input);
            setBookingModalOpen(false);
          }}
          isLoading={createBooking.isPending}
        />
      )}

      {selectedBooking && (
        <BookingDetailSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={async (id, status) => {
            await updateStatus.mutateAsync({ id, status });
            if (status === 'canceled' || status === 'no_show') {
              setSelectedBooking(null);
            } else {
              setSelectedBooking((prev: any) => prev ? {
                ...prev,
                status,
                ...(status === 'completed' ? { amount_paid: prev.amount_total, payment_status: 'paid' } : {})
              } : null);
            }
          }}
          onDelete={async (id) => {
            await deleteBooking.mutateAsync(id);
            setSelectedBooking(null);
          }}
          onEdit={(b) => setEditingBooking(b)}
          isUpdating={updateStatus.isPending || deleteBooking.isPending}
        />
      )}

      {editingBooking && (
        <EditBookingModal
          tenantId={tenantId}
          booking={editingBooking}
          services={services}
          professionals={professionals}
          businessHours={businessHours}
          onClose={() => setEditingBooking(null)}
          onSave={async (fields) => {
            await updateBooking.mutateAsync(fields);
            setEditingBooking(null);
            setSelectedBooking(null);
          }}
          isLoading={updateBooking.isPending}
        />
      )}
    </div>
  );
}
