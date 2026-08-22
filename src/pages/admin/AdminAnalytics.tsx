import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Users, Eye, MousePointerClick, TrendingUp, Smartphone,
  Monitor, Tablet, RefreshCw, Filter, ArrowUpRight, Search, Globe,
  ShieldCheck, Sparkles, Clock, CheckCircle2, ChevronRight, Music2,
  Share2, Shuffle, Download, ExternalLink, Flame
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { SpotifyGlyph } from '../../components/SpotifyMoodCard';

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
  const [timeRange, setTimeRange] = useState<'today' | '24h' | '7d' | '30d' | 'custom' | 'all'>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'page_view' | 'conversion' | 'faith' | 'nav'>('all');
  const [isLive, setIsLive] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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
      } else if (timeRange === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          query = query.gte('created_at', start.toISOString());
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }
      }

      const { data, error } = await query.limit(3000);
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
    setCurrentPage(1); // Reset page on date filter change
  }, [timeRange, customStartDate, customEndDate]);

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
          setEvents((prev) => [newEvent, ...prev.slice(0, 999)]);
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
    e.event_name.includes('cadastro') ||
    e.event_name.includes('checkout')
  ).length;

  const conversionRate = uniqueVisitors > 0 ? ((conversionClicks / uniqueVisitors) * 100).toFixed(1) : '0';

  // Faith & Playlist metrics
  const playlistViews = events.filter((e) => e.page_path === '/playlist' && e.event_type === 'page_view').length;
  const playlistHeroPillClicks = events.filter((e) => e.event_name.includes('playlist') || e.event_name.includes('som_da_casa')).length;
  const verseDrawClicks = events.filter((e) => e.event_name === 'click_sortear_versiculo').length;
  const verseShareClicks = events.filter((e) => e.event_name === 'click_compartilhar_versiculo').length;
  const spotifyExternalClicks = events.filter((e) => e.event_name === 'click_spotify_abrir_externo').length;
  const totalFaithInteractions = playlistViews + playlistHeroPillClicks + verseDrawClicks + verseShareClicks + spotifyExternalClicks;

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

  // Traffic Origin (Instagram, WhatsApp, Google, Direct)
  const originCounts = events.reduce((acc, e) => {
    let source = 'Direto';
    const ref = (e.referrer || '').toLowerCase();
    const utmSource = (e.utm_source || '').toLowerCase();

    if (ref.includes('instagram') || utmSource.includes('instagram') || utmSource.includes('ig')) {
      source = 'Instagram Bio / Ads';
    } else if (ref.includes('whatsapp') || ref.includes('wa.me') || utmSource.includes('whatsapp')) {
      source = 'WhatsApp';
    } else if (ref.includes('google') || utmSource.includes('google')) {
      source = 'Google Busca';
    } else if (ref.includes('facebook') || ref.includes('fb') || utmSource.includes('facebook')) {
      source = 'Facebook';
    } else if (ref && ref !== 'localhost' && ref !== 'direto') {
      source = 'Outros Sites';
    }

    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalOrigins = Object.values(originCounts).reduce((a, b) => a + b, 0) || 1;

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
      (e.referrer && e.referrer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesCategory = true;
    if (selectedCategory === 'page_view') {
      matchesCategory = e.event_type === 'page_view';
    } else if (selectedCategory === 'conversion') {
      matchesCategory = 
        e.event_name.includes('cta') || 
        e.event_name.includes('plan') || 
        e.event_name.includes('comecar') ||
        e.event_name.includes('cadastro');
    } else if (selectedCategory === 'faith') {
      matchesCategory = 
        e.page_path === '/playlist' || 
        e.event_name.includes('playlist') || 
        e.event_name.includes('versiculo') ||
        e.event_name.includes('spotify') ||
        e.event_name.includes('som_da_casa');
    } else if (selectedCategory === 'nav') {
      matchesCategory = e.event_name.includes('nav') || e.event_name.includes('menu');
    }

    return matchesSearch && matchesCategory;
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Data/Hora', 'Tipo', 'Evento', 'Pagina', 'Dispositivo', 'SO', 'Navegador', 'Origem', 'Referrer', 'Metadata'];
    const rows = filteredEvents.map((e) => [
      new Date(e.created_at).toLocaleString(),
      e.event_type,
      e.event_name,
      e.page_path,
      e.device_type || 'desktop',
      e.os || '',
      e.browser || '',
      e.utm_source || 'Direto',
      e.referrer || '',
      JSON.stringify(e.metadata || {})
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raffros_analytics_${timeRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    <div className="space-y-8 bg-[#000000] text-white">

      {/* ── TOP HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white flex flex-wrap items-center gap-2.5">
              <Activity className="w-7 h-7 text-[#F59E0B] flex-shrink-0" />
              <span className="break-words">Motor de Visitas, Cliques &amp; Engajamento</span>
            </h1>
            {isLive && (
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                AO VIVO
              </span>
            )}
          </div>
          <p className="text-sm text-[#A1A1A6] mt-2 break-words">
            Métricas em tempo real da Landing Page, tráfego do Instagram, intenção de planos e interações com a Playlist &amp; Palavra de Fé.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto mt-4 md:mt-0">
          {/* Custom Date Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setTimeRange('custom');
              }}
              className="w-full sm:w-32 min-w-0 bg-[#121216] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F59E0B]"
            />
            <span className="hidden sm:block text-[#71717A] text-xs">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setTimeRange('custom');
              }}
              className="w-full sm:w-32 min-w-0 bg-[#121216] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F59E0B]"
            />
          </div>

          <div className="hidden sm:flex bg-[#121216] border border-white/[0.08] p-1 rounded-xl items-center">
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

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={exportToCSV}
              className="flex-1 sm:flex-none justify-center p-2.5 px-3.5 rounded-xl bg-[#121216] border border-white/[0.08] text-[#A1A1A6] hover:text-white hover:border-amber-500/40 transition-all flex items-center gap-1.5 text-xs font-medium"
              title="Exportar dados para CSV"
            >
              <Download className="w-4 h-4 text-[#F59E0B]" />
              <span className="sm:inline">CSV</span>
            </button>

            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="flex-none p-2.5 rounded-xl bg-[#121216] border border-white/[0.08] text-[#A1A1A6] hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-1 text-xs font-medium"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#F59E0B]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 5 KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Pageviews */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Visualizações</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{totalPageViews}</p>
          <p className="text-xs text-[#71717A] mt-1">Páginas acessadas</p>
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
          <p className="text-xs text-[#71717A] mt-1">Visitantes únicos</p>
        </div>

        {/* Total Clicks / Interactivity */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Cliques Gerais</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{totalClicks}</p>
          <p className="text-xs text-[#71717A] mt-1">Interações em botões</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-[#121216] border border-[#F59E0B]/30 rounded-2xl p-5 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(245,158,11,0.08), rgba(18,18,22,0.98))' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FBBF24]">Intenção Compra</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#FBBF24]" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-white mt-3">{conversionRate}%</p>
          <p className="text-xs text-[#A1A1A6] mt-1">{conversionClicks} cliques nos planos</p>
        </div>

        {/* Faith & Playlist Engagements */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A1A1A6]">Playlist &amp; Fé</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[#F59E0B] mt-3">{totalFaithInteractions}</p>
          <p className="text-xs text-[#71717A] mt-1">Louvores e mensagens de fé</p>
        </div>
      </div>

      {/* ── 4 INTELLIGENT BREAKDOWN CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* 1. PLAN POPULARITY RANKING */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                Interesse por Plano
              </h3>
              <span className="text-[11px] text-[#71717A] font-mono">Planos</span>
            </div>
            <p className="text-xs text-[#A1A1A6] mb-5">
              Distribuição de intenção de compra ao clicar em "Começar agora" nos planos.
            </p>

            <div className="space-y-4">
              {/* STUDIO */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#FBBF24] flex items-center gap-1.5">
                    Studio (R$ 89)
                    <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-[#F59E0B] px-1 py-0.2 rounded">Mais buscado</span>
                  </span>
                  <span className="text-white font-mono">{planClicks.Studio} ({Math.round((planClicks.Studio / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
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
                  <span className="text-white font-mono">{planClicks.Solo} ({Math.round((planClicks.Solo / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
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
                  <span className="text-white font-mono">{planClicks.Equipe} ({Math.round((planClicks.Equipe / totalPlanClicks) * 100)}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${Math.max(4, Math.round((planClicks.Equipe / totalPlanClicks) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/[0.08] text-xs text-[#71717A] flex items-center justify-between">
            <span>Total de cliques em planos</span>
            <span className="font-mono font-bold text-white">{planClicks.Solo + planClicks.Studio + planClicks.Equipe}</span>
          </div>
        </div>

        {/* 2. FAITH & PLAYLIST ENGAGEMENT (NEW) */}
        <div className="bg-[#121216] border border-amber-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between" style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.03), rgba(18,18,22,1))' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Music2 className="w-4 h-4 text-[#F59E0B]" />
                Louvor &amp; Palavra de Fé
              </h3>
              <span className="text-[11px] text-[#F59E0B] font-mono font-bold">Impacto</span>
            </div>
            <p className="text-xs text-[#A1A1A6] mb-4">
              Visitantes que ouviram a playlist ou pegaram uma mensagem de fé.
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs">
                <span className="flex items-center gap-2 text-[#D4D4D8]">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  Acessos à Página /playlist
                </span>
                <span className="font-mono font-bold text-white">{playlistViews}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs">
                <span className="flex items-center gap-2 text-[#D4D4D8]">
                  <Shuffle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Mensagens Sorteadas
                </span>
                <span className="font-mono font-bold text-white">{verseDrawClicks}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs">
                <span className="flex items-center gap-2 text-[#D4D4D8]">
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  Versículos Compartilhados
                </span>
                <span className="font-mono font-bold text-white">{verseShareClicks}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs">
                <span className="flex items-center gap-2 text-[#D4D4D8]">
                  <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
                  Aberturas no Spotify
                </span>
                <span className="font-mono font-bold text-white">{spotifyExternalClicks}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.08] text-xs text-[#71717A] flex items-center justify-between">
            <span>Taxa de acolhimento</span>
            <span className="font-mono font-bold text-[#F59E0B]">
              {uniqueVisitors > 0 ? Math.round((totalFaithInteractions / uniqueVisitors) * 100) : 0}% dos visitantes
            </span>
          </div>
        </div>

        {/* 3. TRAFFIC ORIGINS (INSTAGRAM BIO FOCUS) */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-pink-400" />
                Origem do Tráfego
              </h3>
              <span className="text-[11px] text-[#71717A] font-mono">Canais</span>
            </div>
            <p className="text-xs text-[#A1A1A6] mb-4">
              De onde vêm os visitantes (Instagram, WhatsApp, Busca, Direto).
            </p>

            <div className="space-y-2.5">
              {Object.entries(originCounts).map(([source, count]) => {
                const pct = Math.round((count / totalOrigins) * 100);
                const isInstagram = source.includes('Instagram');
                return (
                  <div key={source} className="text-xs">
                    <div className="flex justify-between font-semibold mb-1">
                      <span className={isInstagram ? 'text-pink-400 font-bold flex items-center gap-1.5' : 'text-[#D4D4D8]'}>
                        {source}
                        {isInstagram && <Flame className="w-3 h-3 text-pink-400" />}
                      </span>
                      <span className="font-mono text-white">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isInstagram 
                            ? 'bg-gradient-to-r from-pink-500 to-amber-500' 
                            : source === 'WhatsApp' 
                            ? 'bg-emerald-500' 
                            : 'bg-zinc-500'
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.08] text-xs text-[#71717A] flex items-center justify-between">
            <span>Rastreamento de Bio</span>
            <span className="font-mono text-emerald-400 font-semibold">Ativo</span>
          </div>
        </div>

        {/* 4. DEVICES & RESOLUTION */}
        <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Dispositivos
              </h3>
              <span className="text-[11px] text-[#71717A] font-mono">Mobile/Desktop</span>
            </div>
            <p className="text-xs text-[#A1A1A6] mb-4">
              Distribuição de acessos por tipo de tela.
            </p>

            <div className="grid grid-cols-3 gap-2.5 my-3 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Smartphone className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-base font-bold font-display text-white">{mobileCount}</p>
                <p className="text-[10px] text-[#71717A]">Celular</p>
                <p className="text-[9px] text-amber-400 font-mono mt-0.5">{Math.round((mobileCount / totalDeviceEvents) * 100)}%</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Monitor className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-base font-bold font-display text-white">{desktopCount}</p>
                <p className="text-[10px] text-[#71717A]">PC</p>
                <p className="text-[9px] text-blue-400 font-mono mt-0.5">{Math.round((desktopCount / totalDeviceEvents) * 100)}%</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Tablet className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <p className="text-base font-bold font-display text-white">{tabletCount}</p>
                <p className="text-[10px] text-[#71717A]">Tablet</p>
                <p className="text-[9px] text-purple-400 font-mono mt-0.5">{Math.round((tabletCount / totalDeviceEvents) * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-xs text-[#A1A1A6] flex items-center justify-between">
            <span>Experiência mobile</span>
            <span className="font-mono text-emerald-400 font-semibold">100% Fluida</span>
          </div>
        </div>

      </div>

      {/* ── LIVE ACTIVITY FEED (EVENT TABLE) ── */}
      <div className="bg-[#121216] border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden">
        
        {/* Table Filters & Header */}
        <div className="p-4 md:p-6 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-lg text-white flex flex-wrap items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
              <span className="break-words">Feed de Acessos &amp; Ações em Tempo Real</span>
            </h2>
            <p className="text-xs text-[#A1A1A6] mt-1 break-words">
              Cada visita, clique em botão, sorteio de versículo e acesso a planos gravado no banco de dados.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                placeholder="Buscar ação, verso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0A0A0C] border border-white/[0.1] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F59E0B] w-full sm:w-[220px]"
              />
            </div>

            {/* Category Quick Selector */}
            <div className="bg-[#0A0A0C] border border-white/[0.1] rounded-xl p-1 flex items-center flex-wrap gap-1 w-full sm:w-auto">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'page_view', label: 'Visitas' },
                { key: 'conversion', label: 'Vendas' },
                { key: 'faith', label: 'Fé' },
                { key: 'nav', label: 'Nav' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedCategory(t.key as any)}
                  className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
                    selectedCategory === t.key
                      ? 'bg-[#F59E0B] text-black font-bold shadow'
                      : 'text-[#71717A] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Cards (Hidden on Desktop) */}
        <div className="flex flex-col divide-y divide-white/[0.04] md:hidden">
          {loading && events.length === 0 ? (
            <div className="py-12 text-center text-[#71717A]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#F59E0B] mb-2" />
              Carregando atividades...
            </div>
          ) : filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length === 0 ? (
            <div className="py-12 text-center text-[#71717A] italic">
              Nenhum evento.
            </div>
          ) : (
            filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((evt) => {
              const date = new Date(evt.created_at);
              const isToday = new Date().toDateString() === date.toDateString();
              const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateFormatted = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

              const isFaithEvent = 
                evt.page_path === '/playlist' || 
                evt.event_name.includes('playlist') || 
                evt.event_name.includes('versiculo') ||
                evt.event_name.includes('spotify') ||
                evt.event_name.includes('som_da_casa');

              const isConversionEvent = 
                evt.event_name.includes('cta') || 
                evt.event_name.includes('plan') || 
                evt.event_name.includes('comecar') ||
                evt.event_name.includes('cadastro');

              return (
                <div key={evt.id} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-white text-sm">
                        {formatEventName(evt.event_name)}
                      </span>
                      <span className="text-[#A1A1A6] text-xs font-mono truncate max-w-full" title={evt.page_path}>
                        {evt.page_path}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold text-xs">{timeFormatted}</span>
                      {!isToday && <span className="text-[10px] text-[#71717A] block">{dateFormatted}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {evt.event_type === 'page_view' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        <Eye className="w-2.5 h-2.5" /> Visita
                      </span>
                    ) : isConversionEvent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-[#F59E0B] border border-amber-500/25">
                        <Sparkles className="w-2.5 h-2.5" /> Conversão
                      </span>
                    ) : isFaithEvent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                        <Music2 className="w-2.5 h-2.5" /> Fé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-white border border-white/[0.1]">
                        <MousePointerClick className="w-2.5 h-2.5" /> Clique
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#71717A]">
                      {getDeviceIcon(evt.device_type)}
                      {evt.utm_source ? `UTM: ${evt.utm_source}` : evt.referrer || 'Direto'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table Content (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0A0A0C]/50 text-[#71717A] font-mono uppercase tracking-wider">
                <th className="py-3.5 px-5">Data / Hora</th>
                <th className="py-3.5 px-5">Tipo</th>
                <th className="py-3.5 px-5">Ação / Evento</th>
                <th className="py-3.5 px-5">Página</th>
                <th className="py-3.5 px-5">Dispositivo &amp; Navegador</th>
                <th className="py-3.5 px-5">Origem / Referrer</th>
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
                    Nenhum evento registrado.
                  </td>
                </tr>
              ) : (
                filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((evt) => {
                  const date = new Date(evt.created_at);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFormatted = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

                  const isFaithEvent = 
                    evt.page_path === '/playlist' || 
                    evt.event_name.includes('playlist') || 
                    evt.event_name.includes('versiculo') ||
                    evt.event_name.includes('spotify') ||
                    evt.event_name.includes('som_da_casa');

                  const isConversionEvent = 
                    evt.event_name.includes('cta') || 
                    evt.event_name.includes('plan') || 
                    evt.event_name.includes('comecar') ||
                    evt.event_name.includes('cadastro');

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
                        ) : isConversionEvent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-[#F59E0B] border border-amber-500/25">
                            <Sparkles className="w-2.5 h-2.5" /> Conversão
                          </span>
                        ) : isFaithEvent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                            <Music2 className="w-2.5 h-2.5" /> Louvor / Fé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-white border border-white/[0.1]">
                            <MousePointerClick className="w-2.5 h-2.5" /> Clique
                          </span>
                        )}
                      </td>

                      {/* Event Name */}
                      <td className="py-3 px-5 font-medium text-white max-w-[260px] truncate">
                        {formatEventName(evt.event_name)}
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <span className="text-[10px] text-[#A1A1A6] block truncate font-mono mt-0.5">
                            {JSON.stringify(evt.metadata)}
                          </span>
                        )}
                      </td>

                      {/* Page */}
                      <td className="py-3 px-5 font-mono text-[#D4D4D8] max-w-[200px]" title={evt.page_path}>
                        <div className={`px-1.5 py-0.5 rounded text-[11px] truncate w-full ${evt.page_path === '/playlist' ? 'bg-amber-500/10 text-[#F59E0B]' : 'bg-white/[0.04]'}`}>
                          {evt.page_path}
                        </div>
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
                          {evt.utm_source ? `UTM: ${evt.utm_source}` : evt.referrer || 'Direto'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer info */}
        <div className="p-4 bg-[#0A0A0C]/50 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <span>Feed com gravação contínua no Supabase ({filteredEvents.length} eventos listados)</span>
          
          <div className="flex items-center gap-2 bg-[#121216] border border-white/[0.08] rounded-xl p-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-white hover:bg-white/[0.1] disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-all"
            >
              &lt;
            </button>
            <span className="font-mono text-white px-2">
              Pág {currentPage} de {Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage))}
            </span>
            <button
              disabled={currentPage === Math.ceil(filteredEvents.length / itemsPerPage) || Math.ceil(filteredEvents.length / itemsPerPage) === 0}
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredEvents.length / itemsPerPage), p + 1))}
              className="px-3 py-1.5 rounded-lg text-white hover:bg-white/[0.1] disabled:opacity-30 disabled:hover:bg-transparent font-bold transition-all"
            >
              &gt;
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

