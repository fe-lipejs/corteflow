import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Users, Eye, MousePointerClick, TrendingUp, Smartphone,
  Monitor, Tablet, RefreshCw, Filter, ArrowUpRight, Search, Globe,
  ShieldCheck, Sparkles, Clock, CheckCircle2, ChevronRight
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';

interface AnalyticsEvent {
  id: string;
  session_id: string;
  visitor_id: string;
  event_type: string;
  event_name: string;
  page_path: string;
  page_title: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  screen_resolution: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export default function AdminAnalytics() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | '24h' | '7d' | '30d' | 'all'>('7d');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false });

      const now = new Date();
      if (timeRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfDay);
      } else if (timeRange === '24h') {
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', last24h);
      } else if (timeRange === '7d') {
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', last7d);
      } else if (timeRange === '30d') {
        const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', last30d);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  // Realtime subscription for incoming visits and clicks
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('public:analytics_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events' },
        (payload) => {
          const newEvent = payload.new as AnalyticsEvent;
          setEvents((prev) => [newEvent, ...prev.slice(0, 499)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive]);

  // Derived metrics
  const totalPageViews = events.filter((e) => e.event_type === 'page_view').length;
  const uniqueVisitors = new Set(events.map((e) => e.visitor_id)).size;
  const totalClicks = events.filter((e) => e.event_type === 'click').length;
  const conversionClicks = events.filter((e) => 
    e.event_name.includes('cta') || 
    e.event_name.includes('plan') || 
    e.event_name.includes('comecar') ||
    e.event_name.includes('cadastro')
  ).length;

  const conversionRate = uniqueVisitors > 0 ? ((conversionClicks / uniqueVisitors) * 100).toFixed(1) : '0';

  // Device breakdown
  const deviceCounts = events.reduce((acc, e) => {
    const dev = e.device_type || 'desktop';
    acc[dev] = (acc[dev] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mobileCount = deviceCounts['mobile'] || 0;
  const desktopCount = deviceCounts['desktop'] || 0;
  const tabletCount = deviceCounts['tablet'] || 0;
  const totalDeviceEvents = mobileCount + desktopCount + tabletCount || 1;

  // Plan clicks breakdown
  const planClicks = {
    Solo: events.filter((e) => e.event_name.toLowerCase().includes('solo')).length,
    Studio: events.filter((e) => e.event_name.toLowerCase().includes('studio')).length,
    Equipe: events.filter((e) => e.event_name.toLowerCase().includes('equipe')).length,
  };
  const totalPlanClicks = (planClicks.Solo + planClicks.Studio + planClicks.Equipe) || 1;

  // Top Clicked Events Ranking
  const eventCounts = events
    .filter((e) => e.event_type === 'click')
    .reduce((acc, e) => {
      acc[e.event_name] = (acc[e.event_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Filtered list of events for table
  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.page_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.browser && e.browser.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.os && e.os.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.referrer && e.referrer.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = selectedEventType === 'all' || e.event_type === selectedEventType;

    return matchesSearch && matchesType;
  });

  const formatEventName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/click /i, 'Clique: ')
      .replace(/view /i, 'Acesso: ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDeviceIcon = (dev: string | null) => {
    if (dev === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-amber-400" />;
    if (dev === 'tablet') return <Tablet className="w-3.5 h-3.5 text-blue-400" />;
    return <Monitor className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-[#000000] text-white">

      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white flex items-center gap-2.5">
              <Activity className="w-7 h-7 text-[#F59E0B]" />
              Motor de Visitas &amp; Cliques
            </h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                AO VIVO
              </span>
            )}
          </div>
          <p className="text-sm text-[#A1A1A6] mt-1">
            Acompanhe em tempo real quem visita sua landing page, quais botões clica e o funil de interesse nos planos.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-[#121216] border border-white/[0.08] p-1 rounded-xl flex items-center">
            {(['today', '24h', '7d', '30d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === r
                    ? 'bg-[#F59E0B] text-black shadow-md'
                    : 'text-[#A1A1A6] hover:text-white'
                }`}
              >
                {r === 'today' ? 'Hoje' : r === '24h' ? '24h' : r === '7d' ? '7 Dias' : r === '30d' ? '30 Dias' : 'Tudo'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#121216] border border-white/[0.08] text-[#A1A1A6] hover:text-white hover:border-white/20 transition-all flex items-center gap-1 text-xs font-medium"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#F59E0B]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pageviews */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Visualizações</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{totalPageViews}</p>
          <p className="text-xs text-[#71717A] mt-1">Páginas acessadas no período</p>
        </div>

        {/* Unique Visitors */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Visitantes Únicos</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#F59E0B]" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[#F59E0B] mt-3">{uniqueVisitors}</p>
          <p className="text-xs text-[#71717A] mt-1">Pessoas diferentes que acessaram</p>
        </div>

        {/* Total Clicks / Interactivity */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Cliques &amp; Ações</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{totalClicks}</p>
          <p className="text-xs text-[#71717A] mt-1">Interações com botões e planos</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-[#121216] border border-[#F59E0B]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(245,158,11,0.08), rgba(18,18,22,0.98))' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FBBF24]">Taxa de Conversão</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#FBBF24]" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{conversionRate}%</p>
          <p className="text-xs text-[#A1A1A6] mt-1">{conversionClicks} cliques para começar</p>
        </div>
      </div>

      {/* ── PLAN INTEREST & DEVICE BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* PLAN POPULARITY RANKING */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                Interesse por Plano
              </h3>
              <span className="text-xs text-[#71717A] font-mono">Cliques em CTA</span>
            </div>
            <p className="text-xs text-[#A1A1A6] mb-6">
              Distribuição de intenção de compra quando o cliente clica em "Começar agora" nos cartões de preço.
            </p>

            <div className="space-y-4">
              {/* STUDIO */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#FBBF24] flex items-center gap-1.5">
                    Studio (R$ 89)
                    <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-[#F59E0B] px-1.5 py-0.5 rounded">Mais escolhido</span>
                  </span>
                  <span className="text-white">{planClicks.Studio} cliques ({Math.round((planClicks.Studio / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]"
                    style={{ width: `${Math.max(4, Math.round((planClicks.Studio / totalPlanClicks) * 100))}%` }}
                  />
                </div>
              </div>

              {/* SOLO */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#D4D4D8]">Solo (R$ 49)</span>
                  <span className="text-white">{planClicks.Solo} cliques ({Math.round((planClicks.Solo / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(4, Math.round((planClicks.Solo / totalPlanClicks) * 100))}%` }}
                  />
                </div>
              </div>

              {/* EQUIPE */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#D4D4D8]">Equipe (R$ 149)</span>
                  <span className="text-white">{planClicks.Equipe} cliques ({Math.round((planClicks.Equipe / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${Math.max(4, Math.round((planClicks.Equipe / totalPlanClicks) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-[#71717A] flex items-center justify-between">
            <span>Total de interações em planos</span>
            <span className="font-mono font-bold text-white">{planClicks.Solo + planClicks.Studio + planClicks.Equipe}</span>
          </div>
        </div>

        {/* DEVICE & OS BREAKDOWN */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Dispositivos dos Visitantes
              </h3>
              <span className="text-xs text-[#71717A] font-mono">Mobile vs Desktop</span>
            </div>

            <div className="grid grid-cols-3 gap-3 my-6 text-center">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Smartphone className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <p className="text-lg font-bold font-display text-white">{mobileCount}</p>
                <p className="text-[11px] text-[#71717A]">Celulares</p>
                <p className="text-[10px] text-amber-400 font-mono mt-0.5">{Math.round((mobileCount / totalDeviceEvents) * 100)}%</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Monitor className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                <p className="text-lg font-bold font-display text-white">{desktopCount}</p>
                <p className="text-[11px] text-[#71717A]">Computadores</p>
                <p className="text-[10px] text-blue-400 font-mono mt-0.5">{Math.round((desktopCount / totalDeviceEvents) * 100)}%</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Tablet className="w-5 h-5 text-purple-400 mx-auto mb-1.5" />
                <p className="text-lg font-bold font-display text-white">{tabletCount}</p>
                <p className="text-[11px] text-[#71717A]">Tablets</p>
                <p className="text-[10px] text-purple-400 font-mono mt-0.5">{Math.round((tabletCount / totalDeviceEvents) * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.08] text-xs text-[#A1A1A6] flex items-center justify-between">
            <span>Experiência mobile</span>
            <span className="font-mono text-emerald-400 font-semibold">100% Otimizada</span>
          </div>
        </div>

        {/* TOP CLICKED BUTTONS / CTAS */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg text-white flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-purple-400" />
                Top Botões Mais Clicados
              </h3>
              <span className="text-xs text-[#71717A] font-mono">Ranking</span>
            </div>

            <div className="space-y-2.5 mt-4">
              {topEvents.length === 0 ? (
                <p className="text-xs text-[#71717A] italic text-center py-6">Nenhum clique registrado ainda.</p>
              ) : (
                topEvents.map(([name, count], index) => (
                  <div key={name} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs">
                    <span className="flex items-center gap-2 text-[#D4D4D8] truncate max-w-[200px]">
                      <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-mono font-bold text-[#F59E0B]">
                        {index + 1}
                      </span>
                      {formatEventName(name)}
                    </span>
                    <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-white/[0.05]">
                      {count} {count === 1 ? 'clique' : 'cliques'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.08] text-xs text-[#71717A] flex items-center justify-between">
            <span>Rastreamento ativo</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          </div>
        </div>

      </div>

      {/* ── LIVE ACTIVITY FEED (EVENT TABLE) ── */}
      <div className="bg-[#121216] border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden">
        
        {/* Table Filters & Header */}
        <div className="p-5 md:p-6 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-lg text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              Feed de Acessos &amp; Ações em Tempo Real
            </h2>
            <p className="text-xs text-[#A1A1A6] mt-0.5">
              Cada visita e clique registrado de forma anônima e segura.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                placeholder="Buscar por ação, SO, browser..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0A0A0C] border border-white/[0.1] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F59E0B] w-[220px]"
              />
            </div>

            {/* Type Selector */}
            <div className="bg-[#0A0A0C] border border-white/[0.1] rounded-xl p-1 flex items-center">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'page_view', label: 'Visitas' },
                { key: 'click', label: 'Cliques' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedEventType(t.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedEventType === t.key
                      ? 'bg-white/[0.12] text-white'
                      : 'text-[#71717A] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0A0A0C]/50 text-[#71717A] font-mono uppercase tracking-wider">
                <th className="py-3.5 px-5">Data / Hora</th>
                <th className="py-3.5 px-5">Tipo</th>
                <th className="py-3.5 px-5">Ação / Evento</th>
                <th className="py-3.5 px-5">Página</th>
                <th className="py-3.5 px-5">Dispositivo &amp; Navegador</th>
                <th className="py-3.5 px-5">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#71717A]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#F59E0B] mb-2" />
                    Carregando atividades...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#71717A] italic">
                    Nenhum evento registrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const date = new Date(evt.created_at);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFormatted = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

                  return (
                    <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Date / Time */}
                      <td className="py-3 px-5 font-mono text-[#A1A1A6] whitespace-nowrap">
                        <span className="text-white font-semibold">{timeFormatted}</span>
                        {!isToday && <span className="text-[10px] text-[#71717A] block">{dateFormatted}</span>}
                      </td>

                      {/* Event Type */}
                      <td className="py-3 px-5 whitespace-nowrap">
                        {evt.event_type === 'page_view' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                            <Eye className="w-2.5 h-2.5" /> Visita
                          </span>
                        ) : evt.event_name.includes('cta') || evt.event_name.includes('plan') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-[#F59E0B] border border-amber-500/25">
                            <Sparkles className="w-2.5 h-2.5" /> Conversão
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-white border border-white/[0.1]">
                            <MousePointerClick className="w-2.5 h-2.5" /> Clique
                          </span>
                        )}
                      </td>

                      {/* Event Name */}
                      <td className="py-3 px-5 font-medium text-white max-w-[220px] truncate">
                        {formatEventName(evt.event_name)}
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <span className="text-[10px] text-[#71717A] block truncate font-mono">
                            {JSON.stringify(evt.metadata)}
                          </span>
                        )}
                      </td>

                      {/* Page */}
                      <td className="py-3 px-5 font-mono text-[#D4D4D8] whitespace-nowrap">
                        {evt.page_path}
                      </td>

                      {/* Device & Browser */}
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(evt.device_type)}
                          <span className="text-[#D4D4D8]">
                            {evt.os || 'OS'} · {evt.browser || 'Browser'}
                          </span>
                        </div>
                      </td>

                      {/* Referrer / Origin */}
                      <td className="py-3 px-5 text-[#A1A1A6] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3 text-[#71717A]" />
                          {evt.referrer || 'Direto'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#0A0A0C]/50 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#71717A]">
          <span>Exibindo até 500 eventos mais recentes</span>
          <span className="font-mono">{filteredEvents.length} resultados filtrados</span>
        </div>

      </div>

    </div>
  );
}
