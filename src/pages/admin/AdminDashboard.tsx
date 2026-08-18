import { useQuery } from '@tanstack/react-query';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
import { motion } from 'framer-motion';
import {
  Building2, CheckCircle, Ban, Clock, XCircle,
  Users, UserCheck, Briefcase, Calendar,
  DollarSign, TrendingUp, BarChart3, CreditCard,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import AdminPageHeader from './components/AdminPageHeader';
import { AdminCardsSkeleton } from './components/AdminSkeleton';
import AdminEmptyState from './components/AdminEmptyState';
import AdminBadge from './components/AdminBadge';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  tenants: {
    total: number;
    active: number;
    blocked: number;
    trial: number;
    canceled: number;
  };
  users: {
    total: number;
    clients: number;
    professionals: number;
  };
  bookings: {
    total: number;
  };
  revenue: {
    monthly: number;
    annual: number;
    total: number;
    avgTicket: number;
  };
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    business_type: string;
    created_at: string;
  }>;
}

// ── Queries ──────────────────────────────────────────────────────────────────
async function fetchDashboardStats(): Promise<DashboardStats> {
  const [
    { data: tenants },
    { data: profiles },
    { count: totalBookings },
    { data: recentTenants },
    { data: subs },
  ] = await Promise.all([
    supabase.from('tenants').select('status'),
    supabase.from('profiles').select('role'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('id,name,slug,status,business_type,created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('subscriptions').select('status, plans(plan_prices(amount, currency))').eq('status', 'active'),
  ]);

  const tenantList = tenants ?? [];
  const profileList = profiles ?? [];
  const subsList = (subs ?? []) as any[];

  // Revenue calculation from active subscriptions
  let monthlyRevenue = 0;
  subsList.forEach((sub) => {
    const prices: any[] = sub.plans?.plan_prices ?? [];
    const brlPrice = prices.find((p: any) => p.currency === 'BRL') ?? prices[0];
    if (brlPrice) monthlyRevenue += Number(brlPrice.amount ?? 0);
  });

  return {
    tenants: {
      total: tenantList.length,
      active: tenantList.filter(t => t.status === 'active').length,
      blocked: tenantList.filter(t => t.status === 'blocked').length,
      trial: tenantList.filter(t => t.status === 'trial').length,
      canceled: tenantList.filter(t => t.status === 'canceled').length,
    },
    users: {
      total: profileList.length,
      clients: profileList.filter(p => p.role === 'client').length,
      professionals: profileList.filter(p => p.role === 'professional').length,
    },
    bookings: {
      total: totalBookings ?? 0,
    },
    revenue: {
      monthly: monthlyRevenue,
      annual: monthlyRevenue * 12,
      total: monthlyRevenue * 12,
      avgTicket: subsList.length > 0 ? monthlyRevenue / subsList.length : 0,
    },
    recentTenants: recentTenants ?? [],
  };
}

// ── Components ────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent?: string;
  delay?: number;
}

function StatCard({ icon: Icon, label, value, sub, accent = '#7c3aed', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#2a2a2a] transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium text-[#555] uppercase tracking-wider">{label}</p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity"
          style={{ background: `${accent}18` }}
        >
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-[#444]">{sub}</p>}
    </motion.div>
  );
}

function BusinessTypeLabel(type: string) {
  const map: Record<string, string> = {
    barbearia: 'Barbearia',
    salao: 'Salão',
    esmalteria: 'Esmalteria',
  };
  return map[type] ?? type;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin_dashboard_stats'],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 2, // 2 min cache
  });

  const fmt = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Dashboard" subtitle="Visão global da plataforma" icon={<BarChart3 className="w-5 h-5" />} />
        <AdminCardsSkeleton cols={5} />
        <AdminCardsSkeleton cols={4} />
        <AdminCardsSkeleton cols={3} />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Dashboard" subtitle="Visão global da plataforma" icon={<BarChart3 className="w-5 h-5" />} />
        <AdminEmptyState
          title="Erro ao carregar dados"
          description="Não foi possível conectar ao banco de dados. Verifique a conexão com o Supabase."
          icon={<Ban className="w-7 h-7" />}
        />
      </div>
    );
  }

  const { tenants, users, bookings, revenue, recentTenants } = stats;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Visão global da plataforma"
        icon={<BarChart3 className="w-5 h-5" />}
      />

      {/* ── Empresas ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-[#333] mb-3">Empresas</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Building2}   label="Total"      value={tenants.total}    accent="#7c3aed" delay={0}    />
          <StatCard icon={CheckCircle} label="Ativas"     value={tenants.active}   accent="#10b981" delay={0.05} sub={`${tenants.total > 0 ? Math.round(tenants.active / tenants.total * 100) : 0}% do total`} />
          <StatCard icon={Clock}       label="Em Trial"   value={tenants.trial}    accent="#f59e0b" delay={0.1}  />
          <StatCard icon={Ban}         label="Bloqueadas" value={tenants.blocked}  accent="#ef4444" delay={0.15} />
          <StatCard icon={XCircle}     label="Canceladas" value={tenants.canceled} accent="#6b7280" delay={0.2}  />
        </div>
      </section>

      {/* ── Usuários ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-[#333] mb-3">Usuários</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard icon={Users}      label="Total de Usuários"  value={users.total}         accent="#3b82f6" delay={0.25} />
          <StatCard icon={UserCheck}  label="Clientes"           value={users.clients}       accent="#06b6d4" delay={0.3}  />
          <StatCard icon={Briefcase}  label="Profissionais"      value={users.professionals} accent="#8b5cf6" delay={0.35} />
        </div>
      </section>

      {/* ── Agendamentos + Receita ── */}
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-[#333] mb-3">Agendamentos & Receita</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Calendar}    label="Agendamentos"   value={bookings.total}         accent="#7c3aed"  delay={0.4}  />
          <StatCard icon={DollarSign}  label="MRR"            value={fmt(revenue.monthly)}   accent="#10b981"  delay={0.45} sub="Receita mensal recorrente" />
          <StatCard icon={TrendingUp}  label="ARR"            value={fmt(revenue.annual)}    accent="#06b6d4"  delay={0.5}  sub="Receita anual projetada" />
          <StatCard icon={CreditCard}  label="Ticket Médio"   value={fmt(revenue.avgTicket)} accent="#f59e0b"  delay={0.55} sub="Por assinatura ativa" />
        </div>
      </section>

      {/* ── Últimas Empresas ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#333]">Empresas Recentes</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
          {recentTenants.length === 0 ? (
            <AdminEmptyState
              title="Nenhuma empresa cadastrada"
              description="Quando uma barbearia ou salão se cadastrar, aparecerá aqui."
              icon={<Building2 className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-[#111]">
              {recentTenants.map((tenant, i) => (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-[#111] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#666]">
                        {tenant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{tenant.name}</p>
                      <p className="text-xs text-[#444]">{getTenantPublicUrl(tenant.slug).replace(/^https?:\/\//, '')} · {BusinessTypeLabel(tenant.business_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AdminBadge value={tenant.status} dot />
                    <p className="text-xs text-[#333] hidden md:block">
                      {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
