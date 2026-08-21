import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenantSlug } from '../../hooks/useTenantSlug';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCancelBooking, useRescheduleBooking, useBookingsRealtime } from '../../hooks/useBookings';
import { format, isBefore, addHours, startOfDay, addDays } from 'date-fns';
import { generateAvailableSlots } from '../../lib/availability';
import type { Slot } from '../../lib/availability';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, ArrowLeft, Loader2, ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { usePhoneFormat } from '../../hooks/usePhoneFormat';
import { getThemeById, adjustColorBrightness } from '../../contexts/ThemeContext';
import { usePublicStore } from '../../hooks/usePublicStore';
import { motion, AnimatePresence } from 'framer-motion';
import { getThemeContrastEngine } from '../../lib/themeEngine';

export default function ClientPortal() {
  const slugFromHook = useTenantSlug();
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugFromHook ?? paramSlug ?? undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const phoneFormat = usePhoneFormat("pt");

  const [phone, setPhone] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const { data: storeData, isLoading: loadingStore } = usePublicStore(slug || '');
  const tenant = storeData?.tenant;
  
  // Habilitar atualizações em tempo real para o portal do cliente
  useBookingsRealtime(tenant?.id || null);

  // Cancel State
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Reschedule State
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState<string>('');

  // Tenant Info

  // Bookings Fetch
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['customer-bookings', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (id, name, price, duration_minutes),
          professionals (id, name, photo_url)
        `)
        .eq('customer_id', customerId)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!customerId,
  });

  const cancelMutation = useCancelBooking();
  const rescheduleMutation = useRescheduleBooking();

  const availableDays = useMemo(() => {
    const days: { date: Date; isOpen: boolean }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const h = storeData?.businessHours?.find((x: any) => x.weekday === d.getDay());
      days.push({ date: d, isOpen: h?.is_open === true });
    }
    return days;
  }, [storeData?.businessHours]);

  const availableSlots: Slot[] = useMemo(() => {
    if (!newDate || !rescheduleBooking) return [];
    
    const service = storeData?.services?.find((s: any) => s.id === rescheduleBooking.service_id);
    if (!service) return [];
    
    return generateAvailableSlots(
      newDate, service, rescheduleBooking.professional_id,
      storeData?.professionals || [], storeData?.services || [], storeData?.businessHours || [],
      storeData?.professionalWorkingHours || [], storeData?.professionalBlockedTimes || [],
      storeData?.bookings || [], storeData?.professionalServices || [],
      [service]
    );
  }, [newDate, rescheduleBooking, storeData]);

  const visibleSlots = useMemo(() => {
    return availableSlots.filter(
      (s) => s.available || (s.unavailableReason !== 'past' && s.unavailableReason !== 'no_fit')
    );
  }, [availableSlots]);

  const settings = storeData?.settings;
  const theme = useMemo(() => {
    const presetId = settings?.theme_preset || "classic";
    const base = getThemeById(presetId);
    if (!settings?.custom_palette) return base;

    const palette = settings.custom_palette;
    let btnTextColor = base.btnPrimaryText;
    if (palette.primary) {
      const hex = palette.primary.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) || 201;
      const g = parseInt(hex.substring(2, 4), 16) || 150;
      const b = parseInt(hex.substring(4, 6), 16) || 59;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      btnTextColor = lum > 145 ? "#0F172A" : "#FFFFFF";
    }

    const bgHex = (palette.background || base.bg).replace("#", "");
    const bgR = parseInt(bgHex.substring(0, 2), 16) || 14;
    const bgG = parseInt(bgHex.substring(2, 4), 16) || 16;
    const bgB = parseInt(bgHex.substring(4, 6), 16) || 19;
    const bgLum = 0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB;
    const isDarkBg = bgLum < 135;

    const dynamicBorder = isDarkBg ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
    const dynamicTextSecondary = isDarkBg ? "#A1A1AA" : "#475569";
    const dynamicTextMuted = isDarkBg ? "#71717A" : "#64748B";

    const fontSerif =
      palette.fontStyle === "sans"
        ? "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
        : "'Playfair Display', Georgia, serif";

    return {
      ...base,
      fontSerif,
      ...(palette.background && { bg: palette.background }),
      ...(palette.text && { textPrimary: palette.text }),
      textSecondary: dynamicTextSecondary,
      textMuted: dynamicTextMuted,
      border: dynamicBorder,
      cardBorder: dynamicBorder,
      inputBorder: dynamicBorder,
      ...(palette.card && {
        cardBg: palette.card,
        bgCard: palette.card,
        bgSidebar: palette.card,
        sidebarBg: palette.card,
        inputBg: isDarkBg ? "#121417" : "#FFFFFF",
        bgInput: isDarkBg ? "#121417" : "#FFFFFF",
      }),
      ...(palette.primary && {
        accent: palette.primary,
        accentLight: adjustColorBrightness(palette.primary, 15),
        accentHover: adjustColorBrightness(palette.primary, 8),
        accentMuted: `${palette.primary}25`,
        accentGradient: `linear-gradient(135deg, ${palette.primary}, ${adjustColorBrightness(palette.primary, 18)})`,
        btnPrimaryBg: `linear-gradient(135deg, ${palette.primary}, ${adjustColorBrightness(palette.primary, 18)})`,
        btnPrimaryText: btnTextColor,
        btnPrimaryHover: `0 0 20px ${palette.primary}60`,
        borderActive: palette.primary,
        inputFocusBorder: palette.primary,
        shadowAccent: `0 0 20px ${palette.primary}40`,
      }),
    };
  }, [settings?.theme_preset, settings?.custom_palette]);
  
  const contrast = useMemo(() => getThemeContrastEngine(theme), [theme]);

  // ── Favicon ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (settings?.logo_url) {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = settings.logo_url;
      document.head.appendChild(link);
    }
  }, [settings?.logo_url]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !tenant) return;
    setLoading(true);

    try {
      // FIX #5: bookings save phone as raw digits only (cleanPhone = customerPhone.replace(/\D/g, ''))
      // So we must search with digits-only too — NOT with the formatted mask version
      const cleanPhone = phone.replace(/\D/g, '');
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (data) {
        setCustomerId(data.id);
        setIsLogged(true);
      } else {
        alert('Nenhum agendamento encontrado para este telefone.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (booking: any) => {
    const settings = storeData?.settings;
    if (!settings) return;

    if (!settings.allow_cancel) {
      alert('O salão não permite cancelamentos pelo portal.');
      return;
    }

    const scheduledDate = new Date(booking.scheduled_at);
    
    // Calcula o prazo máximo onde o cancelamento ainda é 100% grátis
    const freeDeadlineDate = new Date(scheduledDate);
    freeDeadlineDate.setHours(freeDeadlineDate.getHours() - (settings.cancel_free_hours_before || 2));
    
    const now = new Date();

    if (now > freeDeadlineDate) {
      // Passou do prazo gratuito, verificar se cobra multa
      const feePercent = settings.cancel_fee_percent || 0;
      if (feePercent > 0) {
        const confirmCancel = window.confirm(`ATENÇÃO: Você está cancelando com menos de ${settings.cancel_free_hours_before}h de antecedência.\n\nUma multa de ${feePercent}% será aplicada sobre o valor pago.\n\nDeseja confirmar o cancelamento?`);
        if (!confirmCancel) return;
      } else {
        const confirmCancel = window.confirm('Você está cancelando em cima da hora, mas o salão não cobra multa. Deseja confirmar?');
        if (!confirmCancel) return;
      }
    }

    setCancelReason("Imprevisto");
    setBookingToCancel(booking);
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;
    setLoading(true);
    try {
      await cancelMutation.mutateAsync({
        bookingId: bookingToCancel.id,
        reason: cancelReason,
        actorType: 'client'
      });
      alert('Agendamento cancelado com sucesso!');
      qc.invalidateQueries({ queryKey: ['customer-bookings', customerId] });
      setBookingToCancel(null);
    } catch (err: any) {
      alert(`Erro ao cancelar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newDate || !newTime) return;

    const settings = storeData?.settings;
    if (!settings) return;

    const scheduledDate = new Date(rescheduleBooking.scheduled_at);
    
    // Prazo máximo onde reagendamento é permitido (mesmo comportamento antigo, mas corrigido o state)
    const deadlineDate = new Date(scheduledDate);
    deadlineDate.setHours(deadlineDate.getHours() - (settings.reschedule_deadline_hours || 24));

    const now = new Date();

    if (now > deadlineDate) {
      alert(`Você não pode reagendar em cima da hora. O prazo máximo para reagendamento é de ${settings.reschedule_deadline_hours} horas de antecedência.`);
      return;
    }

    try {
      setLoading(true);
      
      const tzOffsetMin = -new Date().getTimezoneOffset();
      const pad = (n: number) => String(n).padStart(2, '0');
      const tzSign = tzOffsetMin >= 0 ? '+' : '-';
      const tzAbs = Math.abs(tzOffsetMin);
      const tzStr = `${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;
      const scheduledAt = `${format(newDate, "yyyy-MM-dd")}T${newTime}:00${tzStr}`;

      await rescheduleMutation.mutateAsync({
        bookingId: rescheduleBooking.id,
        newTime: scheduledAt,
        newProId: rescheduleBooking.professional_id, // keep the same professional for now
        actorType: 'client'
      });
      alert('Agendamento reagendado com sucesso!');
      setRescheduleBooking(null);
      qc.invalidateQueries({ queryKey: ['customer-bookings', customerId] });
    } catch (err: any) {
      alert(`Erro ao reagendar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingStore) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#F59E0B] mb-6" />
        <p className="text-xs text-[#A1A1A6] mt-2 font-mono leading-relaxed text-center max-w-xs">
          Buscando histórico e reservas ativas…
        </p>

        <div className="flex items-center gap-2 mt-12 text-[10px] font-mono text-[#71717A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          Portal do Cliente
        </div>
      </div>
    );
  }

  const isTenantInactive = !tenant || Boolean(tenant.deleted_at) || ['blocked', 'suspended', 'deleted', 'canceled'].includes(tenant.status) || (tenant.status !== 'active' && tenant.status !== 'trial');

  if (isTenantInactive) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertTriangle className="w-8 h-8 text-[#F59E0B] mb-6 opacity-80" />
        <p className="text-sm text-[#A1A1A6] leading-relaxed mb-8 max-w-xs mx-auto">
          O portal do cliente para este estabelecimento não está acessível no momento pois a conta foi desativada ou está temporariamente suspensa.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-8 py-3 rounded-full font-medium text-sm text-[#A1A1A6] border border-white/[0.08] hover:bg-white/[0.04] hover:text-white transition-colors"
        >
          Voltar
        </button>
        <div className="flex items-center gap-2 mt-12 text-[10px] font-mono text-[#71717A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          Raffros · Gestão &amp; Agendamento
        </div>
      </div>
    );
  }



  const isDark = contrast.isDark;
  const sidebarBackground = isDark ? theme.sidebarBg : "#FFFFFF";
  const cardBorderColor = isDark ? theme.cardBorder : "#E5E7EB";
  const storeName = settings?.fantasy_name || tenant?.name || "";

  const storeHeader = (
    <div className="relative mb-6">
      {/* Cover Banner */}
      <div className="relative w-full h-44 sm:h-52 shrink-0 overflow-hidden bg-neutral-900">
        {settings?.banner_url ? (
          <>
            <img
              src={settings.banner_url}
              alt="Capa"
              className="w-full h-full object-cover scale-105"
              style={{ filter: isDark ? "brightness(0.9)" : "brightness(0.98)" }}
            />
            {isDark && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to top, ${sidebarBackground} 0%, rgba(0,0,0,0.7) 30%, transparent 70%)`,
                }}
              />
            )}
          </>
        ) : (
          <div
            className="w-full h-full relative"
            style={{
              background: `linear-gradient(135deg, ${theme.accent}25 0%, ${sidebarBackground} 100%)`,
            }}
          />
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate(`/${slug}`)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl text-white text-[11px] font-bold shadow-xl border border-white/20 transition-all active:scale-95 hover:bg-black/70 font-sans"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Salão</span>
        </button>
      </div>

      {/* Profile & Info Content */}
      <div className="px-6 sm:px-8 relative z-10 flex flex-col items-center text-center -mt-16 sm:-mt-20 pb-8">
        {/* Avatar */}
        <div className="relative mb-3.5">
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden relative"
            style={{
              border: `4px solid ${sidebarBackground}`,
              background: isDark ? "#1A1A1A" : "#F1F5F9",
              boxShadow: isDark
                ? `0 12px 36px -4px rgba(0,0,0,0.7), 0 0 0 1px ${cardBorderColor}`
                : `0 12px 30px -4px rgba(0,0,0,0.1), 0 0 0 1px ${cardBorderColor}`,
            }}
          >
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={storeName} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-black text-3xl sm:text-4xl"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)`,
                  color: theme.btnPrimaryText,
                }}
              >
                {storeName.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-1" style={{ borderColor: `${theme.accent}40`, backgroundColor: `${theme.accent}15`, color: theme.accent }}>
          Portal do Cliente
        </span>
        
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: contrast.titleColor, fontFamily: theme.fontSerif }}>
          {storeName}
        </h1>
        
        <p className="text-[13px] sm:text-[14px] mt-0.5 font-medium max-w-[320px] leading-relaxed" style={{ color: contrast.descriptionColor }}>
          {settings?.slogan || settings?.short_description || settings?.address || "Gerencie seus agendamentos e histórico completo."}
        </p>

        {isLogged && (
          <button
            onClick={() => { setIsLogged(false); setCustomerId(null); setPhone(''); }}
            className="text-xs font-bold underline opacity-80 hover:opacity-100 transition-opacity mt-2"
            style={{ color: theme.textSecondary }}
          >
            Sair desta conta
          </button>
        )}
      </div>
    </div>
  );

  if (!isLogged) {
    return (
      <div className="min-h-screen pb-16 transition-colors" style={{ backgroundColor: theme.bg, color: theme.textPrimary, fontFamily: theme.fontSerif }}>
        {storeHeader}

        <div className="max-w-md mx-auto px-4">
          <div className="rounded-3xl p-8 shadow-2xl border backdrop-blur-xl" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <div className="text-center mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border mx-auto mb-3" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30`, color: theme.accent }}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold mb-1" style={{ color: theme.textPrimary }}>Acessar Meus Agendamentos</h2>
              <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                Digite seu número de WhatsApp para consultar, reagendar ou cancelar seus horários no salão <strong>{tenant.name}</strong>.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textPrimary }}>Número do WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(phoneFormat.format(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="w-full p-3.5 rounded-2xl border focus:ring-2 focus:outline-none transition-all font-mono text-sm"
                  style={{ 
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                    outlineColor: theme.accent
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-98 shadow-lg"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Portal →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const futureBookings = bookings.filter((b) => new Date(b.scheduled_at) >= new Date() && !['canceled', 'no_show', 'completed'].includes(b.status));
  const pastBookings = bookings.filter((b) => new Date(b.scheduled_at) < new Date() || ['canceled', 'no_show', 'completed'].includes(b.status));

  return (
    <div className="min-h-screen pb-20 transition-colors" style={{ backgroundColor: theme.bg, color: theme.textPrimary, fontFamily: theme.fontSerif }}>
      {storeHeader}

      <div className="max-w-3xl mx-auto px-4 space-y-8">
        <section>
          <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
            <Calendar className="w-5 h-5" style={{ color: theme.accent }} /> 
            Próximos Agendamentos
          </h2>
          
          {futureBookings.length === 0 ? (
            <div className="p-8 text-center rounded-3xl border border-dashed backdrop-blur-xl" style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}>
              <p className="text-sm font-medium" style={{ color: theme.textSecondary }}>Você não tem nenhum agendamento futuro no momento.</p>
              <button
                onClick={() => navigate(`/${slug}`)}
                className="mt-4 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-transform hover:scale-105 active:scale-95"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
              >
                Agendar Novo Horário
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {futureBookings.map((b) => (
                <div key={b.id} className="rounded-3xl p-6 shadow-xl border backdrop-blur-xl transition-all" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex justify-between items-start mb-4 border-b pb-4" style={{ borderColor: theme.border }}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border" style={{ color: theme.textSecondary, borderColor: theme.border, backgroundColor: theme.inputBg }}>
                          #{b.order_number}
                        </span>
                      </div>
                      <h3 className="font-serif font-bold text-xl" style={{ color: theme.textPrimary }}>{b.services?.name}</h3>
                      <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>com <strong>{b.professionals?.name || 'Profissional'}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif font-extrabold text-2xl" style={{ color: theme.accent }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.amount_total)}
                      </p>
                      <div className="flex flex-col items-end gap-1 mt-1">
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}>
                          {b.status === 'confirmed' ? 'Confirmado' : b.status === 'pending' ? 'Pendente' : b.status}
                        </span>
                        {b.payment_status && (
                          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase" style={{ backgroundColor: b.payment_status === 'paid' ? '#10b98120' : b.payment_status === 'partial_paid' ? '#f59e0b20' : '#ef444420', color: b.payment_status === 'paid' ? '#10b981' : b.payment_status === 'partial_paid' ? '#f59e0b' : '#ef4444' }}>
                            {b.payment_status === 'paid' ? 'Pago Integral' : b.payment_status === 'partial_paid' ? 'Sinal Pago' : b.payment_status === 'refunded' ? 'Estornado' : b.payment_status === 'failed' ? 'Falha no Pagamento' : b.payment_status === 'pending' ? 'Aguardando Pagamento' : b.payment_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div className="flex items-center gap-4 text-sm" style={{ color: theme.textPrimary }}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="font-bold">{format(new Date(b.scheduled_at), "dd/MM/yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" style={{ color: theme.accent }} />
                        <span className="font-bold">{format(new Date(b.scheduled_at), "HH:mm")}h</span>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {settings?.allow_cancel && (
                        <button 
                          onClick={() => handleCancelClick(b)}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      {settings?.allow_reschedule && (b.status === 'pending' || b.status === 'confirmed') && (
                        <button 
                          onClick={() => {
                            setRescheduleBooking(b);
                            // Set to a Date object, not a string
                            setNewDate(startOfDay(new Date(b.scheduled_at)));
                            setNewTime('');
                          }}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 shadow-md"
                          style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
                        >
                          Reagendar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pt-4">
          <h2 className="text-xl font-serif font-bold mb-4 opacity-80" style={{ color: theme.textPrimary }}>Histórico Passado</h2>
          <div className="space-y-3">
            {pastBookings.map((b) => (
              <div key={b.id} className="rounded-2xl p-4 border opacity-75 flex items-center justify-between" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>{b.services?.name}</h4>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{format(new Date(b.scheduled_at), "dd/MM/yyyy 'às' HH:mm")} • com {b.professionals?.name}</p>
                </div>
                <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full border" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                  {b.status === 'canceled' ? 'Cancelado' : b.status === 'completed' ? 'Concluído' : b.status}
                </span>
              </div>
            ))}
            {pastBookings.length === 0 && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>Nenhum histórico passado encontrado.</p>
            )}
          </div>
        </section>
      </div>

      {/* Cancel Modal */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-md p-7 rounded-3xl shadow-2xl border" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <h3 className="text-2xl font-serif font-bold mb-2 text-red-500">Cancelar Agendamento</h3>
            
            {tenant?.tenant_settings?.[0]?.cancel_policy_text && (
              <div className="p-4 rounded-xl mb-4 text-xs bg-red-500/10 text-red-600 border border-red-500/20">
                <strong>Política de Cancelamento:</strong><br />
                {tenant.tenant_settings[0].cancel_policy_text}
                {tenant.tenant_settings[0].cancel_fee_amount > 0 && (
                  <p className="mt-2 font-bold">Taxa aplicável: R$ {tenant.tenant_settings[0].cancel_fee_amount.toFixed(2)}</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textPrimary }}>Motivo do Cancelamento (opcional)</label>
              <textarea 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3.5 rounded-2xl border focus:ring-2 focus:outline-none transition-all text-sm font-sans"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary, outlineColor: theme.accent }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBookingToCancel(null)}
                className="flex-1 py-3.5 rounded-2xl font-bold border text-xs transition-colors"
                style={{ borderColor: theme.border, color: theme.textPrimary }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl font-bold text-xs flex justify-center items-center gap-2 transition-all hover:opacity-90 shadow-md bg-red-500 text-white"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex flex-col p-0 sm:p-4 bg-black/60 backdrop-blur-md sm:justify-center sm:items-center">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md p-6 rounded-none sm:rounded-3xl shadow-2xl border flex flex-col bg-white" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-serif font-bold" style={{ color: theme.textPrimary }}>Reagendar</h3>
                <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>{rescheduleBooking.services?.name}</p>
              </div>
              <button onClick={() => setRescheduleBooking(null)} className="p-2 rounded-full hover:bg-black/5" style={{ color: theme.textPrimary }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
              {/* Data */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: theme.textSecondary }}>
                  <Calendar className="w-4 h-4" /> Nova Data
                </h4>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {availableDays.map((day, i) => {
                    const isSelected = newDate && format(newDate, 'yyyy-MM-dd') === format(day.date, 'yyyy-MM-dd');
                    return (
                      <button
                        key={i}
                        disabled={!day.isOpen}
                        onClick={() => { setNewDate(day.date); setNewTime(''); }}
                        className="flex-shrink-0 w-[4.5rem] p-3 rounded-2xl border flex flex-col items-center justify-center transition-all relative overflow-hidden"
                        style={{
                          backgroundColor: isSelected ? theme.accent : theme.inputBg,
                          borderColor: isSelected ? theme.accent : theme.inputBorder,
                          color: isSelected ? theme.btnPrimaryText : day.isOpen ? theme.textPrimary : theme.textMuted,
                          opacity: day.isOpen ? 1 : 0.4,
                        }}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wider mb-1 opacity-80">{format(day.date, 'EEE', { locale: ptBR })}</span>
                        <span className="text-xl font-bold font-serif">{format(day.date, 'dd')}</span>
                        {isSelected && <div className="absolute inset-0 bg-white/20" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horários */}
              <AnimatePresence mode="popLayout">
                {newDate && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: theme.textSecondary }}>
                      <Clock className="w-4 h-4" /> Novo Horário
                    </h4>
                    {visibleSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {visibleSlots.map((slot) => {
                          if (!slot.available) {
                            return (
                              <button
                                key={slot.time}
                                disabled
                                className="p-3 rounded-xl border text-sm font-bold font-sans opacity-40 cursor-not-allowed line-through"
                                style={{
                                  backgroundColor: 'transparent',
                                  borderColor: theme.inputBorder,
                                  color: theme.textMuted,
                                }}
                              >
                                {slot.time}
                              </button>
                            );
                          }

                          return (
                            <button
                              key={slot.time}
                              onClick={() => setNewTime(slot.time)}
                              className="p-3 rounded-xl border text-sm font-bold font-sans transition-all relative overflow-hidden"
                              style={{
                                backgroundColor: newTime === slot.time ? theme.accent : theme.inputBg,
                                borderColor: newTime === slot.time ? theme.accent : theme.inputBorder,
                                color: newTime === slot.time ? theme.btnPrimaryText : theme.textPrimary,
                              }}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl border text-center" style={{ backgroundColor: theme.inputBg, borderColor: theme.border }}>
                        <p className="text-sm font-medium" style={{ color: theme.textSecondary }}>Nenhum horário livre.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Ações */}
            <div className="pt-4 mt-auto border-t" style={{ borderColor: theme.border }}>
              <button
                onClick={handleRescheduleSubmit}
                disabled={loading || !newDate || !newTime}
                className="w-full py-4 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Reagendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

