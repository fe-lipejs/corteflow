import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
import AdminBadge from './components/AdminBadge';
import { resolvePeriodDates, type PeriodPreset } from './AdminTenantAnalytics';

type RankingMode =
  | 'revenue'
  | 'bookings'
  | 'conversion'
  | 'customers'
  | 'growth'
  | 'portal_share'
  | 'admin_activity';

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(val || 0));

export default function AdminRaffrosAnalytics() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState<string>(() =>
    format(subDays(new Date(), 29), 'yyyy-MM-dd')
  );
  const [customEnd, setCustomEnd] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [businessType, setBusinessType] = useState<string>('all');
  const [rankingMode, setRankingMode] = useState<RankingMode>('revenue');
  const [search, setSearch] = useState<string>('');

  const periodRange = useMemo(
    () => resolvePeriodDates(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const {
    data: globalData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'raffros_global_analytics',
      periodRange.start.toISOString(),
      periodRange.end.toISOString(),
      businessType,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_raffros_global_analytics', {
        p_start: periodRange.start.toISOString(),
        p_end: periodRange.end.toISOString(),
        p_business_type: businessType,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const summary = globalData?.summary || {};
  const rawTenants: any[] = globalData?.tenants_ranking || [];
  const devices = globalData?.devices || { portal: [], admin: [] };
  const payments: any[] = globalData?.payments || [];

  const rankedTenants = useMemo(() => {
    const list = rawTenants
      .map((t) => {
        const currBk = Number(t.total_bookings || 0);
        const prevBk = Number(t.prev_bookings || 0);
        const growthDelta = currBk - prevBk;
        const growthPct =
          prevBk > 0 ? Math.round(((currBk - prevBk) / prevBk) * 100) : currBk > 0 ? 100 : 0;
        return {
          ...t,
          growthDelta,
          growthPct,
        };
      })
      .filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          String(t.name || '').toLowerCase().includes(q) ||
          String(t.slug || '').toLowerCase().includes(q)
        );
      });

    return list.sort((a, b) => {
      switch (rankingMode) {
        case 'revenue':
          return Number(b.received_revenue || 0) - Number(a.received_revenue || 0);
        case 'bookings':
          return Number(b.total_bookings || 0) - Number(a.total_bookings || 0);
        case 'conversion':
          return Number(b.portal_conversion_rate || -1) - Number(a.portal_conversion_rate || -1);
        case 'customers':
          return Number(b.total_customers || 0) - Number(a.total_customers || 0);
        case 'growth':
          return b.growthDelta - a.growthDelta || b.growthPct - a.growthPct;
        case 'portal_share':
          return Number(b.online_share_pct || 0) - Number(a.online_share_pct || 0);
        case 'admin_activity':
          return Number(b.admin_page_views || 0) - Number(a.admin_page_views || 0);
      }
    });
  }, [rawTenants, rankingMode, search]);

  return (
    <div className="space-y-6 pb-16 text-zinc-100">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-3 h-3" /> Raffros Analytics
            </span>
            <span className="text-xs text-zinc-500">Visão Global Multi-Tenant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-emerald-400 shrink-0" />
            <span>Centro de Inteligência &amp; Desempenho das Lojas</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Compare estabelecimentos, acompanhe agendamentos online vs manuais, conversão do portal, receitas e uso do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/platform/analytics"
            className="px-3.5 py-2 rounded-xl bg-[#0B0B0E] border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/20 transition-all"
          >
            Tráfego da Landing Page
          </Link>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filtros de Período e Tipo de Estabelecimento ── */}
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
                  ? 'bg-emerald-500 text-black font-bold'
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

          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-zinc-200 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todos os segmentos</option>
            <option value="barbearia">Barbearias</option>
            <option value="salao">Salões de Beleza</option>
            <option value="esmalteria">Esmalterias</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Consolidando indicadores de todos os estabelecimentos...</p>
        </div>
      ) : (
        <>
          {/* ── KPIs Globais da Plataforma ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Estabelecimentos Analisados
              </p>
              <p className="text-2xl font-bold text-white mt-2">{summary.total_tenants || 0}</p>
              <p className="text-xs text-emerald-400 mt-1">
                {summary.active_tenants || 0} ativos / em trial
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Total de Agendamentos no Período
              </p>
              <p className="text-2xl font-bold text-white mt-2">{summary.total_bookings || 0}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {summary.online_bookings || 0} pelo portal · {summary.manual_bookings || 0} manuais
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Receita Recebida nas Lojas
              </p>
              <p className="text-2xl font-bold text-white mt-2">
                {fmtCurrency(summary.received_revenue)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Valor agendado previsto: {fmtCurrency(summary.scheduled_value)}
              </p>
            </div>

            <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Tráfego nos Portais &amp; Painéis
              </p>
              <p className="text-2xl font-bold text-white mt-2">
                {Number(summary.portal_sessions || 0) + Number(summary.admin_sessions || 0)} sessões
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {summary.portal_sessions || 0} clientes no portal · {summary.admin_sessions || 0} acessos admin
              </p>
            </div>
          </div>

          {/* ── Comparação e Rankings entre Estabelecimentos (Seção 13) ── */}
          <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/10 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Comparação de Desempenho entre Estabelecimentos</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Clique em <strong>Ver métricas</strong> em qualquer loja para abrir o diagnóstico completo individual.
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar loja ou slug..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#13131A] border border-white/10 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Abas de Ranking */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'revenue', label: 'Maior Receita' },
                    { id: 'bookings', label: 'Mais Agendamentos' },
                    { id: 'portal_share', label: 'Maior Uso do Portal (%)' },
                    { id: 'conversion', label: 'Maior Conversão Portal' },
                    { id: 'customers', label: 'Mais Clientes' },
                    { id: 'growth', label: 'Maior Crescimento' },
                    { id: 'admin_activity', label: 'Maior Frequência Admin' },
                  ] as { id: RankingMode; label: string }[]
                ).map((rm) => (
                  <button
                    key={rm.id}
                    onClick={() => setRankingMode(rm.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      rankingMode === rm.id
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                        : 'bg-[#13131A] text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {rm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela de Estabelecimentos */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 pl-5 pr-3">#</th>
                    <th className="py-3 px-3">Estabelecimento &amp; Tempo de Operação</th>
                    <th className="py-3 px-3">Agendamentos (Online / Manual)</th>
                    <th className="py-3 px-3">Crescimento</th>
                    <th className="py-3 px-3">Conversão Portal</th>
                    <th className="py-3 px-3">Clientes</th>
                    <th className="py-3 px-3">Uso Admin</th>
                    <th className="py-3 px-3 text-right">Receita Recebida</th>
                    <th className="py-3 pl-3 pr-5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rankedTenants.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 pl-5 pr-3 font-mono text-zinc-500 font-bold">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center overflow-hidden shrink-0">
                            {t.logo_url ? (
                              <img src={t.logo_url} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-emerald-400">
                                {String(t.name || 'L').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{t.name}</span>
                              <AdminBadge value={t.status} dot />
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              /{t.slug} · <span className="capitalize">{t.business_type}</span> ·{' '}
                              <span title={`Cadastrado em ${new Date(t.created_at).toLocaleDateString('pt-BR')}`}>
                                Operando há {t.operating_days}d
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        <span className="text-white font-bold">{t.total_bookings}</span>{' '}
                        <span className="text-zinc-400">
                          ({t.online_bookings} portal / {t.manual_bookings} manual ·{' '}
                          <strong className="text-emerald-400">{t.online_share_pct}% online</strong>)
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        {t.growthDelta > 0 ? (
                          <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />+{t.growthDelta} ({t.growthPct}%)
                          </span>
                        ) : t.growthDelta < 0 ? (
                          <span className="text-rose-400 font-bold inline-flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {t.growthDelta} ({t.growthPct}%)
                          </span>
                        ) : (
                          <span className="text-zinc-500">Estável (0)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        {t.portal_conversion_rate !== null ? (
                          <span className="text-emerald-400 font-bold">
                            {t.portal_conversion_rate}% ({t.portal_sessions} sess.)
                          </span>
                        ) : (
                          <span className="text-zinc-500">Sem visitas no período</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-zinc-200">
                        <strong>{t.total_customers}</strong>{' '}
                        <span className="text-zinc-500">(+{t.new_customers} novos)</span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-zinc-300">
                        {t.admin_sessions} sess. ({t.admin_page_views} telas)
                      </td>
                      <td className="py-3.5 px-3 font-mono text-right">
                        <p className="font-bold text-emerald-400">{fmtCurrency(t.received_revenue)}</p>
                        <p className="text-[10px] text-zinc-500">
                          Prev.: {fmtCurrency(t.scheduled_value)}
                        </p>
                      </td>
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <button
                          onClick={() => navigate(`/platform/tenants/${t.id}/analytics`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Ver métricas</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

