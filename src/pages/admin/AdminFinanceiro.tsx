import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Clock, XCircle, Calendar, Filter
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import AdminBadge from './components/AdminBadge';
import { AdminCardsSkeleton } from './components/AdminSkeleton';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FinancialStats {
  monthly: number;
  annual: number;
  total: number;
  avgTicket: number;
  activeCount: number;
  delinquent: Array<{ id: string; name: string; slug: string; plan: string; since: string }>;
  trials: Array<{ id: string; name: string; slug: string; trialEnds: string }>;
  canceled: Array<{ id: string; name: string; slug: string; canceledAt: string }>;
  upcoming: Array<{ id: string; name: string; slug: string; plan: string; renewsAt: string }>;
}

async function fetchFinancialStats(year: number, month: number): Promise<FinancialStats> {
  const [{ data: subs }, { data: tenants }] = await Promise.all([
    supabase.from('subscriptions').select(`
      id, status, trial_ends_at, current_period_end, tenant_id,
      plans (name, plan_prices (amount, currency))
    `),
    supabase.from('tenants').select('id, name, slug, status, created_at'),
  ]);

  const subList = (subs ?? []) as any[];
  const tenantList = (tenants ?? []) as any[];

  const tenantMap = new Map(tenantList.map(t => [t.id, t]));

  // Revenue from active subscriptions (BRL)
  const activeSubs = subList.filter(s => s.status === 'active');
  let monthlyRevenue = 0;
  activeSubs.forEach(sub => {
    const prices = sub.plans?.plan_prices ?? [];
    const brl = prices.find((p: any) => p.currency === 'BRL') ?? prices[0];
    if (brl) monthlyRevenue += Number(brl.amount ?? 0);
  });

  // Delinquent = subscriptions that are suspended/blocked but tenant still exists
  const delinquent = subList
    .filter(s => s.status === 'past_due' || s.status === 'unpaid')
    .map(s => {
      const tenant = tenantMap.get(s.tenant_id);
      return tenant ? {
        id: s.tenant_id,
        name: tenant.name,
        slug: tenant.slug,
        plan: s.plans?.name ?? '—',
        since: s.current_period_end ?? s.trial_ends_at ?? '',
      } : null;
    }).filter(Boolean) as any[];

  // Trials
  const trialSubs = subList.filter(s => s.status === 'trial');
  const trials = trialSubs.map(s => {
    const tenant = tenantMap.get(s.tenant_id);
    return tenant ? {
      id: s.tenant_id,
      name: tenant.name,
      slug: tenant.slug,
      trialEnds: s.trial_ends_at ?? '',
    } : null;
  }).filter(Boolean) as any[];

  // Canceled
  const canceledTenants = tenantList.filter(t => t.status === 'canceled').slice(0, 10);
  const canceled = canceledTenants.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    canceledAt: t.created_at,
  }));

  // Upcoming renewals (next 30 days)
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = subList
    .filter(s => {
      if (!s.current_period_end) return false;
      const d = new Date(s.current_period_end);
      return d >= now && d <= in30 && s.status === 'active';
    })
    .map(s => {
      const tenant = tenantMap.get(s.tenant_id);
      return tenant ? {
        id: s.tenant_id,
        name: tenant.name,
        slug: tenant.slug,
        plan: s.plans?.name ?? '—',
        renewsAt: s.current_period_end,
      } : null;
    }).filter(Boolean).slice(0, 10) as any[];

  return {
    monthly: monthlyRevenue,
    annual: monthlyRevenue * 12,
    total: monthlyRevenue * 12,
    avgTicket: activeSubs.length > 0 ? monthlyRevenue / activeSubs.length : 0,
    activeCount: activeSubs.length,
    delinquent,
    trials,
    canceled,
    upcoming,
  };
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, delay = 0 }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#222] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[#444] uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-[#333]">{sub}</p>}
    </motion.div>
  );
}

// ── List Section ──────────────────────────────────────────────────────────────
function ListSection({ title, icon: Icon, children, empty }: {
  title: string; icon: React.ElementType;
  children: React.ReactNode; empty: boolean;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#111]">
        <Icon className="w-4 h-4 text-[#444]" />
        <h3 className="text-sm font-semibold text-[#888]">{title}</h3>
      </div>
      {empty ? (
        <div className="py-8 text-center">
          <p className="text-xs text-[#333]">Nenhum registro encontrado</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminFinanceiro() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin_financeiro', year, month],
    queryFn: () => fetchFinancialStats(year, month),
    staleTime: 1000 * 60 * 2,
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const daysUntil = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 0 ? 'Vencido' : `${diff}d`;
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Financeiro"
        subtitle="Receita e métricas financeiras da plataforma"
        icon={<DollarSign className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-xs text-[#888] outline-none focus:border-[#333]"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-xs text-[#888] outline-none focus:border-[#333]"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        }
      />

      {isLoading ? (
        <AdminCardsSkeleton cols={4} />
      ) : !stats ? (
        <AdminEmptyState title="Erro ao carregar dados" description="Verifique a conexão com o Supabase." icon={<AlertCircle className="w-6 h-6" />} />
      ) : (
        <>
          {/* Revenue Cards */}
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-[#333] mb-3">Receita</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="MRR" value={fmt(stats.monthly)} icon={DollarSign} color="#10b981" delay={0} sub={`${stats.activeCount} assinaturas ativas`} />
              <StatCard label="ARR" value={fmt(stats.annual)} icon={TrendingUp} color="#3b82f6" delay={0.05} sub="Projeção anual" />
              <StatCard label="Receita Total" value={fmt(stats.total)} icon={DollarSign} color="#7c3aed" delay={0.1} sub="Acumulado estimado" />
              <StatCard label="Ticket Médio" value={fmt(stats.avgTicket)} icon={TrendingUp} color="#f59e0b" delay={0.15} sub="Por assinatura" />
            </div>
          </section>

          {/* Status Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming Renewals */}
            <ListSection title={`Renovações Próximas (${stats.upcoming.length})`} icon={Calendar} empty={stats.upcoming.length === 0}>
              <div className="divide-y divide-[#0d0d0d]">
                {stats.upcoming.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#0f0f0f] transition-colors">
                    <div>
                      <p className="text-sm text-white font-medium">{item.name}</p>
                      <p className="text-xs text-[#444]">{item.plan}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-amber-400 font-medium">{daysUntil(item.renewsAt)}</p>
                      <p className="text-[10px] text-[#333]">{fmtDate(item.renewsAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ListSection>

            {/* Trials */}
            <ListSection title={`Em Trial (${stats.trials.length})`} icon={Clock} empty={stats.trials.length === 0}>
              <div className="divide-y divide-[#0d0d0d]">
                {stats.trials.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#0f0f0f] transition-colors">
                    <div>
                      <p className="text-sm text-white font-medium">{item.name}</p>
                      <p className="text-xs text-[#444]">/{item.slug}</p>
                    </div>
                    <div className="text-right">
                      <AdminBadge variant="trial" label="Trial" dot />
                      <p className="text-[10px] text-[#333] mt-1">Expira {fmtDate(item.trialEnds)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ListSection>

            {/* Delinquent */}
            <ListSection title={`Inadimplentes (${stats.delinquent.length})`} icon={AlertCircle} empty={stats.delinquent.length === 0}>
              <div className="divide-y divide-[#0d0d0d]">
                {stats.delinquent.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#0f0f0f] transition-colors">
                    <div>
                      <p className="text-sm text-white font-medium">{item.name}</p>
                      <p className="text-xs text-[#444]">{item.plan}</p>
                    </div>
                    <AdminBadge variant="suspended" label="Inadimplente" dot />
                  </div>
                ))}
              </div>
            </ListSection>

            {/* Canceled */}
            <ListSection title={`Canceladas (${stats.canceled.length})`} icon={XCircle} empty={stats.canceled.length === 0}>
              <div className="divide-y divide-[#0d0d0d]">
                {stats.canceled.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#0f0f0f] transition-colors">
                    <div>
                      <p className="text-sm text-white font-medium">{item.name}</p>
                      <p className="text-xs text-[#444]">/{item.slug}</p>
                    </div>
                    <AdminBadge variant="canceled" label="Cancelada" dot />
                  </div>
                ))}
              </div>
            </ListSection>
          </div>
        </>
      )}
    </div>
  );
}
