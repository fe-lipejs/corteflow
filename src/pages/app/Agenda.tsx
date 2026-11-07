import { useState, useMemo, useEffect } from 'react';
import { format, addWeeks, subWeeks, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, RefreshCw,
  Users, CheckCircle, Clock, DollarSign, Loader2, Bell
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { useAuth } from '../../hooks/useAuth';
import { useBarberSound } from '../../hooks/useBarberSound';
import { useProfessionals } from '../../hooks/useProfessionals';
import { useServices } from '../../hooks/useServices';
import { useTheme } from '../../contexts/ThemeContext';
import {
  useBookingsByWeek, useBookingsByDay,
  useCreateBooking, useUpdateBookingStatus, useDeleteBooking, useUpdateBooking,
  type Booking, type BookingStatus, type CreateBookingInput,
  useBookingsRealtime
} from '../../hooks/useBookings';
import { supabase } from '../../integrations/supabase/client';
import toast from 'react-hot-toast';
import { formatBookingHorizonSummary, isDateWithinBookingHorizon } from '../../lib/bookingHorizon';
import { useTenantBookingHorizon } from '../../hooks/useBookingHorizon';

import WeekView from './agenda/WeekView';
import DayView from './agenda/DayView';
import MobileTimeline from './agenda/MobileTimeline';
import BookingModal from './agenda/BookingModal';
import EditBookingModal from './agenda/EditBookingModal';
import BookingDetailSheet from './agenda/BookingDetailSheet';
import { UpgradeModal } from '../../components/UpgradeModal';
import PendingBookingsModal from './agenda/PendingBookingsModal';

type View = 'week' | 'day';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function Agenda() {
  const { tenant, role, professionalProfile } = useAuth();
  const { theme } = useTheme();
  const engine = usePermissionEngine();
  const tenantId = tenant?.id ?? '';
  const { maxAdvanceDays } = useTenantBookingHorizon(tenantId || null);
  const { play: playChime } = useBarberSound();

  const [view, setView] = useState<View>('week');
  const [currentDay, setCurrentDay] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfDay(currentDay), [currentDay]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [initialBookingDate, setInitialBookingDate] = useState<Date | undefined>();
  const [businessHours, setBusinessHours] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [hasScrolledCards, setHasScrolledCards] = useState(false);
  const [todayAnchor] = useState<Date>(() => new Date());

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch business hours
  useEffect(() => {
    if (!tenantId) return;
    supabase.from('business_hours').select('*').eq('tenant_id', tenantId).then(({ data }) => {
      setBusinessHours(data ?? []);
    });
  }, [tenantId]);

  const proScopeId = role === 'professional' ? professionalProfile?.id : undefined;

  // Data fetching
  const { data: weekBookings = [], isLoading: loadingWeek, refetch: refetchWeek, isFetching: fetchingWeek } = useBookingsByWeek(
    tenantId || null,
    weekStart,
    proScopeId
  );
  const { data: dayBookings = [], isLoading: loadingDay, refetch: refetchDay, isFetching: fetchingDay } = useBookingsByDay(
    tenantId || null,
    currentDay,
    proScopeId
  );
  const { data: rawTodayBookings = [], refetch: refetchToday } = useBookingsByDay(
    tenantId || null,
    todayAnchor,
    proScopeId
  );

  // Se for profissional, filtra a lista de profissionais apenas para ele mesmo para que o seletor da UI exiba apenas ele.
  const { data: allProfessionals = [] } = useProfessionals(tenantId || null);
  const professionals = useMemo(() => {
    const activeList = allProfessionals.filter(p => p.active !== false && (!p.status || p.status === 'active'));
    if (role === 'professional' && professionalProfile) {
      return activeList.filter(p => p.id === professionalProfile.id);
    }
    return activeList;
  }, [allProfessionals, role, professionalProfile]);

  const { data: services = [] } = useServices(tenantId || null);

  // Setup Realtime Bookings Listener
  useBookingsRealtime(tenantId || null);

  // Mutations
  const createBooking = useCreateBooking(tenantId);
  const updateStatus = useUpdateBookingStatus(tenantId);
  const updateBooking = useUpdateBooking(tenantId);
  const deleteBooking = useDeleteBooking(tenantId);

  // Active bookings for current context
  const isLoading = isMobile || view === 'day' ? loadingDay : loadingWeek;
  const isRefreshing = fetchingWeek || fetchingDay;

  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize from URL ?professional= query param (set when navigating from Equipe.tsx)
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(
    () => searchParams.get('professional')
  );

  // Deep-linking via Notificação Push ou Sino (?bookingId=...&date=...)
  useEffect(() => {
    if (!tenantId || engine.isLoading) return;

    const dateParam = searchParams.get('date');
    const bookingIdParam = searchParams.get('bookingId');

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [yy, mm, dd] = dateParam.split('-').map(Number);
      if (yy && mm && dd) {
        setCurrentDay(new Date(yy, mm - 1, dd));
      }
    }

    if (!bookingIdParam) return;

    let cancelled = false;

    const loadTargetBooking = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(id, name, phone, email, segment, total_spent, visit_count, last_visit, past_services),
          professional:professionals(id, name, agenda_color, photo_url),
          service:services(id, name, duration_minutes, buffer_minutes, color, price, commission_pct)
        `)
        .eq('id', bookingIdParam)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (cancelled || error || !data) return;

      const targetBooking = data as unknown as Booking;

      // Respeitar isolamento de permissão do profissional
      const canSeeAll = engine.hasPermission('agenda.visualizar_todos');
      if (!canSeeAll && professionalProfile?.id && targetBooking.professional_id !== professionalProfile.id) {
        toast.error('Você não possui permissão para visualizar agendamentos de outro profissional.');
        return;
      }

      if (targetBooking.scheduled_at) {
        setCurrentDay(new Date(targetBooking.scheduled_at));
      }
      setSelectedBooking(targetBooking);

      // Limpar bookingId da URL após abrir para permitir fechar o modal normalmente
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('bookingId');
      setSearchParams(nextParams, { replace: true });
    };

    loadTargetBooking();

    return () => {
      cancelled = true;
    };
  }, [tenantId, engine.isLoading, engine.hasPermission, professionalProfile?.id, searchParams, setSearchParams]);

  // Se o usuário NÃO tiver permissão para visualizar todos, filtra a agenda automaticamente para ele mesmo
  useEffect(() => {
    if (!engine.isLoading && !engine.hasPermission('agenda.visualizar_todos')) {
      if (professionalProfile?.id && selectedProfessionalId !== professionalProfile.id) {
        setSelectedProfessionalId(professionalProfile.id);
      }
    }
  }, [engine.isLoading, engine.hasPermission, professionalProfile?.id, selectedProfessionalId]);

  const filteredWeekBookings = useMemo(() => {
    if (!selectedProfessionalId) return weekBookings;
    return weekBookings.filter(b => b.professional_id === selectedProfessionalId);
  }, [weekBookings, selectedProfessionalId]);

  const filteredDayBookings = useMemo(() => {
    if (!selectedProfessionalId) return dayBookings;
    return dayBookings.filter(b => b.professional_id === selectedProfessionalId);
  }, [dayBookings, selectedProfessionalId]);

  const mobileTimelineBookings = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of filteredWeekBookings) map.set(b.id, b);
    for (const b of filteredDayBookings) map.set(b.id, b);
    return Array.from(map.values());
  }, [filteredWeekBookings, filteredDayBookings]);

  // Today's stats (sempre preserva os dados reais de hoje mesmo quando o usuário navega para outras semanas)
  const todayBookings = useMemo(() => {
    if (!selectedProfessionalId) return rawTodayBookings;
    return rawTodayBookings.filter(b => b.professional_id === selectedProfessionalId);
  }, [rawTodayBookings, selectedProfessionalId]);

  const stats = useMemo(() => {
    const revenue = todayBookings.reduce((s, b) => s + (b.amount_total || 0), 0);
    const completed = todayBookings.filter(b => b.status === 'completed').length;
    const inProgress = todayBookings.filter(b => b.status === 'in_progress' || b.status === 'arrived').length;
    const pending = todayBookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length;
    const total = todayBookings.length;
    return { total, completed, inProgress, pending, revenue };
  }, [todayBookings]);

  // Next booking
  const nextBooking = useMemo(() => {
    const now = new Date();
    return todayBookings
      .filter(b => new Date(b.scheduled_at) > now && b.status !== 'canceled' && b.status !== 'no_show')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  }, [todayBookings]);

  const handleSlotClick = (date: Date, hour: number) => {
    if (!engine.hasPermission('agenda.criar')) {
      setShowUpgradeModal('agenda.criar');
      return;
    }
    if (!isDateWithinBookingHorizon(date, maxAdvanceDays)) {
      toast.error(`Fora da antecedência máxima configurada: ${formatBookingHorizonSummary(maxAdvanceDays)}.`);
      return;
    }
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    setInitialBookingDate(d);
    setBookingModalOpen(true);
  };

  const handleCreate = async (input: CreateBookingInput) => {
    if (!engine.hasPermission('agenda.criar')) {
      setShowUpgradeModal('agenda.criar');
      return;
    }
    await createBooking.mutateAsync(input);
    setBookingModalOpen(false);
  };

  const handleStatusChange = async (id: string, status: BookingStatus) => {
    if (!engine.hasPermission('agenda.mudar_status')) {
      setShowUpgradeModal('agenda.mudar_status');
      return;
    }
    await updateStatus.mutateAsync({ id, status });
    if (selectedBooking?.id === id) {
      if (status === 'canceled' || status === 'no_show') {
        setSelectedBooking(null);
      } else {
        setSelectedBooking(prev => prev ? {
          ...prev,
          status,
          ...(status === 'completed' ? { amount_paid: prev.amount_total, payment_status: 'paid' } : {})
        } : null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!engine.hasPermission('agenda.cancelar')) {
      setShowUpgradeModal('agenda.cancelar');
      return;
    }
    await deleteBooking.mutateAsync(id);
    if (selectedBooking?.id === id) {
      setSelectedBooking(null);
    }
  };

  const handleRefreshAll = () => {
    refetchWeek();
    refetchDay();
    refetchToday();
  };

  if (!engine.isLoading && !engine.hasPermission('agenda.visualizar_todos') && !engine.hasPermission('agenda.visualizar_minha')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-black/40" />
        </div>
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-sm text-black/60 max-w-md">
          Você não possui permissão para visualizar agendamentos.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full max-w-7xl mx-auto w-full animate-fade-in" style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 mb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>Gestão</p>
              <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Agenda</h1>
            </div>

            {/* Desktop controls */}
            <div className="hidden md:flex items-center gap-3">
              {/* Nav */}
              <div className="flex items-center gap-1 rounded-xl border px-1 py-1 glass-card">
                <button onClick={() => {
                  if (view === 'week') {
                    setCurrentDay(d => subWeeks(d, 1));
                  } else {
                    setCurrentDay(d => addDays(d, -1));
                  }
                }} className="p-2 rounded-lg transition-all hover:bg-[var(--theme-bg-hover)]" style={{ color: theme.textSecondary }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => { setCurrentDay(new Date()); }} className="px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer" style={{ color: theme.textPrimary }}>
                  Hoje
                </button>
                <label className="relative px-2 py-1 rounded-lg hover:bg-[var(--theme-bg-hover)] text-sm font-semibold min-w-[145px] text-center capitalize cursor-pointer transition-colors" style={{ color: theme.textPrimary }} title="Clique para ir a uma data específica">
                  {view === 'week'
                    ? `${format(weekStart, "dd MMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "dd MMM", { locale: ptBR })}`
                    : format(currentDay, "dd 'de' MMMM", { locale: ptBR })
                  }
                  <input
                    type="date"
                    value={format(currentDay, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [yy, mm, dd] = e.target.value.split('-').map(Number);
                      setCurrentDay(new Date(yy, mm - 1, dd));
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
                <button onClick={() => {
                  if (view === 'week') {
                    setCurrentDay(d => addWeeks(d, 1));
                  } else {
                    setCurrentDay(d => addDays(d, 1));
                  }
                }} className="p-2 rounded-lg transition-all hover:bg-[var(--theme-bg-hover)]" style={{ color: theme.textSecondary }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* View toggle */}
              <div className="flex p-1 rounded-xl border gap-0.5 glass-card">
                {(['week', 'day'] as View[]).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === v ? '' : 'hover:opacity-80'}`}
                    style={{
                      color: view === v ? theme.btnPrimaryText : theme.textSecondary,
                      background: view === v ? theme.accentGradient : 'transparent',
                      boxShadow: view === v ? theme.shadowAccent : 'none',
                    }}
                  >
                    {v === 'week' ? 'Semana' : 'Dia'}
                  </button>
                ))}
              </div>

              <button onClick={handleRefreshAll} className="p-2 rounded-xl border transition-all glass-card" style={{ color: theme.textSecondary, borderColor: theme.cardBorder }} title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Sound test button */}
              <button
                onClick={() => playChime('booking')}
                className="p-2 rounded-xl border transition-all glass-card"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
                title="Testar som de novo agendamento"
              >
                <Bell className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (!engine.hasPermission('agenda.criar')) {
                    setShowUpgradeModal('agenda.criar');
                    return;
                  }
                  setInitialBookingDate(undefined);
                  setBookingModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
              >
                <Plus className="w-4 h-4" /> Novo
              </button>
            </div>
          </div>

          {/* Professional Filters & Stats row */}
          <div className="flex flex-col gap-3">
            {/* Stats cards — 7 cols on lg so all 7 KPI cards sit cleanly on 1 row */}
            <div className="relative">
              <div
                onScroll={() => setHasScrolledCards(true)}
                className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-7 gap-2.5 pb-2 md:pb-0 scrollbar-none snap-x relative z-10"
              >
                {[
                  { label: 'Hoje', value: stats.total, icon: Calendar, color: theme.accent },
                  { label: 'Confirmados', value: stats.pending, icon: Clock, color: '#f59e0b' },
                  { label: 'Esquecidos', value: 'Ver Lista', icon: Bell, color: '#ef4444', isButton: true },
                  { label: 'Finalizados', value: stats.completed, icon: CheckCircle, color: theme.success },
                  { label: 'Em atendimento', value: stats.inProgress, icon: Users, color: '#a78bfa' },
                  { label: 'Próximo', value: nextBooking ? format(new Date(nextBooking.scheduled_at), 'HH:mm') : '—', icon: Clock, color: theme.info },
                  { label: 'Receita hoje', value: fmt.format(stats.revenue), icon: DollarSign, color: theme.warning },
                ].map((s, i) => (
                  <div
                    key={i}
                    onClick={() => s.isButton ? setShowPendingModal(true) : undefined}
                    className={`flex flex-col flex-shrink-0 min-w-[135px] md:min-w-0 p-2.5 rounded-2xl border glass-card ${s.isButton ? 'cursor-pointer hover:scale-[1.02] transition-transform bg-red-500/5 border-red-500/20' : ''}`}
                    style={{ borderColor: s.isButton ? undefined : theme.border }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className={`text-lg font-bold font-display truncate ${s.isButton ? 'text-xs mt-0.5' : ''}`} style={{ color: s.isButton ? s.color : theme.textPrimary }}>
                          {isLoading && !s.isButton ? '—' : s.value}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 truncate" style={{ color: theme.textSecondary }}>{s.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Swipe indicator */}
              {!hasScrolledCards && isMobile && (
                <div
                  className="absolute right-0 top-0 bottom-2 w-16 z-20 pointer-events-none flex items-center justify-end pr-1"
                  style={{ background: `linear-gradient(to left, ${theme.bg}, transparent)` }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center animate-pulse shadow-sm" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}` }}>
                    <ChevronRight className="w-4 h-4" style={{ color: theme.textSecondary }} />
                  </div>
                </div>
              )}
            </div>

            {/* Professional Filter Chips (Desktop & Mobile) */}
            {professionals.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-bold shrink-0 mr-1" style={{ color: theme.textSecondary }}>Filtrar por:</span>
                <button
                  onClick={() => {
                    if (!engine.hasPermission('agenda.visualizar_todos')) {
                      return;
                    }
                    setSelectedProfessionalId(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border"
                  style={{
                    color: selectedProfessionalId === null ? theme.btnPrimaryText : theme.textSecondary,
                    background: selectedProfessionalId === null ? theme.accentGradient : theme.cardBg,
                    borderColor: selectedProfessionalId === null ? theme.accent : theme.cardBorder,
                    boxShadow: selectedProfessionalId === null ? theme.shadowAccent : 'none',
                  }}
                >
                  Todos os Profissionais
                </button>
                {professionals.map(p => {
                  const isSelected = selectedProfessionalId === p.id;
                  const accent = p.agenda_color || (p as any).cor_agenda || theme.accent;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProfessionalId(isSelected ? null : p.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border"
                      style={{
                        color: isSelected ? '#fff' : theme.textSecondary,
                        background: isSelected ? accent : theme.cardBg,
                        borderColor: isSelected ? 'transparent' : theme.cardBorder,
                        boxShadow: 'none',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: isSelected ? '#fff' : accent }} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Calendar body ── */}
        <div className="flex-1 min-h-0 rounded-2xl border overflow-hidden glass-card">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accent }} />
            </div>
          )}

          {!isLoading && (
            <>
              {/* Mobile */}
              <div className="md:hidden h-full">
                <MobileTimeline
                  currentDay={currentDay}
                  bookings={mobileTimelineBookings}
                  maxAdvanceDays={maxAdvanceDays}
                  onDayChange={setCurrentDay}
                  onBookingClick={setSelectedBooking}
                  onNewBooking={(preferredDate) => {
                    if (!engine.hasPermission('agenda.criar')) {
                      setShowUpgradeModal('agenda.criar');
                      return;
                    }
                    setInitialBookingDate(preferredDate);
                    setBookingModalOpen(true);
                  }}
                />
              </div>

              {/* Desktop */}
              <div className="hidden md:flex flex-col h-full w-full">
                {view === 'week' ? (
                  <WeekView
                    weekStart={weekStart}
                    bookings={filteredWeekBookings}
                    businessHours={businessHours}
                    selectedProfessionalId={selectedProfessionalId}
                    maxAdvanceDays={maxAdvanceDays}
                    onBookingClick={setSelectedBooking}
                    onSlotClick={handleSlotClick}
                  />
                ) : (
                  <DayView
                    day={currentDay}
                    bookings={filteredDayBookings}
                    businessHours={businessHours}
                    selectedProfessionalId={selectedProfessionalId}
                    maxAdvanceDays={maxAdvanceDays}
                    onBookingClick={setSelectedBooking}
                    onSlotClick={handleSlotClick}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Booking Creation Modal ── */}
        {bookingModalOpen && (
          <BookingModal
            tenantId={tenantId}
            services={services}
            professionals={professionals}
            businessHours={businessHours}
            initialDate={initialBookingDate}
            onClose={() => setBookingModalOpen(false)}
            onCreate={handleCreate}
            isLoading={createBooking.isPending}
          />
        )}

        {/* ── Booking Detail Sheet ── */}
        {selectedBooking && (
          <BookingDetailSheet
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onEdit={(b) => {
              if (!engine.hasPermission('agenda.editar')) {
                setShowUpgradeModal('agenda.editar');
                return;
              }
              setEditingBooking(b);
            }}
            isUpdating={updateStatus.isPending || deleteBooking.isPending}
          />
        )}

        {/* ── Booking Edit / Reschedule Modal (Protegido por agenda.editar) ── */}
        {editingBooking && (
          <EditBookingModal
            tenantId={tenantId}
            booking={editingBooking}
            services={services}
            professionals={professionals}
            businessHours={businessHours}
            onClose={() => setEditingBooking(null)}
            onSave={async (fields) => {
              if (!engine.hasPermission('agenda.editar')) {
                setShowUpgradeModal('agenda.editar');
                return;
              }
              await updateBooking.mutateAsync(fields);
              setEditingBooking(null);
              setSelectedBooking(null);
            }}
            isLoading={updateBooking.isPending}
          />
        )}

        {/* ── Modal: Upgrade Plan ── */}
        {showUpgradeModal && (
          <UpgradeModal
            feature={showUpgradeModal}
            onClose={() => setShowUpgradeModal(null)}
          />
        )}

        {showPendingModal && (
          <PendingBookingsModal
            tenantId={tenantId}
            onClose={() => setShowPendingModal(false)}
            onBookingClick={(b) => {
              setShowPendingModal(false);
              setSelectedBooking(b);
            }}
          />
        )}
      </div>
    </>
  );
}
