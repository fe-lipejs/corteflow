import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../integrations/supabase/client';
import { Calendar, DollarSign, UserPlus, Clock, ArrowUpRight, ArrowRight, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const weekDays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const weekHeights = [45, 62, 55, 80, 70, 100, 30];
const topServices = [
  { name: 'Corte + barba', pct: 82 },
  { name: 'Degradê', pct: 65 },
  { name: 'Barba', pct: 40 },
];

export default function Dashboard() {
  const { profile, tenant } = useAuth();
  const { theme } = useTheme();
  const firstName = profile?.full_name?.split(' ')[0] || 'Dono';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            customers ( name ),
            professionals ( name ),
            services ( name )
          `)
          .eq('tenant_id', tenant.id)
          .gte('scheduled_at', todayStart.toISOString())
          .lte('scheduled_at', todayEnd.toISOString())
          .order('scheduled_at', { ascending: true });

        if (error) throw error;
        setBookings(data || []);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [tenant?.id]);

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount_total || 0), 0);
  
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
      value: bookings.length.toString(),
      sub: '↗ vs ontem',
      icon: Calendar,
      dark: true,
    },
    {
      label: 'Faturamento previsto',
      value: formatCurrency(totalRevenue),
      sub: 'hoje',
      icon: DollarSign,
      dark: false,
    },
    {
      label: 'Ocupação',
      value: 'N/A',
      sub: 'hoje',
      icon: Clock,
      dark: false,
    },
    {
      label: 'Novos clientes',
      value: 'N/A', 
      sub: 'esta semana',
      icon: UserPlus,
      dark: false,
    },
  ];

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
            Você tem {bookings.length} agendamentos hoje.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-1">
          <button className="btn-outline hidden md:block">Hoje</button>
          <button className="btn-primary">+ Agendar</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={`kpi-card ${k.dark ? 'glass-card' : 'glass-card'} flex flex-col justify-between h-full p-5`}>
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                  {k.label}
                </span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.accentMuted }}>
                  <k.icon className="w-4 h-4" style={{ color: theme.accent }} />
                </div>
              </div>
              <p className="font-serif text-2xl md:text-4xl font-bold mb-2 truncate" style={{ color: theme.textPrimary }}>
                {k.value}
              </p>
            </div>
            <p className="text-xs font-medium" style={{ color: theme.accent }}>
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
              <h3 className="font-bold text-lg" style={{ color: theme.textPrimary }}>Agenda de hoje</h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>{bookings.length} horários confirmados</p>
            </div>
            <button className="flex items-center gap-1 text-xs font-semibold" style={{ color: theme.accent }}>
              Ver semana <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {bookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Calendar className="w-8 h-8" />
                </div>
                <p className="empty-state-title">Nenhum agendamento hoje</p>
                <p className="empty-state-text">Os clientes que agendarem aparecerão aqui.</p>
              </div>
            ) : (
              bookings.map((item) => (
                <div key={item.id} className="agenda-item flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-[var(--theme-bg-hover)]" style={{ borderColor: theme.border }}>
                  <span className="agenda-time font-bold text-sm w-12 flex-shrink-0" style={{ color: theme.accent }}>{formatTime(item.scheduled_at)}</span>
                  <div className="flex-1 truncate">
                    <p className="font-semibold text-sm truncate" style={{ color: theme.textPrimary }}>{item.customers?.name || 'Cliente anônimo'}</p>
                    <p className="text-xs truncate" style={{ color: theme.textMuted }}>
                      {item.services?.name || 'Serviço'} · com {item.professionals?.name || 'Equipe'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: theme.textSecondary }}>
                    {formatCurrency(item.amount_total || 0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* Semana card (Mock still for visual placeholder) */}
          <div className="glass-card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4" style={{ color: theme.accent }} />
              <span className="text-xs" style={{ color: theme.textSecondary }}>Semana (Simulado)</span>
            </div>
            <p className="font-serif text-3xl font-bold mb-0.5" style={{ color: theme.textPrimary }}>R$ 2.410</p>
            <p className="text-xs mb-5" style={{ color: theme.textMuted }}>faturamento previsto</p>

            {/* Mini bar chart */}
            <div className="flex items-end gap-1.5 h-16">
              {weekHeights.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="chart-bar w-full"
                    style={{ height: `${h}%`, opacity: i === weekHeights.indexOf(Math.max(...weekHeights)) ? 1 : 0.45, background: theme.accent, borderRadius: '2px' }}
                  />
                  <span className="text-[9px]" style={{ color: theme.textMuted }}>{weekDays[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Serviços (Mock placeholder) */}
          <div className="glass-card p-5">
            <h4 className="font-bold text-sm mb-4" style={{ color: theme.textPrimary }}>Top serviços (Simulado)</h4>
            <div className="space-y-3">
              {topServices.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: theme.textSecondary }}>{s.name}</span>
                    <span className="font-semibold" style={{ color: theme.textPrimary }}>{s.pct}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: theme.inputBg }}>
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: theme.accent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
