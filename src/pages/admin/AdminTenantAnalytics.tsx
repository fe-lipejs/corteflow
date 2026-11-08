import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  Layers,
  LayoutDashboard,
  Loader2,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  Building2,
  Activity,
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
import AdminBadge from './components/AdminBadge';

export type PeriodPreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

type AnalyticsTab =
  | 'overview'
  | 'portal'
  | 'funnel'
  | 'bookings'
  | 'financial'
  | 'customers'
  | 'devices'
  | 'admin_usage';

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(val || 0));

const fmtDuration = (seconds: number | null | undefined) => {
  const s = Math.round(Number(seconds || 0));
  if (s <= 0) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
};

function calcDelta(curr: number, prev: number): { label: string; positive: boolean | null } {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (p === 0 && c === 0) return { label: 'Sem variação vs período anterior', positive: null };
  if (p === 0 && c > 0) return { label: 'Novo no período (0 no anterior)', positive: true };
  const pct = Math.round(((c - p) / p) * 100);
  if (pct === 0) return { label: '0% vs período anterior', positive: null };
  return {
    label: `${pct > 0 ? '+' : ''}${pct}% em relação ao período anterior`,
    positive: pct > 0,
  };
}

export function resolvePeriodDates(
  preset: PeriodPreset,
  customStart: string,
  customEnd: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Hoje' };
    case '7d':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: 'Últimos 7 dias' };
    case '30d':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), label: 'Últimos 30 dias' };
    case '90d':
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now), label: 'Últimos 90 dias' };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfDay(now), label: 'Este mês' };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm), label: 'Mês anterior' };
    }
    case 'this_year':
      return { start: startOfYear(now), end: endOfDay(now), label: 'Este ano' };
    case 'custom': {
      const s = customStart ? startOfDay(new Date(customStart + 'T00:00:00')) : startOfDay(subDays(now, 29));
      const e = customEnd ? endOfDay(new Date(customEnd + 'T00:00:00')) : endOfDay(now);
      return { start: s, end: e, label: 'Período personalizado' };
    }
  }
}

export default function AdminTenantAnalytics() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState<string>(() =>
    format(subDays(new Date(), 29), 'yyyy-MM-dd')
  );
  const [customEnd, setCustomEnd] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [selectedProId, setSelectedProId] = useState<string>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');

  const periodRange = useMemo(
    () => resolvePeriodDates(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  // Carregar lista de profissionais e serviços do salão para filtros cruzados
  const { data: catalogFilters } = useQuery({
    queryKey: ['admin_tenant_catalog_filters', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: pros }, { data: svcs }] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, name')
          .eq('tenant_id', tenantId!)
          .order('name'),
        supabase
          .from('services')
          .select('id, name')
          .eq('tenant_id', tenantId!)
          .order('name'),
      ]);
      return {
        professionals: pros || [],
        services: svcs || [],
      };
    },
  });

  // Consulta principal agregada no banco via RPC
  const {
    data: analytics,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'raffros_tenant_analytics',
      tenantId,
      periodRange.start.toISOString(),
      periodRange.end.toISOString(),
      selectedProId,
      selectedServiceId,
    ],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error: rpcErr } = await supabase.rpc('get_raffros_tenant_analytics', {
        p_tenant_id: tenantId,
        p_start: periodRange.start.toISOString(),
        p_end: periodRange.end.toISOString(),
        p_pro_id: selectedProId === 'all' ? null : selectedProId,
        p_service_id: selectedServiceId === 'all' ? null : selectedServiceId,
      });
      if (rpcErr) throw rpcErr;
      return data as any;
    },
  });

  const tenant = analytics?.tenant;
  const curr = analytics?.overview?.current || {};
  const prev = analytics?.overview?.previous || {};
  const funnel = analytics?.funnel || {};
  const clicks = analytics?.clicks || {};
  const dwell = analytics?.dwell || {};
  const payments: any[] = analytics?.payments || [];
  const temporal = analytics?.temporal || {};
  const financial = analytics?.financial || {};
  const devices = analytics?.devices || { portal: [], admin: [] };
  const adminBehavior = analytics?.admin_behavior || {};

  // Insights automáticos baseados exclusivamente nos dados reais do período
  const executiveSummaryBullets = useMemo(() => {
    if (!analytics) return [];
    const bullets: string[] = [];
    const totalBk = Number(curr.total_bookings || 0);
    const onlineBk = Number(curr.online_bookings || 0);
    const manualBk = Number(curr.manual_bookings || 0);
    const portalSessions = Number(curr.portal_sessions || 0);

    if (portalSessions > 0) {
      const conv = ((onlineBk / portalSessions) * 100).toFixed(1);
      bullets.push(
        `${portalSessions} sessão(ões) no portal público e ${onlineBk} agendamento(s) online concluídos (${conv}% de conversão).`
      );
    } else if (onlineBk > 0) {
      bullets.push(
        `${onlineBk} agendamento(s) realizados pelo portal público (instrumentação de sessões de visita iniciada agora).`
      );
    } else {
      bullets.push('Nenhum acesso ao portal público registrado neste período.');
    }

    if (totalBk > 0) {
      const onlinePct = Math.round((onlineBk / totalBk) * 100);
      const manualPct = 100 - onlinePct;
      bullets.push(
        `${onlinePct}% dos agendamentos vieram do portal (${onlineBk}) e ${manualPct}% foram cadastrados manualmente (${manualBk}).`
      );
    }

    const byWeekday: any[] = temporal.by_weekday || [];
    if (byWeekday.length > 0) {
      const sortedDays = [...byWeekday].sort((a, b) => b.bookings_count - a.bookings_count);
      if (sortedDays[0]?.bookings_count > 0) {
        bullets.push(
          `${WEEKDAY_NAMES[sortedDays[0].weekday]} é o dia mais movimentado (${sortedDays[0].bookings_count} agendamento(s)).`
        );
      }
    }

    const byHour: any[] = temporal.by_hour || [];
    if (byHour.length > 0) {
      const sortedHours = [...byHour].sort((a, b) => b.bookings_count - a.bookings_count);
      if (sortedHours[0]?.bookings_count > 0) {
        bullets.push(
          `${String(sortedHours[0].hour).padStart(2, '0')}:00 é o horário mais procurado (${sortedHours[0].bookings_count} reserva(s)).`
        );
      }
    }

    if (payments.length > 0) {
      const totalPayBk = payments.reduce((acc, p) => acc + Number(p.total_bookings || 0), 0);
      if (totalPayBk > 0) {
        const topPay = payments[0];
        const pct = Math.round((Number(topPay.total_bookings) / totalPayBk) * 100);
        bullets.push(
          `${topPay.modality} representa ${pct}% das preferências registradas (${fmtCurrency(topPay.received_amount)} recebidos).`
        );
      }
    }

    const portalDevices: any[] = devices.portal || [];
    if (portalDevices.length > 0) {
      const totalDevSess = portalDevices.reduce((acc, d) => acc + Number(d.sessions || 0), 0);
      if (totalDevSess > 0) {
        const parts = portalDevices
          .slice(0, 3)
          .map((d) => `${Math.round((Number(d.sessions) / totalDevSess) * 100)}% por ${d.platform}`);
        bullets.push(`Acessos ao portal por dispositivo: ${parts.join(', ')}.`);
      }
    }

    return bullets;
  }, [analytics, curr, temporal, payments, devices]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">Carregando inteligência de dados do estabelecimento...</p>
      </div>
    );
  }

  if (error || !analytics || !tenant) {
    return (
      <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-8 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Não foi possível carregar as métricas</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          {(error as any)?.message || 'Verifique se o estabelecimento existe e se você possui permissão de Super Admin.'}
        </p>
        <button
          onClick={() => navigate('/platform/tenants')}
          className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 cursor-pointer"
        >
          Voltar para Empresas
        </button>
      </div>
    );
  }

  const totalBookings = Number(curr.total_bookings || 0);
  const onlineBookings = Number(curr.online_bookings || 0);
  const manualBookings = Number(curr.manual_bookings || 0);
  const portalSessions = Number(curr.portal_sessions || 0);
  const portalConversionRate =
    portalSessions > 0 ? Math.min(100, Number(((onlineBookings / portalSessions) * 100).toFixed(1))) : null;

  return (
    <div className="space-y-6 pb-16 text-zinc-100">
      {/* ── Top Bar & Store Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <button
            onClick={() => navigate('/platform/tenants')}
            className="w-9 h-9 rounded-xl bg-[#0B0B0E] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-colors shrink-0 cursor-pointer"
            title="Voltar para Empresas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold text-emerald-400">
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                Raffros Analytics
              </span>
              <AdminBadge value={tenant.status} dot />
              <span className="text-xs text-zinc-500 capitalize">· {tenant.business_type}</span>
              <span className="text-xs text-zinc-500">
                · Operando há {tenant.operating_days} dia{tenant.operating_days === 1 ? '' : 's'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-1 flex items-center gap-2">
              <span>{tenant.name}</span>
              <a
                href={getTenantPublicUrl(tenant.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-normal text-zinc-400 hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                title="Abrir portal público do estabelecimento"
              >
                <span>/{tenant.slug}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/platform/intelligence"
            className="px-3.5 py-2 rounded-xl bg-[#0B0B0E] border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-emerald-500/40 transition-all flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analytics Global</span>
          </Link>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl bg-[#0B0B0E] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filtros de Período, Profissional e Serviço ── */}
      <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: 'Hoje' },
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: '90d', label: '90 dias' },
              { id: 'this_month', label: 'Este mês' },
              { id: 'last_month', label: 'Mês anterior' },
              { id: 'this_year', label: 'Este ano' },
              { id: 'custom', label: 'Personalizado' },
            ] as { id: PeriodPreset; label: string }[]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                preset === p.id
                  ? 'bg-emerald-500 text-black font-bold shadow-xs'
                  : 'bg-[#13131A] text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-white"
              />
              <span className="text-xs text-zinc-500">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-white"
              />
            </div>
          )}

          {/* Filtro por Profissional */}
          <select
            value={selectedProId}
            onChange={(e) => setSelectedProId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-zinc-200 outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os profissionais</option>
            {(catalogFilters?.professionals || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Filtro por Serviço */}
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-zinc-200 outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os serviços</option>
            {(catalogFilters?.services || []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Navegação das 8 Abas do Estabelecimento (Seção 12) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
        {(
          [
            { id: 'overview', label: '1. Visão Geral', icon: LayoutDashboard },
            { id: 'portal', label: '2. Portal & Cliques', icon: MousePointerClick },
            { id: 'funnel', label: '3. Conversão & Desistências', icon: Target },
            { id: 'bookings', label: '4. Agendamentos & Horários', icon: Calendar },
            { id: 'financial', label: '5. Financeiro & Pagamentos', icon: DollarSign },
            { id: 'customers', label: '6. Clientes', icon: Users },
            { id: 'devices', label: '7. Dispositivos', icon: Smartphone },
            { id: 'admin_usage', label: '8. Uso do Painel Admin', icon: Activity },
          ] as { id: AnalyticsTab; label: string; icon: any }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                active
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 1: VISÃO GERAL (SEÇÃO 2 & 12)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Resumo Executivo Inteligente */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Resumo Executivo — {tenant.name} ({periodRange.label})</span>
              </h3>
              <span className="text-[11px] text-zinc-500">
                {format(periodRange.start, 'dd/MM/yyyy')} a {format(periodRange.end, 'dd/MM/yyyy')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {executiveSummaryBullets.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-zinc-300 bg-[#13131A] border border-white/5 rounded-xl p-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 14 Indicadores Principais com Comparativo de Período Anterior */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                label: 'Total de Agendamentos',
                value: totalBookings,
                delta: calcDelta(totalBookings, prev.total_bookings),
                sub: `${curr.completed_bookings || 0} concluídos · ${curr.canceled_bookings || 0} cancelados`,
              },
              {
                label: 'Agendamentos pelo Portal',
                value: onlineBookings,
                delta: calcDelta(onlineBookings, prev.online_bookings),
                sub:
                  totalBookings > 0
                    ? `${Math.round((onlineBookings / totalBookings) * 100)}% do total de reservas`
                    : 'Nenhuma reserva no período',
              },
              {
                label: 'Cadastrados Manualmente',
                value: manualBookings,
                delta: calcDelta(manualBookings, prev.manual_bookings),
                sub:
                  totalBookings > 0
                    ? `${Math.round((manualBookings / totalBookings) * 100)}% do total de reservas`
                    : 'Nenhuma reserva manual',
              },
              {
                label: 'Taxa de Conversão do Portal',
                value: portalConversionRate !== null ? `${portalConversionRate}%` : 'Aguardando tráfego',
                delta: {
                  label:
                    portalSessions > 0
                      ? `${onlineBookings} reservas em ${portalSessions} sessões`
                      : 'Sem sessões de visita no período',
                  positive: portalConversionRate && portalConversionRate > 0 ? true : null,
                },
                sub: `${curr.portal_views || 0} visualizações de página`,
              },
              {
                label: 'Receita Efetivamente Recebida',
                value: fmtCurrency(curr.received_revenue),
                delta: calcDelta(curr.received_revenue, prev.received_revenue),
                sub: `Previsto em agenda: ${fmtCurrency(curr.scheduled_value)}`,
              },
              {
                label: 'Valor Médio por Agendamento',
                value: fmtCurrency(curr.avg_ticket),
                delta: calcDelta(curr.avg_ticket, prev.avg_ticket),
                sub: `Pendente a receber: ${fmtCurrency(curr.pending_revenue)}`,
              },
              {
                label: 'Agendamentos Confirmados',
                value: Number(curr.confirmed_bookings || 0),
                delta: calcDelta(curr.confirmed_bookings, prev.confirmed_bookings),
                sub: `${curr.pending_bookings || 0} aguardando confirmação`,
              },
              {
                label: 'Agendamentos Concluídos',
                value: Number(curr.completed_bookings || 0),
                delta: calcDelta(curr.completed_bookings, prev.completed_bookings),
                sub: `${curr.no_show_bookings || 0} não compareceram (no-show)`,
              },
              {
                label: 'Agendamentos Pendentes',
                value: Number(curr.pending_bookings || 0),
                delta: calcDelta(curr.pending_bookings, prev.pending_bookings),
                sub: 'Reservas aguardando confirmação',
              },
              {
                label: 'Agendamentos Cancelados',
                value: Number(curr.canceled_bookings || 0),
                delta: calcDelta(curr.canceled_bookings, prev.canceled_bookings),
                sub: `Valor cancelado/reemb.: ${fmtCurrency(curr.canceled_refunded_value)}`,
              },
              {
                label: 'Clientes Novos no Período',
                value: Number(curr.new_customers || 0),
                delta: { label: 'Primeiro atendimento no período', positive: null },
                sub: 'Clientes estreantes na loja',
              },
              {
                label: 'Clientes Recorrentes',
                value: Number(curr.recurring_customers || 0),
                delta: { label: 'Clientes com histórico anterior', positive: true },
                sub: 'Retornaram no período selecionado',
              },
              {
                label: 'Acessos ao Portal Público',
                value: portalSessions,
                delta: calcDelta(portalSessions, prev.portal_sessions),
                sub: `${curr.portal_views || 0} eventos de página no portal`,
              },
              {
                label: 'Acessos ao Painel Admin',
                value: Number(curr.admin_sessions || 0),
                delta: calcDelta(curr.admin_sessions, prev.admin_sessions),
                sub: `${curr.admin_views || 0} telas abertas pelo salão`,
              },
            ].map((card, i) => (
              <div
                key={i}
                className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-white mt-2 tracking-tight">{card.value}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1">
                  <p
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      card.delta.positive === true
                        ? 'text-emerald-400'
                        : card.delta.positive === false
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                    }`}
                  >
                    {card.delta.positive === true && <TrendingUp className="w-3 h-3 shrink-0" />}
                    {card.delta.positive === false && <TrendingDown className="w-3 h-3 shrink-0" />}
                    <span>{card.delta.label}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 2: PORTAL DO CLIENTE — ONDE CLICAM E TEMPO DE PERMANÊNCIA (SEÇÃO 4 & 6)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'portal' && (
        <div className="space-y-6">
          {/* Tempo de Permanência Ativo no Portal (Seção 6) */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Tempo de Permanência Ativo no Portal</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Contabiliza apenas o tempo com interação ativa (suspende automaticamente após 60s de inatividade).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400">Tempo médio por sessão</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {fmtDuration(dwell.avg_session_seconds)}
                </p>
              </div>
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400">Tempo mediano por sessão</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {fmtDuration(dwell.median_session_seconds)}
                </p>
              </div>
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400">Tempo médio até escolher horário</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {fmtDuration(dwell.avg_time_to_select_time_seconds)}
                </p>
              </div>
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400">Entrada até concluir agendamento</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {fmtDuration(dwell.avg_time_to_complete_seconds)}
                </p>
              </div>
            </div>

            {/* Tempo médio em cada etapa */}
            {(dwell.step_durations || []).length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Tempo médio ativo em cada etapa
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(dwell.step_durations || []).map((st: any) => {
                    const stepLabels: Record<string, string> = {
                      service_step: 'Etapa 1: Escolha do Serviço',
                      professional_step: 'Etapa 2: Escolha do Profissional',
                      datetime_step: 'Etapa 3: Data e Horário',
                      checkout_step: 'Etapa 4: Dados e Pagamento',
                    };
                    return (
                      <div
                        key={st.step_name}
                        className="bg-[#13131A] border border-white/5 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">
                            {stepLabels[st.step_name] || st.step_name}
                          </p>
                          <p className="text-[11px] text-zinc-500">{st.sessions} sessões</p>
                        </div>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          {fmtDuration(st.avg_seconds)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rankings de Cliques: Elementos, Serviços, Profissionais e Horários */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Elementos mais clicados */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-emerald-400" />
                  <span>Elementos e Botões Mais Clicados no Portal</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Mapa de calor por elemento interativo do portal público.
                </p>
              </div>

              {(clicks.top_elements || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  Ainda não há cliques registrados neste período. Os novos acessos ao portal alimentarão este ranking automaticamente.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(clicks.top_elements || []).map((el: any, idx: number) => {
                    const maxClicks = Number(clicks.top_elements[0]?.total_clicks || 1);
                    const pct = Math.max(6, Math.round((Number(el.total_clicks) / maxClicks) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200 font-medium truncate pr-2">{el.label}</span>
                          <span className="font-mono text-zinc-300 shrink-0">
                            <strong>{el.total_clicks}</strong> cliques ({el.unique_sessions} sessões)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#13131A] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detector de Cliques Repetidos (Dificuldade de Utilização) */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Cliques Repetidos na Mesma Sessão (Pontos de Atrito)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Elementos clicados 3 ou mais vezes pela mesma pessoa, indicando dúvida ou dificuldade.
                </p>
              </div>

              {(clicks.repeated_clicks || []).length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">
                    Nenhum comportamento de clique repetido detectado no período.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(clicks.repeated_clicks || []).map((rc: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#13131A] border border-amber-500/20 rounded-xl p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white">{rc.label}</p>
                        <p className="text-[11px] text-zinc-400">
                          {rc.affected_sessions} sessão(ões) clicaram repetidamente
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-mono font-bold">
                        {rc.total_repeated_clicks} cliques
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Horários mais clicados no portal */}
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Horários mais clicados durante a escolha
                </p>
                {(clicks.top_hours_clicked || []).length === 0 ? (
                  <p className="text-xs text-zinc-500">Sem cliques de horário registrados no período.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(clicks.top_hours_clicked || []).map((h: any, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#13131A] border border-white/10 text-xs font-mono text-zinc-200"
                      >
                        {h.time_slot}: <strong className="text-emerald-400">{h.clicks}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 3: FUNIL DE CONVERSÃO E PONTOS DE DESISTÊNCIA (SEÇÃO 3)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Funil de Conversão do Portal Público</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Progressão etapa por etapa das sessões no portal até a conclusão do agendamento.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {funnel.tracked_sessions || 0} sessões rastreadas · {onlineBookings} agendamentos online no banco
              </span>
            </div>

            {Number(funnel.portal_access || 0) === 0 ? (
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-white">
                  Coleta de Funil Ativa — Aguardando novos visitantes no portal
                </p>
                <p className="text-xs text-zinc-400 max-w-xl mx-auto">
                  Este estabelecimento possui <strong>{onlineBookings} agendamento(s) online</strong> registrados no banco neste período. Conforme novos clientes navegarem por <strong>/{tenant.slug}</strong>, cada etapa abaixo exibirá a conversão exata entre os passos.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {(() => {
                  const base = Math.max(1, Number(funnel.portal_access || 1));
                  const completedCount = Math.max(
                    Number(funnel.booking_completed_events || 0),
                    Math.min(base, onlineBookings)
                  );
                  const stages = [
                    { label: '1. Acessaram o portal / Viram serviços', count: Number(funnel.portal_access || 0) },
                    { label: '2. Selecionaram um serviço', count: Number(funnel.service_selected || 0) },
                    { label: '3. Selecionaram um profissional', count: Number(funnel.professional_selected || 0) },
                    { label: '4. Escolheram data e horário', count: Number(funnel.datetime_selected || 0) },
                    { label: '5. Preencheram seus dados', count: Number(funnel.customer_data_filled || 0) },
                    { label: '6. Chegaram à etapa de pagamento/confirmação', count: Number(funnel.payment_step_reached || 0) },
                    { label: '7. Concluíram o agendamento', count: completedCount },
                  ];

                  return stages.map((st, idx) => {
                    const prevCount = idx === 0 ? st.count : stages[idx - 1].count;
                    const pctOfTotal = Math.min(100, Math.round((st.count / base) * 100));
                    const stepConv =
                      idx === 0 || prevCount === 0
                        ? 100
                        : Math.min(100, Math.round((st.count / prevCount) * 100));
                    const dropped = idx === 0 ? 0 : Math.max(0, prevCount - st.count);
                    const dropPct = idx === 0 || prevCount === 0 ? 0 : Math.round((dropped / prevCount) * 100);

                    return (
                      <div key={idx} className="bg-[#13131A] border border-white/5 rounded-xl p-3.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-white">{st.label}</span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-white font-bold">
                              {st.count} ({pctOfTotal}% do topo)
                            </span>
                            {idx > 0 && (
                              <span className="text-emerald-400">
                                {stepConv}% avançaram
                              </span>
                            )}
                            {dropped > 0 && (
                              <span className="text-rose-400">
                                -{dropped} ({dropPct}% saíram aqui)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-black/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.max(3, pctOfTotal)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Classificação de Saídas: Abandono Observável vs Sessão Encerrada sem Início */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Visitantes sem Iniciar Fluxo
              </p>
              <p className="text-2xl font-bold text-white mt-2">{funnel.bounced_sessions || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Apenas consultaram a página (preços/endereço/horários) e fecharam sem iniciar reserva.
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Desistências Observáveis no Fluxo
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-2">
                {funnel.observable_abandoned_sessions || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Iniciaram a escolha de serviço/profissional/horário, mas não finalizaram o agendamento.
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Abandono na Etapa Final (Dados/Pagamento)
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-2">
                {Number(funnel.drop_at_customer_data || 0) + Number(funnel.drop_at_payment || 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Escolheram data e horário, mas desistiram ao preencher dados ou pagar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 4: AGENDAMENTOS, ORIGEM E ANÁLISE TEMPORAL (SEÇÃO 7 & 9)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Origem dos Agendamentos: Portal Público vs Manual (Seção 9) */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Origem dos Agendamentos (Online vs Manual)</h3>
                <p className="text-xs text-zinc-400">
                  Proporção entre clientes que agendam sozinhos pelo portal vs cadastros manuais na agenda.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-300">Total: {totalBookings}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-400 font-bold uppercase">Portal Público (Online)</p>
                  <p className="text-2xl font-bold text-white mt-1">{onlineBookings}</p>
                </div>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {totalBookings > 0 ? Math.round((onlineBookings / totalBookings) * 100) : 0}%
                </span>
              </div>

              <div className="bg-[#13131A] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-bold uppercase">Painel Admin (Manual)</p>
                  <p className="text-2xl font-bold text-white mt-1">{manualBookings}</p>
                </div>
                <span className="text-lg font-mono font-bold text-zinc-300">
                  {totalBookings > 0 ? Math.round((manualBookings / totalBookings) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Distribuição por Dia da Semana e por Hora do Dia (Seção 7) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Dias da Semana */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Demanda por Dia da Semana</h3>
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                  const found = (temporal.by_weekday || []).find((d: any) => Number(d.weekday) === dow);
                  const count = Number(found?.bookings_count || 0);
                  const maxCount = Math.max(
                    1,
                    ...(temporal.by_weekday || []).map((d: any) => Number(d.bookings_count || 0))
                  );
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={dow} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-200 font-medium">{WEEKDAY_NAMES[dow]}</span>
                        <span className="font-mono text-zinc-300">
                          <strong>{count}</strong> reserva(s) · {fmtCurrency(found?.received_revenue || 0)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#13131A] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${count > 0 ? Math.max(6, pct) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribuição por Horário */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Horários com Maior e Menor Procura</h3>
              {(temporal.by_hour || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  Sem agendamentos no período selecionado.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(temporal.by_hour || []).map((h: any) => {
                    const count = Number(h.bookings_count || 0);
                    const maxH = Math.max(
                      1,
                      ...(temporal.by_hour || []).map((x: any) => Number(x.bookings_count || 0))
                    );
                    const pct = Math.round((count / maxH) * 100);
                    return (
                      <div key={h.hour} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono font-bold text-zinc-200">
                            {String(h.hour).padStart(2, '0')}:00
                          </span>
                          <span className="font-mono text-zinc-300">
                            <strong>{count}</strong> agendamento(s) ({h.completed_count} concluídos)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#13131A] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${count > 0 ? Math.max(6, pct) : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Evolução Semanal e Mensal (Sazonalidade) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Evolução por Semana no Período</h3>
              {(temporal.by_week || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">Sem dados semanais no período.</p>
              ) : (
                <div className="space-y-2">
                  {(temporal.by_week || []).map((w: any) => (
                    <div
                      key={w.week_start}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs"
                    >
                      <span className="font-mono text-zinc-300">Semana de {w.week_start}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-white font-bold">{w.bookings_count} reservas</span>
                        <span className="text-emerald-400">({w.online_count} online)</span>
                        <span className="text-zinc-300">{fmtCurrency(w.received_revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Evolução Mensal e Sazonalidade (12 meses)</h3>
              {(temporal.by_month || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">Sem histórico mensal disponível.</p>
              ) : (
                <div className="space-y-2">
                  {(temporal.by_month || []).map((m: any) => (
                    <div
                      key={m.month_key}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs"
                    >
                      <span className="font-mono font-bold text-zinc-200">{m.month_key}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-white font-bold">{m.bookings_count} reservas</span>
                        <span className="text-emerald-400">
                          {m.bookings_count > 0
                            ? `${Math.round((Number(m.online_count) / Number(m.bookings_count)) * 100)}% portal`
                            : '0% portal'}
                        </span>
                        <span className="text-zinc-300">{fmtCurrency(m.received_revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 5: FINANCEIRO E FORMAS DE PAGAMENTO (SEÇÃO 5 & 8)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          {/* 4 Pilares Financeiros Estritamente Separados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0B0B0E] border border-emerald-500/30 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                1. Receita Efetivamente Recebida
              </p>
              <p className="text-2xl font-bold text-white mt-2">
                {fmtCurrency(curr.received_revenue)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Atendimentos concluídos/pagos + entradas realizadas no caixa.
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                2. Valor dos Agendamentos (Previsto)
              </p>
              <p className="text-2xl font-bold text-white mt-2">
                {fmtCurrency(curr.scheduled_value)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Soma dos agendamentos ativos e concluídos no período.
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                3. Valor Pendente a Receber
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-2">
                {fmtCurrency(curr.pending_revenue)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Agendamentos marcados cujo pagamento ainda não foi liquidado.
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                4. Valor Cancelado ou Reembolsado
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-2">
                {fmtCurrency(curr.canceled_refunded_value)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Reservas canceladas ou estornadas no período.
              </p>
            </div>
          </div>

          {/* Formas de Pagamento (Seção 5) */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Formas de Pagamento Utilizadas pelos Clientes</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Separação entre modalidade escolhida, pagamentos aprovados/realizados, pendentes e cancelados.
              </p>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                Nenhum registro de pagamento no período selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px]">
                      <th className="py-2.5 pr-4">Modalidade</th>
                      <th className="py-2.5 px-3">Qtd (% Uso)</th>
                      <th className="py-2.5 px-3">Aprovados / Pagos</th>
                      <th className="py-2.5 px-3">Pendentes</th>
                      <th className="py-2.5 px-3">Cancelados / Recusados</th>
                      <th className="py-2.5 px-3 text-right">Valor Recebido</th>
                      <th className="py-2.5 pl-3 text-right">Valor Previsto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(() => {
                      const totalPayCount = Math.max(
                        1,
                        payments.reduce((acc, p) => acc + Number(p.total_bookings || 0), 0)
                      );
                      return payments.map((p, idx) => {
                        const share = Math.round((Number(p.total_bookings || 0) / totalPayCount) * 100);
                        return (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="py-3 pr-4 font-bold text-white">{p.modality}</td>
                            <td className="py-3 px-3 font-mono text-zinc-200">
                              {p.total_bookings} ({share}%)
                            </td>
                            <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                              {p.approved_count}
                            </td>
                            <td className="py-3 px-3 font-mono text-amber-400">{p.pending_count}</td>
                            <td className="py-3 px-3 font-mono text-rose-400">
                              {Number(p.canceled_count || 0) + Number(p.failed_count || 0)}
                            </td>
                            <td className="py-3 px-3 font-mono text-right font-bold text-emerald-400">
                              {fmtCurrency(p.received_amount)}
                            </td>
                            <td className="py-3 pl-3 font-mono text-right text-zinc-300">
                              {fmtCurrency(p.scheduled_amount)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Receita por Serviço e por Profissional */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Receita e Procura por Serviço</h3>
              {(financial.by_service || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">Nenhum serviço movimentado no período.</p>
              ) : (
                <div className="space-y-2">
                  {(financial.by_service || []).map((s: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{s.service_name}</p>
                        <p className="text-[11px] text-zinc-400">
                          {s.bookings_count} reservas ({s.completed_count} concluídas) · Ticket {fmtCurrency(s.avg_ticket)}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="font-bold text-emerald-400">{fmtCurrency(s.received_revenue)} recebidos</p>
                        <p className="text-[11px] text-zinc-500">{fmtCurrency(s.scheduled_value)} previstos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Receita e Desempenho por Profissional</h3>
              {(financial.by_professional || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">Nenhum profissional movimentado no período.</p>
              ) : (
                <div className="space-y-2">
                  {(financial.by_professional || []).map((p: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{p.professional_name}</p>
                        <p className="text-[11px] text-zinc-400">
                          {p.bookings_count} reservas ({p.completed_count} concluídas) · Ticket {fmtCurrency(p.avg_ticket)}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="font-bold text-emerald-400">{fmtCurrency(p.received_revenue)} recebidos</p>
                        <p className="text-[11px] text-zinc-500">{fmtCurrency(p.scheduled_value)} previstos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 6: CLIENTES NOVOS E RECORRENTES (SEÇÃO 2 & 12)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Clientes Novos no Período
            </p>
            <p className="text-3xl font-bold text-white mt-2">{curr.new_customers || 0}</p>
            <p className="text-xs text-zinc-400 mt-1">
              Realizaram seu primeiro agendamento na loja dentro deste período.
            </p>
          </div>

          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Clientes Recorrentes Atendidos
            </p>
            <p className="text-3xl font-bold text-white mt-2">{curr.recurring_customers || 0}</p>
            <p className="text-xs text-zinc-400 mt-1">
              Clientes que já possuíam histórico anterior e voltaram a agendar.
            </p>
          </div>

          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Taxa de Recorrência no Período
            </p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              {Number(curr.new_customers || 0) + Number(curr.recurring_customers || 0) > 0
                ? `${Math.round(
                    (Number(curr.recurring_customers || 0) /
                      (Number(curr.new_customers || 0) + Number(curr.recurring_customers || 0))) *
                      100
                  )}%`
                : '0%'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Proporção de clientes fidelizados entre os atendidos no período.
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 7: DISPOSITIVOS E SISTEMAS OPERACIONAIS (SEÇÃO 10)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ambiente 1: Portal do Cliente */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Portal do Cliente — Dispositivos &amp; Conversão</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Android, iPhone / iOS, Windows, macOS e taxa de conversão por sistema.
              </p>
            </div>

            {(devices.portal || []).length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                Nenhuma sessão registrada no portal público neste período.
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const totalSess = Math.max(
                    1,
                    (devices.portal || []).reduce((acc: number, d: any) => acc + Number(d.sessions || 0), 0)
                  );
                  return (devices.portal || []).map((d: any, idx: number) => {
                    const share = Math.round((Number(d.sessions || 0) / totalSess) * 100);
                    return (
                      <div
                        key={idx}
                        className="bg-[#13131A] border border-white/5 rounded-xl p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{d.platform}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {d.sessions} sessões ({share}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400 pt-1">
                          <span>
                            Concluídos: <strong className="text-white">{d.completed_bookings}</strong> ({d.conversion_rate || 0}%)
                          </span>
                          <span>
                            Tempo médio: <strong className="text-white">{fmtDuration(d.avg_duration_seconds)}</strong>
                          </span>
                          <span>
                            Desistências: <strong className="text-rose-400">{d.abandoned_sessions}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Ambiente 2: Painel Administrativo */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span>Painel Administrativo — Dispositivos do Proprietário/Equipe</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Dispositivos utilizados pelo dono e profissionais para gerenciar o salão.
              </p>
            </div>

            {(devices.admin || []).length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                Nenhuma sessão administrativa registrada neste período.
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const totalSess = Math.max(
                    1,
                    (devices.admin || []).reduce((acc: number, d: any) => acc + Number(d.sessions || 0), 0)
                  );
                  return (devices.admin || []).map((d: any, idx: number) => {
                    const share = Math.round((Number(d.sessions || 0) / totalSess) * 100);
                    return (
                      <div
                        key={idx}
                        className="bg-[#13131A] border border-white/5 rounded-xl p-3.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">{d.platform}</p>
                          <p className="text-[11px] text-zinc-400">
                            Tempo médio ativo: {fmtDuration(d.avg_duration_seconds)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {d.sessions} sessões ({share}%)
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 8: COMPORTAMENTO DO PROPRIETÁRIO NO PAINEL ADMIN (SEÇÃO 11)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'admin_usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-400">Sessões Administrativas</p>
              <p className="text-2xl font-bold text-white mt-1">
                {adminBehavior.summary?.total_sessions || 0}
              </p>
            </div>
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-400">Telas Acessadas no Painel</p>
              <p className="text-2xl font-bold text-white mt-1">
                {adminBehavior.summary?.total_page_views || 0}
              </p>
            </div>
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-400">Dias Ativos no Período</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {adminBehavior.summary?.active_days || 0} dia(s)
              </p>
            </div>
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-zinc-400">Último Acesso ao Painel</p>
              <p className="text-sm font-bold text-white mt-2">
                {adminBehavior.summary?.last_access_at
                  ? format(new Date(adminBehavior.summary.last_access_at), "dd/MM/yyyy 'às' HH:mm")
                  : 'Ainda não registrado'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Módulos mais e menos acessados */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Páginas Mais e Menos Acessadas pelo Estabelecimento
                </h3>
                <p className="text-xs text-zinc-400">
                  Acessos e tempo ativo em Agenda, Financeiro, Clientes, Serviços, Equipe, Configurações e Visão Geral.
                </p>
              </div>

              {(adminBehavior.pages || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  Nenhum acesso administrativo registrado neste período.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(adminBehavior.pages || []).map((pg: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{pg.label}</p>
                        <p className="text-[11px] text-zinc-400">
                          {pg.unique_sessions} sessão(ões) · Tempo médio: {fmtDuration(pg.avg_duration_seconds)}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="font-bold text-emerald-400">{pg.views} acessos</p>
                        <p className="text-[11px] text-zinc-500">
                          Total: {fmtDuration(pg.total_duration_seconds)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Funcionalidades operacionais e Uso por Papel (Proprietário vs Profissional) */}
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Funcionalidades Utilizadas &amp; Perfil de Acesso
                </h3>
                <p className="text-xs text-zinc-400">
                  Ações executadas dentro do painel e divisão entre Proprietário e Profissionais.
                </p>
              </div>

              {(adminBehavior.by_role || []).length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {(adminBehavior.by_role || []).map((r: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs font-mono text-zinc-200"
                    >
                      Perfil <strong className="text-emerald-400 uppercase">{r.user_role}</strong>: {r.sessions} sessões ({r.events_count} eventos)
                    </span>
                  ))}
                </div>
              )}

              {(adminBehavior.features || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  Nenhuma ação operacional específica registrada neste período.
                </p>
              ) : (
                <div className="space-y-2">
                  {(adminBehavior.features || []).map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#13131A] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs"
                    >
                      <span className="text-zinc-200 font-medium">{f.label}</span>
                      <span className="font-mono font-bold text-emerald-400">{f.total_uses}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

