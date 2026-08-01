import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  CreditCard,
  Globe,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Scissors,
  Sparkles,
  Star,
  User,
  X,
  ChevronUp,
  ChevronRight,
  Zap,
  QrCode,
  ShieldCheck
} from "lucide-react";
import { format, parse, isBefore, isSameDay, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { generateAvailableSlots } from "../../lib/availability";
import type { Slot } from "../../lib/availability";
import { supabase } from "../../integrations/supabase/client";
import { usePhoneFormat } from "../../hooks/usePhoneFormat";
import { useTheme } from "../../contexts/ThemeContext";
import { usePublicStore } from "../../hooks/usePublicStore";

// Custom SVG Icons
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

type PaymentScope = "full" | "partial" | "local";
type PaymentMethod = "pix" | "card" | "cash";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const scopeLabel: Record<PaymentScope, string> = {
  full: "Pago integralmente",
  partial: "Sinal de 50% pago",
  local: "Pagamento no local",
};

const methodLabel: Record<PaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão de Crédito/Débito",
  cash: "Dinheiro no local",
};

const stepTitles = [
  "O que você deseja fazer?",
  "Com quem?",
  "Quando?",
  "Seus dados e pagamento",
  "Resumo da reserva",
];

const money = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const onlyDigits = (str: string) => (str || "").replace(/\D/g, "");

// Haversine distance formula
function haversineKm(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) *
    Math.cos((pos1.lat * Math.PI) / 180) *
    Math.cos((pos2.lat * Math.PI) / 180);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function PublicStore() {
  const { slug } = useParams<{ slug: string }>();
  const { setThemeId, setCustomPalette, theme } = useTheme();

  const { data: storeData, isLoading: loading, error } = usePublicStore(slug);

  const tenant: any = storeData?.tenant;
  const settings: any = storeData?.settings;
  const servicesList: any[] = storeData?.services || [];
  const professionalsList: any[] = storeData?.professionals || [];
  const businessHoursList: any[] = storeData?.businessHours || [];

  // Sync global theme context when settings theme_preset is loaded
  useEffect(() => {
    if (settings?.theme_preset) {
      setThemeId(settings.theme_preset);
    }
    if (settings?.custom_palette) {
      setCustomPalette(settings.custom_palette);
    }
  }, [settings?.theme_preset, settings?.custom_palette, setThemeId, setCustomPalette]);

  // Wizard States
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedPro, setSelectedPro] = useState<any | "any" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [hasScrolledDates, setHasScrolledDates] = useState(false);

  // Form & Payment States
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("partial");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [pixCopied, setPixCopied] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    setCardNumber(formatted);
  };

  const handleCardExpChange = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.length >= 2) {
      v = v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    setCardExp(v);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMobileInfoModal, setShowMobileInfoModal] = useState(false);
  const [hasOpenedBottomSheet, setHasOpenedBottomSheet] = useState(false);
  const [showExpandedMapModal, setShowExpandedMapModal] = useState(false);
  const [mapZoom, setMapZoom] = useState(16);

  const phoneFormat = usePhoneFormat("pt");

  const openBottomSheet = useCallback(() => {
    setHasOpenedBottomSheet(true);
    setShowMobileInfoModal(true);
  }, []);

  // Geo Location
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied" | "ok">("idle");
  const todayWeekday = new Date().getDay();

  // Coords fallback for salon (-20.4433088, -40.3535541)
  const storeCoords = useMemo(() => ({
    lat: settings?.latitude || -20.4433088,
    lng: settings?.longitude || -40.3535541,
  }), [settings]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ok");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Auto trigger GPS distance when opening expanded map modal
  useEffect(() => {
    if (showExpandedMapModal && geoStatus === "idle") {
      requestLocation();
    }
  }, [showExpandedMapModal, geoStatus, requestLocation]);



  const availableDays = useMemo(() => {
    const days: { date: Date; isOpen: boolean }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const h = businessHoursList.find((x: any) => x.weekday === d.getDay());
      // A day is considered open if salon is open
      days.push({ date: d, isOpen: h?.is_open === true });
    }
    return days;
  }, [businessHoursList]);

  const availableSlots: Slot[] = useMemo(() => {
    if (!selectedDate || !selectedService) return [];

    return generateAvailableSlots(
      selectedDate,
      selectedService,
      selectedPro ? selectedPro.id : 'any',
      professionalsList,
      servicesList,
      businessHoursList,
      storeData?.professionalWorkingHours || [],
      storeData?.professionalBlockedTimes || [],
      storeData?.bookings || [],
      storeData?.professionalServices || []
    );
  }, [selectedDate, selectedService, selectedPro, professionalsList, servicesList, businessHoursList, storeData?.professionalWorkingHours, storeData?.professionalBlockedTimes, storeData?.bookings, storeData?.professionalServices]);

  // Static preview map showing ONLY the barber shop marker
  const mapPreviewUrl = useMemo(() => {
    return `https://www.google.com/maps?q=${storeCoords.lat},${storeCoords.lng}&z=16&output=embed`;
  }, [storeCoords]);

  // Interactive Popup Modal Map (with GPS route and dynamic zoom)
  const mapEmbedUrl = useMemo(() => {
    if (userPos) {
      return `https://www.google.com/maps?saddr=${userPos.lat},${userPos.lng}&daddr=${storeCoords.lat},${storeCoords.lng}&z=${mapZoom}&output=embed`;
    }
    return `https://www.google.com/maps?q=${storeCoords.lat},${storeCoords.lng}&z=${mapZoom}&output=embed`;
  }, [userPos, storeCoords, mapZoom]);

  const directionsUrl = useMemo(() => {
    if (settings?.map_link) return settings.map_link;
    if (userPos) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${storeCoords.lat},${storeCoords.lng}`;
    }
    return "https://maps.app.goo.gl/tJXYADFguv5GpXzg7";
  }, [userPos, storeCoords, settings]);

  const distanceKm = useMemo(
    () => (userPos ? haversineKm(userPos, storeCoords) : null),
    [userPos, storeCoords]
  );

  // Dynamic Theme Preset configuration matching Configuracoes.tsx
  const currentThemeId = settings?.theme_preset || "classic";
  const isLight = currentThemeId === "elegant";

  // Financial calculations
  const total = selectedService?.price ?? 0;
  const amountPaid = paymentScope === "full" ? total : paymentScope === "partial" ? total / 2 : 0;
  const amountDue = total - amountPaid;
  const proName = selectedPro === "any" ? "Qualquer barbeiro livre" : (selectedPro?.name ?? "");

  const storeName = settings?.fantasy_name || tenant?.name || "";
  const storeAddress = settings?.full_address || settings?.address;
  const storePhone = settings?.phone || settings?.whatsapp_number;
  
  let storeInsta = settings?.instagram ? settings.instagram.replace("@", "").trim() : null;
  if (storeInsta && storeInsta.includes("instagram.com/")) {
    storeInsta = storeInsta.split("instagram.com/")[1].replace("/", "");
  }
  
  let storeFacebook = settings?.facebook ? settings.facebook.trim() : null;
  if (storeFacebook && storeFacebook.includes("facebook.com/")) {
    storeFacebook = storeFacebook.split("facebook.com/")[1].replace("/", "");
  }

  const whatsappUrl = useMemo(() => {
    if (!bookingCode || !selectedService || !selectedDate || !selectedTime) return "#";
    const lines = [
      `*NOVA RESERVA — ${storeName}*`,
      "",
      `*Código:* #${bookingCode}`,
      `*Cliente:* ${customerName}`,
      `*WhatsApp:* ${customerPhone}`,
      `*Serviço:* ${selectedService.name} (${selectedService.duration_minutes} min)`,
      `*Profissional:* ${proName}`,
      `*Data/Hora:* ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às ${selectedTime}`,
      "",
      `*Valor Total:* ${money(total)}`,
      `*Forma de Pagamento:* ${scopeLabel[paymentScope]}${paymentScope === "local" ? "" : ` (${methodLabel[paymentMethod]})`}`,
      `*Pago Agora:* ${money(amountPaid)}`,
      `*A Pagar no Salão:* ${money(amountDue)}`,
      "",
      `*Endereço:* ${storeAddress}`,
      customerNotes ? `*Obs:* ${customerNotes}` : "",
    ].filter(Boolean);
    return `https://wa.me/${onlyDigits(settings?.whatsapp_number || storePhone)}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [
    bookingCode,
    selectedService,
    selectedDate,
    selectedTime,
    customerName,
    customerPhone,
    proName,
    total,
    paymentScope,
    paymentMethod,
    amountPaid,
    amountDue,
    storeName,
    storeAddress,
    settings,
    customerNotes,
  ]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  // Wizard navigation
  const handleNext = () => {
    setErrorMsg("");
    if (step === 1 && !selectedService) return setErrorMsg("Selecione um serviço para continuar.");
    if (step === 2 && !selectedPro) return setErrorMsg("Escolha um profissional ou a opção Qualquer um.");
    if (step === 3 && (!selectedDate || !selectedTime)) return setErrorMsg("Escolha o dia e o horário da sua reserva.");
    if (step === 4 && (!customerName.trim() || !phoneFormat.validate(customerPhone))) {
      return setErrorMsg("Por favor, preencha seu nome e um número de WhatsApp válido.");
    }
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    setErrorMsg("");
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime || !customerName || !customerPhone) return;
    setIsProcessing(true);
    setErrorMsg("");

    try {
      let customerId = "";
      const cleanPhone = customerPhone.replace(/\D/g, "");

      // Find or create customer
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert([{ tenant_id: tenant.id, name: customerName, phone: cleanPhone }])
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // Create Booking in DB
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = Math.random().toString(36).substring(2, 12);
      const scheduledAt = `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`;
      let proId = selectedPro === "any" ? null : selectedPro?.id;
      if (selectedPro === "any") {
        const slot = availableSlots.find(s => s.time === selectedTime);
        if (slot && slot.availableProIds && slot.availableProIds.length > 0) {
          const randomIndex = Math.floor(Math.random() * slot.availableProIds.length);
          proId = slot.availableProIds[randomIndex];
        } else {
          proId = professionalsList[0]?.id || null;
        }
      }

      const { data: newBooking, error: bookingErr } = await supabase.from("bookings").insert([{
        tenant_id: tenant.id,
        customer_id: customerId,
        professional_id: proId,
        service_id: selectedService.id,
        order_number: code,
        scheduled_at: scheduledAt,
        status: "confirmed",
        payment_mode: paymentScope === "full" ? "full" : paymentScope === "partial" ? "deposit" : "local",
        amount_paid: (paymentScope === "local" || paymentMethod === "cash") ? 0 : amountPaid,
        amount_total: total,
        notes: customerNotes,
        access_code: accessCode,
      }]).select('id').single();

      if (bookingErr) throw bookingErr;

      // Se pagamento online, chama Stripe Checkout
      if (paymentScope !== "local" && paymentMethod !== "cash") {
        const returnUrl = `${window.location.origin}/${slug}/portal`;
        const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-booking-checkout', {
          body: {
            bookingId: newBooking.id,
            returnUrl: returnUrl
          }
        });

        if (checkoutErr) {
          console.error("Stripe Error:", checkoutErr);
          // Se falhar o Stripe, avança para a tela final (step 5) para não perder o agendamento
          setBookingCode(code);
          setStep(5);
          return;
        }

        if (checkoutData?.url) {
          window.location.href = checkoutData.url;
          return;
        }
      }

      setBookingCode(code);
      setStep(5);
    } catch (err: any) {
      console.error("Erro ao salvar reserva:", err);
      setErrorMsg(err?.message || "Ocorreu um erro ao registrar sua reserva. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSubmit = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Por favor, preencha seu Nome e WhatsApp antes de finalizar o pagamento!");
      return;
    }
    handleConfirm();
  };

  const resetAll = () => {
    setBookingCode(null);
    setStep(1);
    setSelectedService(null);
    setSelectedPro(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerNotes("");
    setPaymentScope("partial");
    setPaymentMethod("pix");
  };

  // Color Theme Accent (Gold / Custom)
  const accent = settings?.custom_palette?.primary || "#C9963B";

  // Reusable Social Links
  const socialRow = (
    <div className="flex items-center gap-2.5">
      {storeInsta && (
        <a
          href={`https://instagram.com/${storeInsta}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200"
          title="Instagram"
          style={{ borderColor: theme.cardBorder, color: theme.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = `${theme.accent}60`; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderColor = theme.cardBorder; }}
        >
          <InstagramIcon className="h-4 w-4" />
        </a>
      )}
      {storeFacebook && (
        <a
          href={`https://facebook.com/${storeFacebook}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200"
          title="Facebook"
          style={{ borderColor: theme.cardBorder, color: theme.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = `${theme.accent}60`; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderColor = theme.cardBorder; }}
        >
          <FacebookIcon className="h-4 w-4" />
        </a>
      )}
      {storePhone && (
        <>
          <a
            href={`https://wa.me/${onlyDigits(storePhone)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200"
            title="WhatsApp"
            style={{ borderColor: theme.cardBorder, color: theme.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = `${theme.accent}60`; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderColor = theme.cardBorder; }}
          >
            <MessageCircle className="h-4 w-4" />
          </a>
          <a
            href={`tel:${onlyDigits(storePhone)}`}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200"
            title="Telefone"
            style={{ borderColor: theme.cardBorder, color: theme.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = `${theme.accent}60`; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.borderColor = theme.cardBorder; }}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </div>
  );

  // Reusable Map Component — quiet, single hairline border, no glass stacking
  const mapCard = storeAddress ? (
    <div>
      <div className="relative h-40 w-full overflow-hidden rounded-xl border" style={{ borderColor: theme.cardBorder }}>
        <iframe
          title="Localização do Salão"
          src={mapPreviewUrl}
          className="h-full w-full border-0 pointer-events-none"
          style={{ filter: (theme as any).mapFilter }}
          loading="lazy"
        />
      </div>

      <div className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: theme.accent }} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: theme.textMuted }}>
              Localização
            </p>
            <p className="text-sm leading-relaxed" style={{ color: theme.textPrimary }}>
              {storeAddress}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowExpandedMapModal(true)}
          className="w-full py-3 rounded-xl text-xs font-semibold tracking-wide transition-transform duration-200 active:scale-[0.98] flex items-center justify-center gap-2 border"
          style={{ borderColor: theme.cardBorder, color: theme.accent }}
        >
          <Navigation className="h-3.5 w-3.5" /> Como chegar
        </button>
      </div>
    </div>
  ) : null;

  // Reusable Operating Hours Component — list with quiet dividers, no boxed rows
  const hoursCard = businessHoursList.length > 0 ? (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <Clock className="h-4 w-4" style={{ color: theme.accent }} />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Horário de atendimento</h3>
      </div>
      <div className="divide-y" style={{ borderColor: theme.cardBorder }}>
        {businessHoursList.map((h: any) => {
          const isToday = h.weekday === todayWeekday;
          return (
            <div
              key={h.weekday}
              className="flex items-center justify-between py-2 text-xs"
              style={{ borderColor: theme.cardBorder, color: isToday ? theme.textPrimary : theme.textMuted }}
            >
              <span className="flex items-center gap-2" style={{ fontWeight: isToday ? 600 : 400 }}>
                {WEEKDAYS[h.weekday]}
                {isToday && (
                  <span className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                    Hoje
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums" style={{ fontWeight: isToday ? 600 : 400 }}>
                {h.is_open ? `${h.open_time.substring(0, 5)} – ${h.close_time.substring(0, 5)}` : "Fechado"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  const supportLinks = (
    <div className="flex flex-col gap-2.5 pt-1">
      <a
        href={`/${slug}/portal`}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold tracking-wide transition-transform duration-200 active:scale-[0.98]"
        style={{ background: theme.accent, color: theme.bg }}
      >
        <Calendar className="h-3.5 w-3.5" /> Já possui agendamento?
      </a>
      {storePhone && (
        <a
          href={`https://wa.me/${onlyDigits(storePhone)}`}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold tracking-wide border transition-transform duration-200 active:scale-[0.98]"
          style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}
        >
          <MessageCircle className="h-3.5 w-3.5" style={{ color: "#25D366" }} /> Precisa de ajuda?
        </a>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 ${theme.fontSans}`} style={{ background: theme.bg, color: theme.textPrimary }}>
        <Loader2 className="h-6 w-6 animate-spin mb-4" style={{ color: theme.accent }} />
        <p className="text-xs font-medium tracking-wide" style={{ color: theme.textMuted }}>Carregando agendamento online…</p>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen ${theme.fontSans} overflow-x-hidden flex flex-col lg:flex-row transition-colors duration-300`} style={{ background: theme.bg, color: theme.textPrimary }}>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE TOP HEADER & HERO SECTION
      ─────────────────────────────────────────────────────────────── */}
      <header className="relative lg:hidden border-b z-30 pb-6" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
        {/* Banner Image */}
        <div className="relative h-48 w-full overflow-hidden">
          {settings?.banner_url ? (
            <img src={settings.banner_url} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: theme.cardBg }} />
          )}
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to top, ${theme.cardBg} 0%, transparent 65%)` }} />
        </div>

        {/* Store Brand Box */}
        <div className="relative px-5 -mt-12 flex flex-col items-center text-center gap-4">
          <div className="h-24 w-24 rounded-full border-4 overflow-hidden shadow-lg flex items-center justify-center relative z-10" style={{ borderColor: theme.cardBg, background: theme.cardBg }}>
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-semibold font-serif uppercase" style={{ color: theme.textPrimary }}>{storeName?.charAt(0)}</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5 -mt-2">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-serif font-semibold tracking-tight" style={{ color: theme.textPrimary }}>{storeName}</h1>
              <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: theme.accent }}>
                <Star className="h-3.5 w-3.5" style={{ fill: theme.accent, color: theme.accent }} /> 4.9
              </span>
            </div>
            <p className="text-sm px-4" style={{ color: theme.textMuted }}>{settings?.slogan || settings?.description || "Agende seu horário com a nossa equipe de especialistas."}</p>
          </div>

          <div className="flex flex-col w-full gap-4 mt-2">
            <div className="flex items-center justify-center">
              {socialRow}
            </div>
            <a
              href={`/${slug}/portal`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-semibold border transition-transform active:scale-[0.98]"
              style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}
            >
              <Calendar className="h-4 w-4" style={{ color: theme.accent }} />
              <span>Meus agendamentos</span>
            </a>
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM SHEET */}
      <AnimatePresence>
        {showMobileInfoModal && (
          <div
            onClick={() => setShowMobileInfoModal(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowMobileInfoModal(false);
              }}
              className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t p-6 space-y-7 shadow-2xl"
              style={{ background: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }}
            >
              <div className="flex flex-col items-center justify-center -mt-1 pb-1">
                <div className="w-9 h-1 rounded-full cursor-grab active:cursor-grabbing" style={{ background: theme.cardBorder }} />
              </div>

              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: theme.cardBorder }}>
                <div className="min-w-0">
                  <h3 className="font-serif font-semibold text-lg leading-tight truncate">{storeName}</h3>
                  <p className="text-xs truncate mt-0.5" style={{ color: theme.textMuted }}>{storeAddress}</p>
                </div>
                <button
                  onClick={() => setShowMobileInfoModal(false)}
                  className="rounded-full p-2 transition-colors shrink-0"
                  style={{ color: theme.textMuted }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {mapCard}
              {hoursCard}
              {supportLinks}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PERSISTENT MOBILE BOTTOM SHEET PEEK BAR */}
      {!showMobileInfoModal && step < 4 && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden pointer-events-auto overflow-hidden">
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={
              hasOpenedBottomSheet
                ? { y: 0, opacity: 1 }
                : { y: [0, -8, 0], opacity: 1 }
            }
            transition={{
              y: hasOpenedBottomSheet
                ? { duration: 0.2 }
                : { duration: 1.6, repeat: 1, repeatDelay: 2.5, ease: "easeInOut" },
              opacity: { duration: 0.4 }
            }}
            drag="y"
            dragConstraints={{ top: -150, bottom: 0 }}
            dragElastic={{ top: 0.8, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -20 || info.velocity.y < -50) {
                openBottomSheet();
              }
            }}
            onTouchStart={(e) => {
              (e.currentTarget as any)._touchStartY = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const startY = (e.currentTarget as any)._touchStartY;
              if (startY !== undefined) {
                const endY = e.changedTouches[0].clientY;
                if (startY - endY > 15) {
                  openBottomSheet();
                }
              }
            }}
            onClick={openBottomSheet}
            className="cursor-grab active:cursor-grabbing border-t px-6 pt-3 pb-9 -mb-6 rounded-t-[24px] flex flex-col items-center justify-center transition-transform active:scale-[0.99] touch-pan-y"
            style={{ background: theme.cardBg, borderColor: theme.cardBorder, boxShadow: "0 -8px 30px rgba(0,0,0,0.12)" }}
          >
            <div className="flex flex-col items-center justify-center mb-2 gap-1.5">
              {!hasOpenedBottomSheet && (
                <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}>
                  <ChevronUp className="h-4 w-4" style={{ color: theme.textMuted }} />
                </motion.div>
              )}
              <div className="w-9 h-1 rounded-full" style={{ background: theme.cardBorder }} />
            </div>

            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] flex items-center gap-2" style={{ color: theme.textMuted }}>
              <MapPin className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Localização & horários
            </span>
          </motion.div>
        </div>
      )}

      {/* EXPANDED MAP MODAL */}
      <AnimatePresence>
        {showExpandedMapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6">
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border flex flex-col shadow-2xl"
              style={{ borderColor: theme.cardBorder, background: theme.cardBg }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: theme.cardBorder }}>
                <div className="min-w-0">
                  <h3 className="font-serif font-semibold text-base" style={{ color: theme.textPrimary }}>Mapa & navegação</h3>
                  <p className="text-xs truncate mt-0.5" style={{ color: theme.textMuted }}>{storeAddress}</p>
                </div>
                <button
                  onClick={() => setShowExpandedMapModal(false)}
                  className="rounded-full p-2 transition-colors"
                  style={{ color: theme.textMuted }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Large Interactive Map View with In-App Zoom Controls */}
              <div className="relative flex-1 min-h-[400px] w-full overflow-hidden bg-black flex flex-col">
                <iframe
                  title="Mapa Expandido no App"
                  src={mapEmbedUrl}
                  className="h-full w-full flex-1 border-0"
                  style={{ filter: (theme as any).mapFilter, pointerEvents: "auto" }}
                  loading="lazy"
                  allowFullScreen
                />

                <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
                  <button
                    onClick={() => setMapZoom((z) => Math.min(z + 1, 20))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border font-medium text-base shadow-lg transition-transform active:scale-95"
                    title="Aumentar Zoom (+)"
                    style={{ background: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => setMapZoom((z) => Math.max(z - 1, 10))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border font-medium text-base shadow-lg transition-transform active:scale-95"
                    title="Diminuir Zoom (-)"
                    style={{ background: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                  >
                    −
                  </button>
                </div>
              </div>

              {/* Modal Controls & GPS Calculator */}
              <div className="p-6 border-t space-y-4" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left w-full sm:w-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Endereço completo</p>
                    <p className="text-sm mt-0.5" style={{ color: theme.textPrimary }}>{storeAddress}</p>
                  </div>
                  {distanceKm !== null ? (
                    <div className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold shrink-0" style={{ borderColor: theme.cardBorder, color: theme.accent }}>
                      <Navigation className="h-3.5 w-3.5" /> Você está a {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`}
                    </div>
                  ) : (
                    <button
                      onClick={requestLocation}
                      disabled={geoStatus === "loading"}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 shrink-0"
                      style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}
                    >
                      {geoStatus === "loading" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Localizando…
                        </>
                      ) : (
                        <>
                          <Navigation className="h-3.5 w-3.5" /> Calcular minha distância
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowExpandedMapModal(false)}
                  className="w-full rounded-xl py-3 text-sm font-semibold transition-transform active:scale-[0.99]"
                  style={{ background: theme.accent, color: theme.bg }}
                >
                  Voltar ao agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP SIDEBAR
      ─────────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[400px] shrink-0 border-r relative z-20 transition-colors duration-300" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
        <div className="relative h-48 w-full overflow-hidden">
          {settings?.banner_url ? (
            <img src={settings.banner_url} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: theme.cardBg }} />
          )}
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to top, ${theme.cardBg} 0%, transparent 70%)` }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="h-24 w-24 rounded-full border-4 overflow-hidden shadow-lg flex items-center justify-center relative z-10" style={{ borderColor: theme.cardBg, background: theme.cardBg }}>
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold font-serif uppercase" style={{ color: theme.textPrimary }}>{storeName?.charAt(0)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none px-8 pt-16 pb-8 space-y-8 text-center flex flex-col items-center">
          <div className="flex flex-col items-center w-full">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-[28px] font-serif font-semibold tracking-tight leading-tight" style={{ color: theme.textPrimary }}>{storeName}</h1>
              <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: theme.accent }}>
                <Star className="h-3.5 w-3.5" style={{ fill: theme.accent, color: theme.accent }} /> 4.9
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-[280px] mx-auto" style={{ color: theme.textMuted }}>{settings?.slogan || settings?.description || "Agende seu horário com os melhores profissionais da região."}</p>
            
            <div className="mt-5 flex justify-center w-full">
              {socialRow}
            </div>

            <a
              href={`/${slug}/portal`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold border mt-6 transition-transform hover:scale-[1.02] active:scale-95 w-full max-w-[280px]"
              style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}
            >
              <Calendar className="h-4 w-4" style={{ color: theme.accent }} />
              <span>Meus agendamentos</span>
            </a>
          </div>
          <div className="h-px w-full" style={{ background: theme.cardBorder }} />
          {mapCard}
          <div className="h-px w-full" style={{ background: theme.cardBorder }} />
          {hoursCard}
          <div className="h-px w-full" style={{ background: theme.cardBorder }} />
          {supportLinks}
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN BOOKING WIZARD
      ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 relative z-20">
        {/* Progress Bar */}
        <div className="h-[3px] w-full relative overflow-hidden" style={{ background: theme.cardBorder }}>
          <motion.div
            className="h-full"
            style={{ background: theme.accent }}
            initial={false}
            animate={{ width: `${(step / 5) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Wizard Top Step Title */}
        <div className="min-h-[76px] px-6 lg:px-12 py-4 flex items-center justify-between border-b shrink-0 transition-colors duration-300" style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-4">
            {step > 1 && step < 5 && (
              <button
                onClick={handleBack}
                className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
                style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>Passo {step} de 5</p>
              <h2 className="text-lg font-serif font-semibold mt-0.5" style={{ color: theme.textPrimary }}>{stepTitles[step - 1]}</h2>
            </div>
          </div>

          {/* Quick Info Modal Trigger for Mobile */}
          <button
            onClick={() => setShowMobileInfoModal(true)}
            className="lg:hidden flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium"
            style={{ color: theme.textPrimary, borderColor: theme.cardBorder }}
          >
            <Info className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Info
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 lg:mx-12 mt-6 px-4 py-3 rounded-xl border text-sm flex items-center justify-between" style={{ borderColor: "rgba(244,63,94,0.35)", background: "rgba(244,63,94,0.08)", color: "#fb7185" }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-xs underline ml-4 shrink-0">Fechar</button>
          </div>
        )}

        {/* Wizard Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-6 lg:px-12 py-8">
          <AnimatePresence mode="wait">
            {/* STEP 1: CHOOSE SERVICE */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto space-y-6">
                {servicesList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed" style={{ borderColor: theme.cardBorder }}>
                    <Scissors className="h-8 w-8 mb-4" style={{ color: theme.textMuted }} />
                    <h3 className="text-lg font-serif font-semibold mb-1.5" style={{ color: theme.textPrimary }}>Nenhum serviço disponível</h3>
                    <p className="text-sm" style={{ color: theme.textMuted }}>O salão ainda não cadastrou nenhum serviço.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {servicesList.map((s) => {
                      const isSel = selectedService?.id === s.id;
                      const hasDiscount = s.original_price && s.original_price > s.price;
                      const discountPct = hasDiscount ? Math.round(((s.original_price - s.price) / s.original_price) * 100) : 0;

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedService(s);
                            setStep(2);
                          }}
                          className="group relative rounded-2xl cursor-pointer transition-all duration-200 border flex flex-col overflow-hidden"
                          style={{
                            borderColor: isSel ? theme.accent : theme.cardBorder,
                            background: theme.cardBg,
                            boxShadow: isSel ? `0 0 0 1px ${theme.accent}` : "none",
                          }}
                        >
                          {/* Service Image — full photo always visible, no cropping */}
                          {s.photo_url ? (
                            <div className="relative h-52 w-full overflow-hidden" style={{ background: theme.bg }}>
                              <img
                                src={s.photo_url}
                                alt=""
                                aria-hidden="true"
                                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-30"
                              />
                              <img
                                src={s.photo_url}
                                alt={s.name}
                                className="relative h-full w-full object-contain group-hover:scale-[1.03] transition-transform duration-500"
                              />
                              {hasDiscount && (
                                <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm" style={{ background: "rgba(0,0,0,0.55)" }}>
                                  -{discountPct}%
                                </span>
                              )}
                              {s.category && (
                                <span className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-medium text-white/90" style={{ background: "rgba(0,0,0,0.4)" }}>
                                  {s.category}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="relative h-24 w-full flex items-center justify-center border-b" style={{ borderColor: theme.cardBorder }}>
                              <Scissors className="h-6 w-6" style={{ color: theme.textMuted }} />
                              {hasDiscount && (
                                <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                                  -{discountPct}%
                                </span>
                              )}
                            </div>
                          )}

                          <div className="p-5 flex flex-col flex-1">
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <h3 className="text-base font-serif font-semibold leading-snug" style={{ color: theme.textPrimary }}>
                                {s.name}
                              </h3>
                              <div className="text-right shrink-0">
                                {hasDiscount && (
                                  <span className="block text-[11px] line-through" style={{ color: theme.textMuted }}>
                                    {money(s.original_price)}
                                  </span>
                                )}
                                <span className="text-base font-semibold tabular-nums" style={{ color: theme.accent }}>
                                  {money(s.price)}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: theme.textMuted }}>
                              {s.description || "Atendimento completo de alto padrão com finalização profissional."}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t mt-auto" style={{ borderColor: theme.cardBorder }}>
                              <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
                                <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                              </span>
                              <span
                                className="flex items-center gap-1 text-xs font-semibold transition-transform group-hover:translate-x-0.5"
                                style={{ color: theme.accent }}
                              >
                                Selecionar <ArrowUpRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: CHOOSE PROFESSIONAL */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div
                    onClick={() => {
                      setSelectedPro("any");
                      setStep(3);
                    }}
                    className="p-6 rounded-2xl cursor-pointer text-center transition-all duration-200 border flex flex-col items-center justify-center aspect-square"
                    style={{
                      borderColor: selectedPro === "any" ? theme.accent : theme.cardBorder,
                      background: theme.cardBg,
                      boxShadow: selectedPro === "any" ? `0 0 0 1px ${theme.accent}` : "none",
                    }}
                  >
                    <div className="h-20 w-20 rounded-full border flex items-center justify-center mb-3" style={{ borderColor: theme.cardBorder, color: theme.accent }}>
                      <Zap className="h-7 w-7" />
                    </div>
                    <p className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Qualquer profissional</p>
                    <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>O mais rápido disponível</p>
                  </div>

                  {professionalsList.map((p) => {
                    const isSel = selectedPro?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPro(p);
                          setStep(3);
                        }}
                        className="p-6 rounded-2xl cursor-pointer text-center transition-all duration-200 border flex flex-col items-center justify-center aspect-square"
                        style={{
                          borderColor: isSel ? theme.accent : theme.cardBorder,
                          background: theme.cardBg,
                          boxShadow: isSel ? `0 0 0 1px ${theme.accent}` : "none",
                        }}
                      >
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="h-20 w-20 rounded-full object-cover mb-3" />
                        ) : (
                          <div className="h-20 w-20 rounded-full border flex items-center justify-center mb-3" style={{ borderColor: theme.cardBorder, color: theme.textMuted }}>
                            <User className="h-8 w-8" />
                          </div>
                        )}
                        <h4 className="font-serif font-semibold text-base" style={{ color: theme.textPrimary }}>{p.name}</h4>
                        <p className="text-[11px] truncate w-full mt-0.5" style={{ color: theme.textMuted }}>{p.role_title || "Profissional"}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: CHOOSE DATE & TIME */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto space-y-8">
                {/* Date Slider */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: theme.textMuted }}>
                      <Calendar className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Selecione o dia
                    </h3>
                    {!hasScrolledDates && (
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                        style={{ color: theme.textMuted }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    )}
                  </div>
                  <div
                    onScroll={() => setHasScrolledDates(true)}
                    className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none"
                  >
                    {availableDays.map(({ date: d, isOpen }) => {
                      const isSel = selectedDate?.getTime() === d.getTime();
                      return (
                        <div
                          key={d.getTime()}
                          onClick={() => {
                            if (!isOpen) return;
                            setHasScrolledDates(true);
                            setSelectedDate(d);
                            setSelectedTime(null);
                          }}
                          className={`min-w-[72px] py-3.5 rounded-xl text-center transition-all duration-200 border shrink-0 ${!isOpen ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                            }`}
                          style={{
                            borderColor: isSel ? theme.accent : theme.cardBorder,
                            background: isSel ? theme.accent : theme.cardBg,
                            color: isSel ? theme.bg : theme.textPrimary
                          }}
                        >
                          <p className="text-[9px] uppercase font-semibold mb-1" style={{ opacity: isSel ? 0.85 : 0.55 }}>
                            {format(d, "eee", { locale: ptBR })}
                          </p>
                          <p className="text-xl font-serif font-semibold" style={{ color: isSel ? theme.bg : (!isOpen ? theme.textMuted : theme.textPrimary) }}>
                            {format(d, "dd")}
                          </p>
                          <p className="text-[9px] uppercase font-semibold mt-0.5" style={{ opacity: isSel ? 0.85 : 0.55 }}>
                            {format(d, "MMM", { locale: ptBR })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4 flex items-center gap-2" style={{ color: theme.textMuted }}>
                      <Clock className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Horários livres em {format(selectedDate, "dd/MM")}
                    </h3>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                        {availableSlots.map((slot) => {
                          const isSel = selectedTime === slot.time;
                          const isAvail = slot.available;

                          return (
                            <button
                              key={slot.time}
                              disabled={!isAvail}
                              onClick={() => setSelectedTime(slot.time)}
                              className={`py-2.5 rounded-xl text-xs font-semibold tabular-nums transition-all border ${!isAvail ? "opacity-30 cursor-not-allowed line-through" : ""
                                }`}
                              style={{
                                borderColor: isSel ? theme.accent : theme.cardBorder,
                                background: isSel ? theme.accent : theme.cardBg,
                                color: isSel ? theme.bg : theme.textPrimary
                              }}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm italic p-4 rounded-xl border" style={{ color: theme.textMuted, borderColor: theme.cardBorder }}>Não há horários disponíveis para este dia. Escolha outra data acima.</p>
                    )}

                    {/* Step 3 CTA Button */}
                    {selectedDate && selectedTime && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="pt-6"
                      >
                        <button
                          onClick={() => setStep(4)}
                          className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-transform duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
                          style={{ background: theme.accent, color: theme.bg }}
                        >
                          Continuar para identificação & pagamento <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 4: CUSTOMER FORM & PAYMENT PREFERENCE */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="max-w-5xl mx-auto pb-20 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 lg:gap-16 items-start">

                  {/* LEFT: form + payment choices */}
                  <div className="space-y-10 min-w-0">
                    {/* Contact Details */}
                    <div className="space-y-5">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: theme.textMuted }}>
                        <User className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Seus dados de contato
                      </h3>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>Nome completo</label>
                        <input
                          type="text"
                          placeholder="Ex: João da Silva"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors"
                          style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                          onFocus={(e) => e.target.style.borderColor = theme.accent}
                          onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>WhatsApp com DDD</label>
                        <input
                          type="tel"
                          placeholder={phoneFormat.placeholder}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(phoneFormat.format(e.target.value))}
                          maxLength={phoneFormat.maxLength}
                          className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors"
                          style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                          onFocus={(e) => e.target.style.borderColor = theme.accent}
                          onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>Observações (opcional)</label>
                        <textarea
                          placeholder="Ex: Prefiro tesoura no topo..."
                          value={customerNotes}
                          onChange={(e) => setCustomerNotes(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
                          style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                          onFocus={(e) => e.target.style.borderColor = theme.accent}
                          onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                        />
                      </div>
                    </div>

                    <div className="h-px w-full" style={{ background: theme.cardBorder }} />

                    {/* PAYMENT SELECTION & STRIPE CHECKOUT */}
                    <div className="space-y-6">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: theme.textMuted }}>
                        <CreditCard className="h-3.5 w-3.5" style={{ color: theme.accent }} /> Forma de pagamento
                      </h3>

                      {/* Payment Scope Selector (50% or 100%) — amounts live in the summary, kept here as a simple choice */}
                      <div className="grid grid-cols-2 rounded-xl border p-1 gap-1" style={{ borderColor: theme.cardBorder }}>
                        <button
                          onClick={() => setPaymentScope("partial")}
                          className="py-3 px-4 rounded-lg text-center transition-all duration-200 flex items-center justify-center gap-2"
                          style={{
                            background: paymentScope === "partial" ? theme.bg : "transparent",
                            boxShadow: paymentScope === "partial" ? `0 0 0 1px ${theme.cardBorder}` : "none",
                          }}
                        >
                          <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>Sinal de 50%</span>
                          {paymentScope === "partial" && <Check className="h-3.5 w-3.5" style={{ color: theme.accent }} />}
                        </button>

                        <button
                          onClick={() => setPaymentScope("full")}
                          className="py-3 px-4 rounded-lg text-center transition-all duration-200 flex items-center justify-center gap-2"
                          style={{
                            background: paymentScope === "full" ? theme.bg : "transparent",
                            boxShadow: paymentScope === "full" ? `0 0 0 1px ${theme.cardBorder}` : "none",
                          }}
                        >
                          <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>Pagamento total</span>
                          {paymentScope === "full" && <Check className="h-3.5 w-3.5" style={{ color: theme.accent }} />}
                        </button>
                      </div>

                      {/* Method Selector Tabs (PIX / Credit Card) */}
                      <div className="flex items-center gap-6 border-b" style={{ borderColor: theme.cardBorder }}>
                        <button
                          onClick={() => setPaymentMethod("pix")}
                          className="pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative"
                          style={{ color: paymentMethod === "pix" ? theme.textPrimary : theme.textMuted }}
                        >
                          <QrCode className="h-3.5 w-3.5" /> PIX
                          {paymentMethod === "pix" && (
                            <motion.div layoutId="paymentTabIndicator" className="absolute -bottom-px left-0 right-0 h-[2px]" style={{ background: theme.accent }} />
                          )}
                        </button>
                        <button
                          onClick={() => setPaymentMethod("card")}
                          className="pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative"
                          style={{ color: paymentMethod === "card" ? theme.textPrimary : theme.textMuted }}
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Cartão de crédito
                          {paymentMethod === "card" && (
                            <motion.div layoutId="paymentTabIndicator" className="absolute -bottom-px left-0 right-0 h-[2px]" style={{ background: theme.accent }} />
                          )}
                        </button>
                      </div>

                      {/* Method Form Fields */}
                      {paymentMethod === "card" ? (
                        <div className="space-y-4">
                          {/* Auto-fill Stripe Test Card Helper */}
                          <button
                            type="button"
                            onClick={() => {
                              setCardNumber(import.meta.env.VITE_STRIPE_TEST_CARD_VISA || "4242 4242 4242 4242");
                              setCardExp(import.meta.env.VITE_STRIPE_TEST_EXP || "12/30");
                              setCardCvc(import.meta.env.VITE_STRIPE_TEST_CVC || "123");
                            }}
                            className="text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                            style={{ color: theme.accent }}
                          >
                            <Sparkles className="h-3 w-3" /> Preencher cartão de teste Stripe
                          </button>

                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>Número do cartão</label>
                            <input
                              type="text"
                              placeholder="4242 •••• •••• 4242"
                              value={cardNumber}
                              onChange={(e) => handleCardNumberChange(e.target.value)}
                              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none font-mono transition-colors"
                              style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                              onFocus={(e) => e.target.style.borderColor = theme.accent}
                              onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>Validade</label>
                              <input
                                type="text"
                                placeholder="12/30"
                                value={cardExp}
                                onChange={(e) => handleCardExpChange(e.target.value)}
                                className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none font-mono text-center transition-colors"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                onFocus={(e) => e.target.style.borderColor = theme.accent}
                                onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.textMuted }}>CVC</label>
                              <input
                                type="text"
                                maxLength={4}
                                placeholder="123"
                                value={cardCvc}
                                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                                className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none font-mono text-center transition-colors"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                onFocus={(e) => e.target.style.borderColor = theme.accent}
                                onBlur={(e) => e.target.style.borderColor = theme.cardBorder}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border p-6 text-center space-y-5" style={{ borderColor: theme.cardBorder }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: theme.textPrimary }}>
                              <QrCode className="h-3.5 w-3.5" style={{ color: theme.success }} /> QR Code PIX
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
                              Expira em 15:00
                            </span>
                          </div>

                          {/* Visual QR Code Image */}
                          <div className="mx-auto flex justify-center p-3 bg-white rounded-2xl w-40 h-40 border" style={{ borderColor: theme.cardBorder }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=00020126580014br.gov.bcb.pix0136stripe-connect-navalha-${slug}-${amountPaid}`}
                              alt="QR Code PIX Stripe"
                              className="w-full h-full object-contain"
                            />
                          </div>

                          {/* Copia e Cola Section */}
                          <div className="space-y-2 text-left">
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.textMuted }}>
                              Chave PIX copia e cola
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                readOnly
                                type="text"
                                value={`00020126580014br.gov.bcb.pix0136stripe-connect-navalha-${slug}-${amountPaid}5204000053039865405${amountPaid}.005802BR5913Navalha SaaS6009Vila Velha62070503***6304E2A5`}
                                className="w-full rounded-xl border px-3 py-2.5 text-[11px] font-mono truncate select-all focus:outline-none"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textMuted }}
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`00020126580014br.gov.bcb.pix0136stripe-connect-navalha-${slug}-${amountPaid}5204000053039865405${amountPaid}.005802BR5913Navalha SaaS6009Vila Velha62070503***6304E2A5`);
                                  setPixCopied(true);
                                  setTimeout(() => setPixCopied(false), 3000);
                                }}
                                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs shrink-0 transition-all flex items-center gap-1.5 border"
                                style={pixCopied
                                  ? { borderColor: theme.success, color: theme.success }
                                  : { borderColor: theme.cardBorder, color: theme.textPrimary }}
                              >
                                {pixCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" /> Copiar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
                            Abra o app do seu banco e escolha PIX &gt; Ler QR Code, ou use o PIX Copia e Cola para pagar {money(amountPaid)}.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: order summary — always visible, sticky on desktop */}
                  <div className="hidden lg:block">
                    <div className="lg:sticky lg:top-6 rounded-2xl border p-6 space-y-5" style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Resumo da reserva</h3>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Scissors className="h-4 w-4 mt-0.5 shrink-0" style={{ color: theme.accent }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{selectedService?.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{proName}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-4 w-4 mt-0.5 shrink-0" style={{ color: theme.accent }} />
                          <p className="text-sm" style={{ color: theme.textPrimary }}>
                            {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                          </p>
                        </div>
                      </div>

                      <div className="h-px w-full" style={{ background: theme.cardBorder }} />

                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between" style={{ color: theme.textMuted }}>
                          <span>Valor do serviço</span>
                          <span className="tabular-nums">{money(total)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span style={{ color: theme.textPrimary }}>Pagar agora</span>
                          <span className="tabular-nums" style={{ color: theme.accent }}>{money(amountPaid)}</span>
                        </div>
                        {paymentScope === "partial" && (
                          <div className="flex justify-between text-xs" style={{ color: theme.textMuted }}>
                            <span>Restante no salão</span>
                            <span className="tabular-nums">{money(total - amountPaid)}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handlePaymentSubmit}
                        disabled={isProcessing}
                        className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70"
                        style={{ background: theme.accent, color: theme.bg }}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" /> {paymentMethod === "pix" ? "Confirmar pagamento PIX" : "Pagar & agendar"}
                          </>
                        )}
                      </button>

                      <p className="text-[10px] flex items-center justify-center gap-1.5" style={{ color: theme.textMuted }}>
                        <ShieldCheck className="h-3 w-3" style={{ color: theme.success }} /> Checkout seguro via Stripe
                      </p>
                    </div>
                  </div>
                </div>

                {/* MOBILE: fixed payment bar — total and action always in view */}
                <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t px-5 py-3.5" style={{ background: theme.cardBg, borderColor: theme.cardBorder, boxShadow: "0 -8px 30px rgba(0,0,0,0.12)" }}>
                  <div className="flex items-center justify-between gap-4 max-w-xl mx-auto">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.textMuted }}>Pagar agora</p>
                      <p className="text-base font-semibold tabular-nums" style={{ color: theme.accent }}>{money(amountPaid)}</p>
                    </div>
                    <button
                      onClick={handlePaymentSubmit}
                      disabled={isProcessing}
                      className="shrink-0 py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                      style={{ background: theme.accent, color: theme.bg }}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {isProcessing ? "Processando" : paymentMethod === "pix" ? "Confirmar PIX" : "Pagar & agendar"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: SUCCESS / BOOKING CONFIRMED */}
            {step === 5 && bookingCode && (
              <motion.div key="step5" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="max-w-md mx-auto text-center space-y-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border" style={{ borderColor: theme.success, color: theme.success }}>
                  <Check className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-semibold" style={{ color: theme.textPrimary }}>Reserva confirmada</h2>
                  <p className="text-xs mt-1.5" style={{ color: theme.textMuted }}>Envie os detalhes do agendamento para a barbearia pelo WhatsApp.</p>
                </div>

                <div className="rounded-2xl border p-6 text-left space-y-3 text-xs" style={{ borderColor: theme.cardBorder }}>
                  <div className="flex justify-between border-b pb-2.5" style={{ borderColor: theme.cardBorder }}>
                    <span style={{ color: theme.textMuted }}>Código</span>
                    <span className="font-mono font-semibold" style={{ color: theme.accent }}>#{bookingCode}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2.5" style={{ borderColor: theme.cardBorder }}>
                    <span style={{ color: theme.textMuted }}>Serviço</span>
                    <span className="font-medium" style={{ color: theme.textPrimary }}>{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2.5" style={{ borderColor: theme.cardBorder }}>
                    <span style={{ color: theme.textMuted }}>Profissional</span>
                    <span className="font-medium" style={{ color: theme.textPrimary }}>{proName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2.5" style={{ borderColor: theme.cardBorder }}>
                    <span style={{ color: theme.textMuted }}>Data & hora</span>
                    <span className="font-medium tabular-nums" style={{ color: theme.textPrimary }}>{selectedDate && format(selectedDate, "dd/MM")} às {selectedTime}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span style={{ color: theme.textMuted }}>Valor total</span>
                    <span className="font-semibold tabular-nums" style={{ color: theme.accent }}>{money(total)}</span>
                  </div>
                </div>

                {/* WhatsApp Button */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-3 rounded-xl py-4 px-6 font-semibold text-[13px] uppercase tracking-wide transition-transform duration-200 active:scale-[0.99]"
                  style={{ background: "#25D366", color: "#FFFFFF" }}
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  <div className="flex flex-col items-start text-left">
                    <span>Enviar reserva no WhatsApp</span>
                    <span className="text-[10px] normal-case font-normal mt-0.5 opacity-80">Toque para enviar seu pedido</span>
                  </div>
                </a>

                <button
                  onClick={resetAll}
                  className="text-xs underline transition-opacity"
                  style={{ color: theme.textMuted }}
                >
                  Fazer outro agendamento
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER */}
        <footer className="mt-8 pb-28 lg:pb-8 text-center text-xs space-y-1.5 border-t pt-6 px-4" style={{ color: theme.textMuted, borderColor: theme.cardBorder }}>
          <p>© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          <p className="flex items-center justify-center gap-1 text-[11px] font-mono opacity-70">
            Desenvolvido com <span className="font-semibold" style={{ color: theme.accent }}>Navalha SaaS</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
