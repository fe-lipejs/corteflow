import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTenantSlug } from "../../hooks/useTenantSlug";
import { getTenantPortalUrl } from "../../lib/tenantUrl";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Scissors,
  Star,
  User,
  X,
  Zap,
  QrCode,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Info,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { generateAvailableSlots } from "../../lib/availability";
import type { Slot } from "../../lib/availability";
import { supabase } from "../../integrations/supabase/client";
import { usePhoneFormat } from "../../hooks/usePhoneFormat";
import { useTheme, getThemeById, adjustColorBrightness } from "../../contexts/ThemeContext";
import { usePublicStore, PUBLIC_STORE_QUERY_KEY } from "../../hooks/usePublicStore";
import { useQueryClient } from "@tanstack/react-query";
import { getThemeContrastEngine } from "../../lib/themeEngine";

// ── Icons ────────────────────────────────────────────────────────────────────
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.553 4.103 1.52 5.83L.058 23.277a.5.5 0 0 0 .608.636l5.707-1.512A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.376l-.357-.213-3.706.982.995-3.613-.234-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.574 6.574 2.182 12 2.182c5.426 0 9.818 4.392 9.818 9.818 0 5.426-4.392 9.818-9.818 9.818z" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────
type PaymentScope = "full" | "partial" | "local";
type PaymentMethod = "pix" | "card" | "cash";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const money = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const onlyDigits = (str: string) => (str || "").replace(/\D/g, "");

function haversineKm(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos((pos1.lat * Math.PI) / 180) * Math.cos((pos2.lat * Math.PI) / 180);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── SlotGrid: Original design + crossed-out unavailable slots ──────────────────
function SlotGrid({
  allSlots,
  selectedTime,
  onSelect,
  accent,
  theme,
}: {
  allSlots: import('../../lib/availability').Slot[];
  selectedTime: string;
  onSelect: (t: string) => void;
  accent: string;
  theme: any;
}) {
  const visibleSlots = allSlots.filter(
    (s) => s.available || (s.unavailableReason !== 'past' && s.unavailableReason !== 'no_fit')
  );

  if (visibleSlots.length === 0) {
    return (
      <div className="py-10 text-center rounded-2xl border" style={{ borderColor: theme.cardBorder }}>
        <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: theme.textMuted, opacity: 0.5 }} />
        <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>Nenhum horário disponível</p>
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>Tente outra data acima.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3.5">
      {visibleSlots.map((slot) => {
        if (!slot.available) {
          return (
            <button
              key={slot.time}
              disabled
              className="py-3.5 rounded-xl text-sm font-bold border-2 transition-all duration-150 opacity-40 cursor-not-allowed line-through"
              style={{
                borderColor: theme.cardBorder,
                background: 'transparent',
                color: theme.textMuted,
              }}
            >
              {slot.time}
            </button>
          );
        }

        const isSel = selectedTime === slot.time;
        return (
          <button
            key={slot.time}
            onClick={() => onSelect(slot.time)}
            className="py-3.5 rounded-xl text-sm font-bold border-2 transition-all duration-150 relative"
            style={{
              borderColor: isSel ? accent : theme.cardBorder,
              background: isSel ? (theme.btnPrimaryBg || accent) : theme.cardBg,
              color: isSel ? theme.btnPrimaryText : theme.textPrimary,
            }}
          >
            {slot.time}
          </button>
        );
      })}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
const STEP_LABELS = ["Serviço", "Profissional", "Data & Hora", "Confirmar"];

function StepIndicator({ step, accent, theme }: { step: number; accent: string; theme: any }) {
  const contrast = getThemeContrastEngine(theme);
  return (
    <div className="flex items-center justify-center gap-1 px-6 py-4">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm"
                style={{
                  background: done ? accent : active ? (theme.btnPrimaryBg || accent) : contrast.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  color: done || active ? theme.btnPrimaryText : contrast.isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                  border: active ? `2px solid ${accent}` : done ? "none" : `1.5px solid ${theme.cardBorder}`,
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : num}
              </motion.div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wider hidden sm:block"
                style={{ color: active ? accent : done ? theme.textSecondary : theme.textMuted }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-8 sm:w-14 h-px mx-1 sm:mx-2" style={{ background: step > num ? accent : theme.cardBorder }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Audio Helper ────────────────────────────────────────────────────────────
const playSuccessSound = () => {
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg");
  audio.play().catch(() => { });
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PublicStore() {
  // useTenantSlug: returns slug from hostname (production) or path param (dev)
  const slugFromHook = useTenantSlug();
  // Also read useParams for dev compatibility (useTenantSlug already handles this internally,
  // but we keep the reference for the PUBLIC_STORE_QUERY_KEY invalidation below)
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugFromHook ?? paramSlug ?? undefined;
  const { setThemeId, setCustomPalette, theme: contextTheme } = useTheme();
  const { data: storeData, isLoading: loading } = usePublicStore(slug);
  const queryClient = useQueryClient();

  const tenant: any = storeData?.tenant;
  const settings: any = storeData?.settings;
  const servicesList: any[] = storeData?.services || [];
  const professionalsList: any[] = storeData?.professionals || [];
  const businessHoursList: any[] = storeData?.businessHours || [];

  // Theme directly computed from database settings for immediate accuracy
  const theme = useMemo(() => {
    const presetId = settings?.theme_preset || 'classic';
    const base = getThemeById(presetId);
    if (!settings?.custom_palette) return base;

    const palette = settings.custom_palette;
    let btnTextColor = base.btnPrimaryText;
    if (palette.primary) {
      const hex = palette.primary.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 201;
      const g = parseInt(hex.substring(2, 4), 16) || 150;
      const b = parseInt(hex.substring(4, 6), 16) || 59;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      btnTextColor = lum > 145 ? '#0F172A' : '#FFFFFF';
    }

    const bgHex = (palette.background || base.bg).replace('#', '');
    const bgR = parseInt(bgHex.substring(0, 2), 16) || 14;
    const bgG = parseInt(bgHex.substring(2, 4), 16) || 16;
    const bgB = parseInt(bgHex.substring(4, 6), 16) || 19;
    const bgLum = 0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB;
    const isDarkBg = bgLum < 135;

    const dynamicBorder = isDarkBg ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const dynamicTextSecondary = isDarkBg ? '#94A3B8' : '#64748B';
    const dynamicTextMuted = isDarkBg ? '#64748B' : '#94A3B8';

    const fontSerif = palette.fontStyle === 'sans'
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
        inputBg: isDarkBg ? '#121417' : '#FFFFFF',
        bgInput: isDarkBg ? '#121417' : '#FFFFFF',
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
        calendarActiveBg: palette.primary,
        calendarActiveText: btnTextColor,
        calendarAvailableBg: `${palette.primary}18`,
        shadowAccent: `0 0 20px ${palette.primary}40`,
      }),
    };
  }, [settings?.theme_preset, settings?.custom_palette]);

  useEffect(() => {
    if (settings?.theme_preset) setThemeId(settings.theme_preset);
    if (settings?.custom_palette) setCustomPalette(settings.custom_palette);
    else setCustomPalette(undefined);
  }, [settings?.theme_preset, settings?.custom_palette, setThemeId, setCustomPalette]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedPro, setSelectedPro] = useState<any | "any" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentScope, setPaymentScope] = useState<PaymentScope>("partial");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [pixCopied, setPixCopied] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapZoom, setMapZoom] = useState(16);
  const [hasScrolledDates, setHasScrolledDates] = useState(false);
  const [hasOpenedSheet, setHasOpenedSheet] = useState(false);

  const step4Ref = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const timeSlotsRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when entering payment/confirmation step
  useEffect(() => {
    if (step >= 4) {
      setTimeout(() => {
        inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [step]);

  // Auto-scroll down when a date is selected to show time slots
  useEffect(() => {
    if (step === 3 && selectedDate) {
      setTimeout(() => {
        timeSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [selectedDate, step]);

  // Auto-scroll down when a time is selected to show the confirm button
  useEffect(() => {
    if (step === 3 && selectedTime) {
      setTimeout(() => {
        confirmBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedTime, step]);

  // Fix #2: When entering step 4, ensure the selected payment scope is one that's allowed
  useEffect(() => {
    if (step === 4 && allowedPaymentScopes.length > 0) {
      const isCurrentAllowed = allowedPaymentScopes.some(o => o.key === paymentScope);
      if (!isCurrentAllowed) {
        setPaymentScope(allowedPaymentScopes[0].key);
      }
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Geo ────────────────────────────────────────────────────────────────────
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied" | "ok" | "ignored">("idle");
  const todayWeekday = new Date().getDay();

  const storeCoords = useMemo(() => ({
    lat: settings?.latitude || -20.4433088,
    lng: settings?.longitude || -40.3535541,
  }), [settings]);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");

    let isResolved = false;

    // Fast fallback watchdog (4.5s) to guarantee UI never freezes on iPhone / poor GPS
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        setGeoStatus("denied");
      }
    }, 4500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timer);
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus("ok");
        },
        (err) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timer);
          console.warn("Geolocation denied or unavailable:", err.message);
          setGeoStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    } catch {
      isResolved = true;
      clearTimeout(timer);
      setGeoStatus("denied");
    }
  }, []);

  const phoneFormat = usePhoneFormat("pt");

  // ── Derived ────────────────────────────────────────────────────────────────
  const accent = settings?.custom_palette?.primary || theme.accent;
  const contrast = useMemo(() => getThemeContrastEngine(theme), [theme]);
  const storeName = settings?.fantasy_name || tenant?.name || "";

  // Reconstruct full address reliably from any and all address fields
  const storeAddress = useMemo(() => {
    if (settings?.full_address && settings.full_address.trim()) return settings.full_address.trim();
    const parts = [
      settings?.address ? `${settings.address}${settings.street_number ? `, ${settings.street_number}` : ''}` : '',
      settings?.complement ? `(${settings.complement})` : '',
      settings?.neighborhood,
      settings?.city ? `${settings.city}${settings.state ? ` - ${settings.state}` : ''}` : '',
      settings?.zip_code ? `CEP ${settings.zip_code}` : '',
      'Brasil'
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    return settings?.address || '';
  }, [settings]);

  const hasLocationInfo = Boolean(storeAddress || settings?.map_link);
  const storePhone = settings?.phone || settings?.whatsapp_number;

  let storeInsta = settings?.instagram ? settings.instagram.replace("@", "").trim() : null;
  if (storeInsta?.includes("instagram.com/")) storeInsta = storeInsta.split("instagram.com/")[1].replace("/", "");

  const total = selectedService?.price ?? 0;
  const amountPaid = paymentScope === "full" ? total : paymentScope === "partial" ? total / 2 : 0;
  const amountDue = total - amountPaid;
  const proName = selectedPro === "any" ? "Qualquer profissional" : (selectedPro?.name ?? "");

  // Fix #2: Parse which payment options are enabled by the admin
  const allowedPaymentScopes = useMemo((): { key: PaymentScope; label: string; desc: string }[] => {
    let allowLocal = true, allowDeposit = true, allowFull = true;

    // 1. Try reading from new JSONB field
    if (settings?.payment_methods) {
      const pm = settings.payment_methods;
      allowLocal = pm.pay_local ?? true;
      allowDeposit = pm.partial_50 ?? true;
      allowFull = pm.full_100 ?? false;
    }
    // 2. Fallback to legacy string field
    else if (settings?.booking_payment_mode) {
      const pm = settings.booking_payment_mode as string;
      try {
        if (pm.startsWith('{')) {
          const parsed = JSON.parse(pm);
          allowLocal = parsed.local !== false;
          allowDeposit = parsed.deposit !== false;
          allowFull = parsed.full !== false;
        } else {
          allowLocal = pm === 'local' || pm === 'client_choice';
          allowDeposit = pm === 'deposit' || pm === 'client_choice';
          allowFull = pm === 'full' || pm === 'client_choice';
          if (!allowLocal && !allowDeposit && !allowFull) { allowLocal = true; allowDeposit = true; allowFull = true; }
        }
      } catch { allowLocal = true; allowDeposit = true; allowFull = true; }
    }

    const depositPct = settings?.deposit_percentage || 50;

    // Regra Rigorosa: Se o Stripe Connect do salão não estiver ativado, pagamentos online ficam indisponíveis
    const isStripeActive = storeData?.isStripeEnabled === true;
    if (!isStripeActive) {
      allowDeposit = false;
      allowFull = false;
      allowLocal = true;
    }

    const all: { key: PaymentScope; label: string; desc: string }[] = [];
    if (allowDeposit) all.push({ key: "partial", label: `Entrada ${depositPct}%`, desc: money(total * (depositPct / 100)) });
    if (allowFull) all.push({ key: "full", label: "Total agora", desc: money(total) });
    if (allowLocal) all.push({ key: "local", label: "No local", desc: "Grátis agora" });
    // Ensure at least one option exists (safety)
    if (all.length === 0) all.push({ key: "local", label: "No local", desc: "Grátis agora" });
    return all;
  }, [settings?.payment_methods, settings?.booking_payment_mode, settings?.deposit_percentage, total, storeData?.isStripeEnabled]);


  const distanceKm = useMemo(() => (userPos ? haversineKm(userPos, storeCoords) : null), [userPos, storeCoords]);

  const availableDays = useMemo(() => {
    const days: { date: Date; isOpen: boolean }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const h = businessHoursList.find((x: any) => x.weekday === d.getDay());
      days.push({ date: d, isOpen: h?.is_open === true });
    }
    return days;
  }, [businessHoursList]);

  const availableSlots: Slot[] = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    return generateAvailableSlots(
      selectedDate,
      selectedService,
      selectedPro === "any" ? "any" : (selectedPro?.id ?? "any"),
      professionalsList,
      servicesList,
      businessHoursList,
      storeData?.professionalWorkingHours || [],
      storeData?.professionalBlockedTimes || [],
      storeData?.bookings || [],
      storeData?.professionalServices || [],
      // Pass array of selected services for multi-service block-size calculation
      [selectedService]
    );
  }, [selectedDate, selectedService, selectedPro, professionalsList, servicesList, businessHoursList, storeData]);

  const isAppleDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  }, []);

  // ── Strict Destination Resolution (Prioritizes Google Maps Link / Exact Coordinates) ──
  const destinationTarget = useMemo(() => {
    // 1. Exact coordinates from database settings (milimetric pinpoint)
    if (settings?.latitude && settings?.longitude) {
      return `${settings.latitude},${settings.longitude}`;
    }

    // 2. Extract coordinates or place name directly from Google Maps link
    if (settings?.map_link && settings.map_link.trim()) {
      const rawLink = settings.map_link.trim();
      const coordMatch = rawLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                         rawLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                         rawLink.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        return `${coordMatch[1]},${coordMatch[2]}`;
      }
      const qMatch = rawLink.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        return qMatch[1];
      }
      const placeMatch = rawLink.match(/\/place\/([^/@?]+)/);
      if (placeMatch) {
        return placeMatch[1];
      }
    }

    // 3. Fallback to physical street address ONLY if no link / coordinates exist
    if (storeAddress && storeAddress.trim()) {
      return encodeURIComponent(storeAddress.trim());
    }

    return `${storeCoords.lat},${storeCoords.lng}`;
  }, [settings?.latitude, settings?.longitude, settings?.map_link, storeAddress, storeCoords]);

  const mapPreviewUrl = useMemo(() => {
    if (settings?.map_link && settings.map_link.includes('<iframe')) {
      const match = settings.map_link.match(/src="([^"]+)"/);
      if (match) return match[1];
    }
    if (settings?.map_link && (settings.map_link.includes('output=embed') || settings.map_link.includes('google.com/maps/embed'))) {
      return settings.map_link;
    }
    return `https://maps.google.com/maps?q=${destinationTarget}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
  }, [settings?.map_link, destinationTarget]);

  const mapModalUrl = useMemo(() => {
    // 1. Live route calculation if user location is available!
    if (userPos) {
      return `https://maps.google.com/maps?saddr=${userPos.lat},${userPos.lng}&daddr=${destinationTarget}&t=&z=${mapZoom}&output=embed`;
    }

    // 2. Custom iframe if configured
    if (settings?.map_link && settings.map_link.includes('<iframe')) {
      const match = settings.map_link.match(/src="([^"]+)"/);
      if (match) return match[1];
    }
    if (settings?.map_link && (settings.map_link.includes('output=embed') || settings.map_link.includes('google.com/maps/embed'))) {
      return settings.map_link;
    }

    // 3. Exact pinpoint using destinationTarget
    return `https://maps.google.com/maps?q=${destinationTarget}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`;
  }, [userPos, destinationTarget, mapZoom, settings?.map_link]);

  const directionsUrl = useMemo(() => {
    if (isAppleDevice) {
      if (userPos) {
        return `https://maps.apple.com/?saddr=${userPos.lat},${userPos.lng}&daddr=${destinationTarget}&dirflg=d`;
      }
      return `https://maps.apple.com/?daddr=${destinationTarget}&dirflg=d`;
    }

    if (userPos) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${destinationTarget}`;
    }

    if (settings?.map_link && settings.map_link.trim().startsWith('http') && !settings.map_link.includes('<iframe')) {
      return settings.map_link.trim();
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${destinationTarget}`;
  }, [isAppleDevice, userPos, destinationTarget, settings?.map_link]);

  const whatsappUrl = useMemo(() => {
    if (!bookingCode || !selectedService || !selectedDate || !selectedTime) return "#";
    const lines = [
      `*NOVA RESERVA — ${storeName}*`, "",
      `*Código:* #${bookingCode}`, `*Cliente:* ${customerName}`,
      `*Serviço:* ${selectedService.name} (${selectedService.duration_minutes} min)`,
      `*Profissional:* ${proName}`,
      `*Data/Hora:* ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às ${selectedTime}`, "",
      `*Valor:* ${money(total)}`,
      storeAddress ? `*Local:* ${storeAddress}` : "",
      customerNotes ? `*Obs:* ${customerNotes}` : "",
    ].filter(Boolean);
    return `https://wa.me/${onlyDigits(storePhone)}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [bookingCode, selectedService, selectedDate, selectedTime, customerName, proName, total, storeName, storeAddress, storePhone, customerNotes]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBack = () => { setErrorMsg(""); if (step > 1) setStep(step - 1); };

  const handleConfirm = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime) return;

    if (!customerName || !customerPhone) {
      alert("Por favor, preencha seu nome e WhatsApp.");
      setErrorMsg("Por favor, preencha seu nome e WhatsApp.");
      inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!phoneFormat.validate(customerPhone)) {
      alert("Informe um WhatsApp válido com DDD.");
      setErrorMsg("Informe um WhatsApp válido com DDD.");
      inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setIsProcessing(true);
    setErrorMsg("");

    try {
      const cleanPhone = customerPhone.replace(/\D/g, "");
      let customerId = "";
      const { data: existing } = await supabase.from("customers").select("id").eq("tenant_id", tenant.id).eq("phone", cleanPhone).maybeSingle();
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newC, error: cErr } = await supabase.from("customers").insert([{ tenant_id: tenant.id, name: customerName, phone: cleanPhone }]).select("id").single();
        if (cErr) throw cErr;
        customerId = newC.id;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = Math.random().toString(36).substring(2, 12);
      const pad = (n: number) => String(n).padStart(2, '0');
      const tzOffsetMin = -new Date().getTimezoneOffset();
      const tzSign = tzOffsetMin >= 0 ? '+' : '-';
      const tzAbs = Math.abs(tzOffsetMin);
      const tzStr = `${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;
      const scheduledAt = `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00${tzStr}`;
      let proId = selectedPro === "any" ? null : selectedPro?.id;
      if (selectedPro === "any") {
        const slot = availableSlots.find(s => s.time === selectedTime);
        if (slot?.availableProIds?.length) proId = slot.availableProIds[Math.floor(Math.random() * slot.availableProIds.length)];
        else proId = professionalsList[0]?.id || null;
      }

      const { data: newBooking, error: bErr } = await supabase.from("bookings").insert([{
        tenant_id: tenant.id, customer_id: customerId, professional_id: proId,
        service_id: selectedService.id, order_number: code, scheduled_at: scheduledAt,
        status: "confirmed",
        payment_mode: paymentScope === "full" ? "full" : paymentScope === "partial" ? "deposit" : "local",
        amount_paid: paymentScope === "local" || paymentMethod === "cash" ? 0 : amountPaid,
        amount_total: total, notes: customerNotes, access_code: accessCode,
      }]).select("id").single();
      if (bErr) throw bErr;

      if (paymentScope !== "local" && paymentMethod !== "cash") {
        const { data: checkoutData, error: cErr2 } = await supabase.functions.invoke("create-booking-checkout", {
          body: { bookingId: newBooking.id, returnUrl: getTenantPortalUrl(slug ?? '') }
        });
        if (!cErr2 && checkoutData?.url) { window.location.href = checkoutData.url; return; }
      }

      if (slug) {
        queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(slug) });
      }

      setBookingCode(code);
      playSuccessSound();
      setStep(5);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao registrar agendamento. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setBookingCode(null); setStep(1); setSelectedService(null); setSelectedPro(null);
    setSelectedDate(null); setSelectedTime(null); setCustomerName(""); setCustomerPhone("");
    setCustomerNotes(""); setPaymentScope("partial"); setPaymentMethod("pix");
  };

  const handleCardNumberChange = (v: string) => {
    const c = v.replace(/\D/g, "").slice(0, 16);
    setCardNumber(c.match(/.{1,4}/g)?.join(" ") || c);
  };
  const handleCardExpChange = (v: string) => {
    let d = v.replace(/\D/g, "");
    if (d.length >= 2) d = d.substring(0, 2) + "/" + d.substring(2, 4);
    setCardExp(d);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0d0d0d" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Loader2 className="w-8 h-8" style={{ color: accent || "#fff" }} />
        </motion.div>
        <p className="mt-4 text-sm font-medium text-white/40">Carregando agendamento…</p>
      </div>
    );
  }

  const isTenantInactive = !tenant || Boolean(tenant.deleted_at) || ['blocked', 'suspended', 'deleted', 'canceled'].includes(tenant.status) || (tenant.status !== 'active' && tenant.status !== 'trial');

  if (isTenantInactive) {
    return (
      <div className="min-h-screen flex flex-col p-6 items-center justify-center text-center max-w-md mx-auto w-full" style={{ background: theme.bg }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>Estabelecimento Indisponível</h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: theme.textMuted }}>
          Esta página de agendamento não está acessível pois o estabelecimento foi desativado ou encerrou suas atividades.
        </p>
      </div>
    );
  }

  const handleOpenSheet = () => {
    setShowInfoSheet(true);
    setHasOpenedSheet(true);
    if (geoStatus === "idle") requestLocation();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Playfair Display from Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      <div className="min-h-screen" style={{ background: theme.bg, color: theme.textPrimary, fontFamily: "'Inter', sans-serif" }}>

        {/* ── INFO SHEET (Mobile) ── */}
        <AnimatePresence>
          {showInfoSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setShowInfoSheet(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                onClick={e => e.stopPropagation()}
                className="w-full rounded-t-3xl overflow-hidden"
                style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, maxHeight: "85vh", overflowY: "auto" }}
              >
                {/* Sheet handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full" style={{ background: theme.cardBorder }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.cardBorder }}>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>{storeName}</h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{storeAddress}</p>
                  </div>
                  <button onClick={() => setShowInfoSheet(false)} className="p-2 rounded-full" style={{ color: theme.textMuted }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-6">
                  {/* Realtime Route Status Banner */}
                  {geoStatus === "loading" && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold"
                      style={{ background: `${accent}15`, borderColor: `${accent}35`, color: accent }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Calculando sua localização e rota em tempo real…</span>
                    </motion.div>
                  )}

                  {geoStatus === "ok" && distanceKm !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl border text-xs font-semibold"
                      style={{ background: `${accent}15`, borderColor: `${accent}35`, color: theme.textPrimary }}
                    >
                      <span className="flex items-center gap-2">
                        <Navigation className="w-3.5 h-3.5" style={{ color: accent }} />
                        <span>Você está a <strong style={{ color: accent }}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`}</strong> do salão</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>Rota ativa</span>
                    </motion.div>
                  )}

                  {/* Map */}
                  {hasLocationInfo && (
                    <div>
                      <div className="rounded-2xl overflow-hidden border relative" style={{ borderColor: theme.cardBorder, height: 200 }}>
                        <iframe
                          title="Mapa"
                          src={mapPreviewUrl}
                          className="w-full h-full border-0"
                          loading="lazy"
                          allowFullScreen
                          style={{ filter: (theme as any).mapFilter }}
                        />
                        {/* Loading overlay while getting location */}
                        {geoStatus === "loading" && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-2xl z-10"
                            style={{ background: `${theme.cardBg}ee`, backdropFilter: "blur(4px)" }}
                          >
                            <Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} />
                            <p className="text-xs font-semibold" style={{ color: theme.textPrimary }}>Traçando sua rota…</p>
                          </motion.div>
                        )}
                      </div>
                      <a href={directionsUrl} target="_blank" rel="noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border transition-all hover:scale-[1.01]"
                        style={{ background: `${accent}15`, borderColor: `${accent}50`, color: accent }}>
                        <Navigation className="w-4 h-4" /> Como chegar (Abrir no GPS)
                      </a>
                    </div>
                  )}

                  {/* Hours */}
                  {businessHoursList.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: theme.textMuted }}>Horários</p>
                      <div className="space-y-1">
                        {businessHoursList.map((h: any) => {
                          const isToday = h.weekday === todayWeekday;
                          return (
                            <div key={h.weekday} className="flex items-center justify-between py-1.5 text-sm"
                              style={{ color: isToday ? theme.textPrimary : theme.textMuted, fontWeight: isToday ? 600 : 400 }}>
                              <span className="flex items-center gap-2">
                                {WEEKDAYS_FULL[h.weekday]}
                                {isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}20`, color: accent }}>Hoje</span>}
                              </span>
                              <span className="font-mono text-xs">
                                {h.is_open ? `${h.open_time.substring(0, 5)} – ${h.close_time.substring(0, 5)}` : "Fechado"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contacts */}
                  <div className="flex flex-col gap-2.5">
                    <a href={`/${slug}/portal`} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
                      style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}>
                      <Calendar className="w-4 h-4" /> Meus agendamentos
                    </a>
                    {storePhone && (
                      <a href={`https://wa.me/${onlyDigits(storePhone)}`} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border"
                        style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}>
                        <MessageCircle className="w-4 h-4 text-green-400" /> Precisa de ajuda?
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MAP MODAL (Apple Maps / Spotify Minimalist Style) ── */}
        <AnimatePresence>
          {showMapModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
              style={{ background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(12px)" }}
              onClick={() => setShowMapModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 12 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col border"
                style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.cardBorder }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm" style={{ background: `${accent}15`, borderColor: `${accent}30`, color: accent }}>
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-none" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>
                        {storeName}
                      </h3>
                      <p className="text-xs mt-1 truncate max-w-[260px] sm:max-w-md font-medium" style={{ color: theme.textMuted }}>
                        {storeAddress || "Localização do estabelecimento"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMapModal(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border transition-all hover:opacity-80 active:scale-95 cursor-pointer"
                    style={{ borderColor: theme.cardBorder, color: theme.textMuted }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Map Canvas / Route Display */}
                <div className="relative h-80 sm:h-96 w-full bg-neutral-900">
                  <iframe
                    title="Rota e Localização"
                    src={mapModalUrl}
                    className="w-full h-full border-0"
                    style={{ filter: (theme as any).mapFilter }}
                    loading="lazy"
                    allowFullScreen
                  />

                  {/* Real-time Route Loading Overlay */}
                  {geoStatus === "loading" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 backdrop-blur-md z-20 px-6 text-center"
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full opacity-40" style={{ background: accent }} />
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border" style={{ background: `${accent}25`, borderColor: `${accent}50`, color: accent }}>
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      </div>
                      <div className="space-y-1 max-w-xs">
                        <p className="text-sm font-bold text-white">Carregando rota em tempo real...</p>
                        <p className="text-xs text-white/70">
                          Obtendo sua localização para calcular distância e trajeto exato até o salão.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Zoom Controls */}
                  <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
                    <button
                      onClick={() => setMapZoom(z => Math.min(z + 1, 20))}
                      className="w-9 h-9 rounded-xl text-base font-bold flex items-center justify-center border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                      style={{ background: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => setMapZoom(z => Math.max(z - 1, 10))}
                      className="w-9 h-9 rounded-xl text-base font-bold flex items-center justify-center border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                      style={{ background: theme.cardBg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                    >
                      −
                    </button>
                  </div>
                </div>

                {/* Salon Business Hours Section inside Map Modal */}
                {businessHoursList.length > 0 && (
                  <div className="px-6 py-4 border-t max-h-56 overflow-y-auto scrollbar-none" style={{ borderColor: theme.cardBorder, background: `${theme.cardBg}60` }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: accent }} />
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textPrimary }}>
                          Horários de Funcionamento
                        </p>
                      </div>
                      {(() => {
                        const today = businessHoursList.find((h: any) => h.weekday === todayWeekday);
                        return today?.is_open ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            🟢 Aberto Hoje ({today.open_time.substring(0, 5)} – {today.close_time.substring(0, 5)})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
                            🔴 Fechado Hoje
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {businessHoursList.map((h: any) => {
                        const isToday = h.weekday === todayWeekday;
                        return (
                          <div
                            key={h.weekday}
                            className="flex flex-col p-2.5 rounded-xl border transition-all"
                            style={{
                              borderColor: isToday ? `${accent}60` : theme.cardBorder,
                              background: isToday ? `${accent}15` : "transparent",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold" style={{ color: isToday ? accent : theme.textPrimary }}>
                                {WEEKDAYS_FULL[h.weekday]}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded" style={{ background: accent, color: theme.btnPrimaryText }}>
                                  Hoje
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium mt-1" style={{ color: h.is_open ? theme.textPrimary : theme.textMuted }}>
                              {h.is_open ? `${h.open_time.substring(0, 5)} – ${h.close_time.substring(0, 5)}` : "Fechado"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal Footer / Navigation Info */}
                <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: theme.cardBorder }}>
                  <div className="flex items-center gap-3">
                    {distanceKm !== null ? (
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <div>
                          <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                            Você está a {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: theme.textMuted }}>
                            Aprox. {Math.max(2, Math.round(distanceKm * 2.2))} min de carro
                          </p>
                        </div>
                      </div>
                    ) : geoStatus === "loading" ? (
                      <div className="flex items-center gap-2 text-xs font-medium" style={{ color: accent }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Calculando sua posição...</span>
                      </div>
                    ) : (
                      <button
                        onClick={requestLocation}
                        className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        style={{ background: `${accent}12`, borderColor: `${accent}30`, color: accent }}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Calcular rota ao vivo da minha localização
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LAYOUT ── */}
        <div className="flex flex-col lg:flex-row min-h-screen overflow-x-hidden w-full max-w-[100vw]">

          {/* ── SIDEBAR / HERO SECTION ── */}
          <aside className="relative lg:w-[400px] lg:h-screen lg:sticky lg:top-0 lg:self-start border-b lg:border-b-0 lg:border-r overflow-y-auto scrollbar-none flex flex-col"
            style={{ background: theme.sidebarBg, borderColor: theme.cardBorder }}>

            {/* Capa Minimalista com Degradê Estendido */}
            <div className="relative w-full h-44 sm:h-56 shrink-0">
              {settings?.banner_url ? (
                <>
                  <img
                    src={settings.banner_url}
                    alt="Capa"
                    className="w-full h-full object-cover"
                  />
                  {/* Gradiente suave e estendido, começando do topo e descendo até a cor sólida do fundo */}
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${theme.sidebarBg} 0%, transparent 85%)` }} />
                </>
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${accent}30 0%, ${theme.sidebarBg} 100%)` }} />
              )}
            </div>

            {/* Perfil & Informações — Estilo Instagram / Behance */}
            <div className="px-6 relative z-10 flex flex-col items-center text-center -mt-16 sm:-mt-20 pb-8">
              
              {/* Avatar Centralizado - Maior conforme feedback */}
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden shrink-0 shadow-sm mb-3"
                style={{ background: theme.cardBg, border: `4px solid ${theme.sidebarBg}` }}>
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt={storeName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-3xl"
                    style={{ background: accent, color: theme.btnPrimaryText }}>
                    {storeName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Nome e Classificação */}
              <h1 className="text-2xl font-bold tracking-tight"
                style={{ color: contrast.titleColor, fontFamily: theme.fontSerif }}>
                {storeName}
              </h1>
              
              <div className="flex flex-wrap justify-center items-center gap-1.5 mt-1 text-[13px] font-medium" style={{ color: contrast.descriptionColor }}>
                <span className="flex items-center gap-1 font-bold" style={{ color: accent }}>
                  <Star className="w-3.5 h-3.5 fill-current" /> 5.0
                </span>
                <span className="opacity-50">•</span>
                <span className="opacity-80">(Novo)</span>
                <span className="opacity-50">•</span>
                <span className="opacity-80 capitalize">
                  {tenant?.business_type === "barbearia" ? "Barbearia" : 
                   tenant?.business_type === "esmalteria" ? "Esmalteria" : 
                   "Salão de Beleza"}
                </span>
              </div>

              {/* Descrição Curta */}
              <p className="mt-4 text-[14px] leading-relaxed max-w-[320px]"
                style={{ color: contrast.descriptionColor }}>
                {settings?.slogan || settings?.custom_palette?.slogan || settings?.short_description || settings?.description || "Agende seu horário com os melhores profissionais."}
              </p>

              {/* Redes Sociais no Padrão da Imagem (Lado a lado, botões largos) */}
              <div className="flex items-center justify-center gap-3 mt-6 w-full max-w-[320px]">
                {storeInsta && (
                  <a href={`https://instagram.com/${storeInsta}`} target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}>
                    <InstagramIcon className="w-4 h-4" style={{ color: accent }} />
                    <span className="text-[13px] font-semibold">Instagram</span>
                  </a>
                )}
                {storePhone && (
                  <a href={`https://wa.me/${onlyDigits(storePhone)}`} target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}>
                    <WhatsAppIcon className="w-4 h-4" style={{ color: accent }} />
                    <span className="text-[13px] font-semibold">WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Ações Minimalistas em Grupo de Cards (Estilo iOS Settings) */}
              <div className="w-full mt-8 flex flex-col rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: theme.cardBorder, backgroundColor: theme.cardBg }}>
                {hasLocationInfo && (
                  <button
                    onClick={() => {
                      setShowMapModal(true);
                      if (geoStatus === "idle") requestLocation();
                    }}
                    className="flex items-center justify-between p-4 text-left group hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b"
                    style={{ borderColor: theme.cardBorder }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
                        <MapPin className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold" style={{ color: theme.textPrimary }}>Local e Horários</p>
                        <p className="text-[12px] opacity-70 mt-0.5" style={{ color: theme.textPrimary }}>
                          {storeAddress || "Ver informações do local"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-30 shrink-0" style={{ color: theme.textPrimary }} />
                  </button>
                )}

                <a href={`/${slug}/portal`} className="flex items-center justify-between p-4 text-left group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
                      <Calendar className="w-4 h-4" style={{ color: accent }} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: theme.textPrimary }}>Meus agendamentos</p>
                      <p className="text-[12px] opacity-70 mt-0.5" style={{ color: theme.textPrimary }}>
                        Acesse seu histórico e portal
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-30 shrink-0" style={{ color: theme.textPrimary }} />
                </a>
              </div>

            </div>
          </aside>

          {/* ── MAIN WIZARD ── */}
          <main className="flex-1 flex flex-col min-h-0">

            {/* Step indicator */}
            {step < 5 && (
              <div className="border-b" style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
                <StepIndicator step={step} accent={accent} theme={theme} />
              </div>
            )}

            {/* Progress bar */}
            {step < 5 && (
              <div className="h-1" style={{ background: theme.cardBorder }}>
                <motion.div className="h-full" style={{ background: accent }} animate={{ width: `${(step / 4) * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
              </div>
            )}

            {/* Back + Title bar */}
            {step > 1 && step < 5 && (
              <div className="flex items-center gap-3 px-5 lg:px-10 py-4 border-b" style={{ borderColor: theme.cardBorder }}>
                <button onClick={handleBack}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors"
                  style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
                    {["", "Escolha o Serviço", "Escolha o Profissional", "Data & Horário", "Confirmar"][step]}
                  </p>
                  {step === 2 && selectedService && (
                    <p className="text-sm font-medium mt-0.5" style={{ color: theme.textMuted }}>
                      {selectedService.name} · {money(selectedService.price)}
                    </p>
                  )}
                  {step === 3 && selectedPro && (
                    <p className="text-sm font-medium mt-0.5" style={{ color: theme.textMuted }}>
                      {selectedService?.name} · {proName}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error banner */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mx-5 lg:mx-10 mt-4 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                  <span>{errorMsg}</span>
                  <button onClick={() => setErrorMsg("")} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── STEP CONTENT ── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ───────────────── STEP 1: SERVICE ───────────────── */}
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}
                    className="px-5 lg:px-10 py-8 pb-32 lg:pb-12 max-w-4xl mx-auto w-full">
                    <h2 className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>O que você quer fazer hoje?</h2>
                    <p className="text-sm mb-8" style={{ color: theme.textMuted }}>Selecione um serviço para começar o agendamento.</p>

                    {servicesList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed" style={{ borderColor: theme.cardBorder }}>
                        <Scissors className="w-10 h-10 mb-4" style={{ color: theme.textMuted }} />
                        <h3 className="text-base font-semibold" style={{ color: theme.textPrimary }}>Nenhum serviço disponível</h3>
                        <p className="text-sm mt-1" style={{ color: theme.textMuted }}>O estabelecimento ainda não cadastrou serviços.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {servicesList.map((s, i) => {
                          const hasDiscount = s.original_price && s.original_price > s.price;
                          const discountPct = hasDiscount ? Math.round(((s.original_price - s.price) / s.original_price) * 100) : 0;
                          return (
                            <motion.button
                              key={s.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => { setSelectedService(s); setStep(2); }}
                              className="group relative text-left rounded-2xl overflow-hidden border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex flex-col"
                              style={{ borderColor: theme.cardBorder, background: theme.cardBg }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = theme.cardBorder)}
                            >
                              {/* Image or icon */}
                              {s.photo_url ? (
                                <div className="relative h-60 sm:h-56 overflow-hidden">
                                  <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-700 ease-out" />
                                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                                  {hasDiscount && (
                                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm" style={{ background: "#ef4444" }}>-{discountPct}%</span>
                                  )}
                                  {s.category && (
                                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white/90 shadow-sm" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>{s.category}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="h-28 flex items-center justify-center border-b" style={{ borderColor: theme.cardBorder, background: `${accent}08` }}>
                                  <Scissors className="w-8 h-8" style={{ color: `${accent}60` }} />
                                </div>
                              )}

                              <div className="p-5 flex flex-col flex-1">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h3 className="text-base font-bold leading-snug" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>{s.name}</h3>
                                  <div className="text-right shrink-0">
                                    {hasDiscount && <p className="text-[11px] line-through" style={{ color: theme.textMuted }}>{money(s.original_price)}</p>}
                                    <p className="text-lg font-bold" style={{ color: accent, fontFamily: theme.fontSerif }}>{money(s.price)}</p>
                                  </div>
                                </div>
                                {s.description && (
                                  <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: theme.textMuted }}>{s.description}</p>
                                )}
                                <div className="flex items-center justify-between pt-3 mt-auto border-t" style={{ borderColor: theme.cardBorder }}>
                                  <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
                                    <Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min
                                  </span>
                                  <span className="flex items-center gap-1 text-xs font-bold" style={{ color: accent }}>
                                    Agendar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                  </span>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ───────────────── STEP 2: PROFESSIONAL ───────────────── */}
                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}
                    className="px-5 lg:px-10 py-8 pb-32 lg:pb-12 max-w-3xl mx-auto w-full">
                    <h2 className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>Com quem prefere ser atendido?</h2>
                    <p className="text-sm mb-8" style={{ color: theme.textMuted }}>Escolha um profissional ou deixe que encontremos o mais rápido disponível.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Any professional */}
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => { setSelectedPro("any"); setStep(3); }}
                        className="group relative rounded-2xl border-2 p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                        style={{ borderColor: `${accent}40`, background: `${accent}06` }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = `${accent}40`)}
                      >
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${accent}18` }}>
                          <Zap className="w-7 h-7" style={{ color: accent }} />
                        </div>
                        <p className="font-bold text-sm" style={{ color: theme.textPrimary }}>Qualquer profissional</p>
                        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>Horário mais rápido</p>
                        <span className="mt-3 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${accent}20`, color: accent }}>Recomendado</span>
                      </motion.button>

                      {professionalsList.map((p, i) => (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (i + 1) * 0.06 }}
                          onClick={() => { setSelectedPro(p); setStep(3); }}
                          className="group relative rounded-2xl border-2 p-6 flex flex-col items-center text-center transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                          style={{ borderColor: theme.cardBorder, background: theme.cardBg }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = theme.cardBorder)}
                        >
                          {p.photo_url ? (
                            <img src={p.photo_url} alt={p.name} className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-md" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border" style={{ borderColor: theme.cardBorder, background: theme.bg }}>
                              <User className="w-7 h-7" style={{ color: theme.textMuted }} />
                            </div>
                          )}
                          <p className="font-bold text-sm" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>{p.name}</p>
                          <p className="text-xs mt-1 truncate w-full" style={{ color: theme.textMuted }}>{p.role_title || "Profissional"}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ───────────────── STEP 3: DATE & TIME ───────────────── */}
                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}
                    className="px-5 lg:px-10 py-8 pb-32 lg:pb-12 max-w-3xl mx-auto w-full space-y-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>Quando você prefere?</h2>
                      <p className="text-sm" style={{ color: theme.textMuted }}>Escolha o dia e horário que melhor se encaixa na sua agenda.</p>
                    </div>

                    {/* Date Carousel */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.textMuted }}>Selecione o dia</p>
                        {!hasScrolledDates && (
                          <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ color: theme.textMuted }}>
                            <ChevronRight className="w-4 h-4" />
                          </motion.div>
                        )}
                      </div>
                      <div className="flex gap-6 overflow-x-auto pt-2 pb-5 scrollbar-none" onScroll={() => setHasScrolledDates(true)}>
                        {availableDays.map(({ date: d, isOpen }) => {
                          const isSel = selectedDate?.getTime() === d.getTime();
                          const isToday = d.getTime() === startOfDay(new Date()).getTime();
                          return (
                            <button
                              key={d.getTime()}
                              disabled={!isOpen}
                              onClick={() => { if (!isOpen) return; setHasScrolledDates(true); setSelectedDate(d); setSelectedTime(null); }}
                              className="shrink-0 w-[76px] py-4 rounded-2xl text-center border-2 transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed shadow-sm"
                              style={{
                                borderColor: isSel ? accent : theme.cardBorder,
                                background: isSel ? (theme.btnPrimaryBg || accent) : theme.cardBg,
                                color: isSel ? theme.btnPrimaryText : theme.textPrimary,
                              }}
                            >
                              <p className="text-[10px] uppercase font-bold tracking-wider mb-1.5" style={{ opacity: isSel ? 0.9 : 0.5, color: isSel ? theme.btnPrimaryText : theme.textMuted }}>
                                {isToday ? "Hoje" : WEEKDAYS[d.getDay()]}
                              </p>
                              <p className="text-2xl" style={{ color: isSel ? theme.btnPrimaryText : theme.textPrimary, fontFamily: theme.fontSerif, fontWeight: 900, lineHeight: 1 }}>{format(d, "dd")}</p>
                              <p className="text-[10px] uppercase font-semibold mt-1.5" style={{ opacity: isSel ? 0.9 : 0.5, color: isSel ? theme.btnPrimaryText : theme.textMuted }}>
                                {format(d, "MMM", { locale: ptBR })}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slots */}
                    <AnimatePresence>
                      {selectedDate && (
                        <motion.div
                          key={`slots-${selectedDate?.toDateString()}-${selectedService?.id}-${typeof selectedPro === 'object' ? selectedPro?.id : selectedPro}`}
                          ref={timeSlotsRef}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <p className="text-xs font-bold uppercase tracking-widest mb-6 mt-4" style={{ color: theme.textMuted }}>
                            Horários em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          <SlotGrid
                            allSlots={availableSlots}
                            selectedTime={selectedTime || ""}
                            onSelect={setSelectedTime}
                            accent={accent}
                            theme={theme}
                          />

                          <AnimatePresence>
                            {selectedDate && selectedTime && (
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6" ref={confirmBtnRef}>
                                <button
                                  onClick={() => setStep(4)}
                                  className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-lg"
                                  style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}
                                >
                                  Continuar para confirmação <ArrowRight className="w-5 h-5" />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* ───────────────── STEP 4: CONFIRM ───────────────── */}
                {step === 4 && (
                  <motion.div key="s4" ref={step4Ref} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}
                    className="px-5 lg:px-10 py-8 max-w-5xl mx-auto w-full pb-32 lg:pb-12">

                    {/* Booking Summary Banner */}
                    <div className="rounded-2xl p-5 mb-8 border" style={{ background: `${accent}0a`, borderColor: `${accent}25` }}>
                      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>Resumo do seu agendamento</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { icon: Scissors, label: "Serviço", value: selectedService?.name },
                          { icon: User, label: "Profissional", value: proName },
                          { icon: Calendar, label: "Data", value: selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "" },
                          { icon: Clock, label: "Horário", value: selectedTime || "" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-2.5">
                            <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${accent}80` }}>{label}</p>
                              <p className="text-sm font-semibold mt-0.5" style={{ color: theme.textPrimary }}>{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
                      {/* LEFT */}
                      <div className="space-y-8">
                        {/* Contact */}
                        <div ref={inputsRef}>
                          <h3 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                            <User className="w-4 h-4" style={{ color: accent }} /> Seus dados
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>WhatsApp com DDD *</label>
                              <input
                                type="tel"
                                placeholder={phoneFormat.placeholder}
                                value={customerPhone}
                                onChange={e => setCustomerPhone(phoneFormat.format(e.target.value))}
                                maxLength={phoneFormat.maxLength}
                                className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm font-medium focus:outline-none transition-all"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                onFocus={e => (e.target.style.borderColor = accent)}
                                onBlur={e => (e.target.style.borderColor = theme.cardBorder)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>Nome completo *</label>
                              <input
                                type="text"
                                placeholder="Seu nome"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm font-medium focus:outline-none transition-all"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                onFocus={e => (e.target.style.borderColor = accent)}
                                onBlur={e => (e.target.style.borderColor = theme.cardBorder)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>Observações (opcional)</label>
                              <textarea
                                placeholder="Ex: Prefiro tesoura no topo, trazer foto de referência..."
                                value={customerNotes}
                                onChange={e => setCustomerNotes(e.target.value)}
                                rows={3}
                                className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm focus:outline-none resize-none transition-all"
                                style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                onFocus={e => (e.target.style.borderColor = accent)}
                                onBlur={e => (e.target.style.borderColor = theme.cardBorder)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payment */}
                        <div>
                          <h3 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                            <CreditCard className="w-4 h-4" style={{ color: accent }} /> Forma de pagamento
                          </h3>

                          {/* Scope — Fix #2: only show admin-enabled options */}
                          <div className={`grid gap-2 mb-6`} style={{ gridTemplateColumns: `repeat(${allowedPaymentScopes.length}, 1fr)` }}>
                            {allowedPaymentScopes.map(({ key, label, desc }) => (
                              <button
                                key={key}
                                onClick={() => setPaymentScope(key)}
                                className="relative rounded-xl p-3.5 text-center border-2 transition-all"
                                style={{
                                  borderColor: paymentScope === key ? accent : theme.cardBorder,
                                  background: paymentScope === key ? `${accent}10` : theme.cardBg,
                                }}
                              >
                                {paymentScope === key && <CheckCircle2 className="w-3.5 h-3.5 absolute top-2.5 right-2.5" style={{ color: accent }} />}
                                <p className="text-xs font-bold" style={{ color: paymentScope === key ? accent : theme.textPrimary }}>{label}</p>
                                <p className="text-xs mt-0.5 font-semibold" style={{ color: paymentScope === key ? `${accent}90` : theme.textMuted }}>{desc}</p>
                              </button>
                            ))}
                          </div>

                          {/* Method tabs */}
                          {paymentScope !== "local" && (
                            <>
                              <div className="flex items-center gap-1 border rounded-xl p-1 mb-6" style={{ borderColor: theme.cardBorder }}>
                                {([
                                  { key: "pix", label: "PIX", icon: QrCode },
                                  { key: "card", label: "Cartão", icon: CreditCard },
                                ] as { key: PaymentMethod; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                                  <button key={key} onClick={() => setPaymentMethod(key)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                                    style={{ background: paymentMethod === key ? (theme.btnPrimaryBg || accent) : "transparent", color: paymentMethod === key ? theme.btnPrimaryText : theme.textMuted }}>
                                    <Icon className="w-4 h-4" /> {label}
                                  </button>
                                ))}
                              </div>

                              {paymentMethod === "pix" && (
                                <div className="rounded-2xl border p-6 text-center space-y-4" style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
                                  <div className="mx-auto w-36 h-36 bg-white rounded-2xl flex items-center justify-center p-2 shadow-md">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=pix-navalha-${slug}-${amountPaid}`} alt="QR PIX" className="w-full h-full object-contain" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input readOnly value={`pix.navalha.${slug}.${amountPaid}`} className="flex-1 rounded-xl px-3 py-2 text-xs font-mono border truncate" style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textMuted }} />
                                    <button onClick={() => { navigator.clipboard.writeText(`pix.navalha.${slug}.${amountPaid}`); setPixCopied(true); setTimeout(() => setPixCopied(false), 2500); }}
                                      className="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all"
                                      style={{ borderColor: pixCopied ? "#10b981" : theme.cardBorder, color: pixCopied ? "#10b981" : theme.textPrimary }}>
                                      {pixCopied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                                    </button>
                                  </div>
                                  <p className="text-xs" style={{ color: theme.textMuted }}>Pague {money(amountPaid)} via PIX, depois confirme abaixo.</p>
                                </div>
                              )}

                              {paymentMethod === "card" && (
                                <div className="space-y-4">
                                  <button onClick={() => { setCardNumber("4242 4242 4242 4242"); setCardExp("12/30"); setCardCvc("123"); }}
                                    className="text-xs flex items-center gap-1.5" style={{ color: accent }}>
                                    <Sparkles className="w-3 h-3" /> Preencher cartão de teste Stripe
                                  </button>
                                  <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>Número do cartão</label>
                                    <input type="text" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={e => handleCardNumberChange(e.target.value)}
                                      className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm font-mono focus:outline-none transition-all"
                                      style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                      onFocus={e => (e.target.style.borderColor = accent)} onBlur={e => (e.target.style.borderColor = theme.cardBorder)} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>Validade</label>
                                      <input type="text" placeholder="12/30" value={cardExp} onChange={e => handleCardExpChange(e.target.value)}
                                        className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm font-mono text-center focus:outline-none transition-all"
                                        style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                        onFocus={e => (e.target.style.borderColor = accent)} onBlur={e => (e.target.style.borderColor = theme.cardBorder)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.textMuted }}>CVC</label>
                                      <input type="text" maxLength={4} placeholder="123" value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, ""))}
                                        className="w-full rounded-xl border-2 px-4 py-3.5 text-base sm:text-sm font-mono text-center focus:outline-none transition-all"
                                        style={{ background: theme.bg, borderColor: theme.cardBorder, color: theme.textPrimary }}
                                        onFocus={e => (e.target.style.borderColor = accent)} onBlur={e => (e.target.style.borderColor = theme.cardBorder)} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* RIGHT: Sticky Summary */}
                      <div className="hidden lg:block">
                        <div className="sticky top-6 rounded-2xl border p-6 space-y-5" style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.textMuted }}>Total a pagar</p>

                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between" style={{ color: theme.textMuted }}>
                              <span>Serviço</span>
                              <span>{money(total)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg border-t pt-3" style={{ borderColor: theme.cardBorder }}>
                              <span style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>Pagar agora</span>
                              <span style={{ color: accent, fontFamily: theme.fontSerif }}>{money(amountPaid)}</span>
                            </div>
                            {paymentScope === "partial" && (
                              <div className="flex justify-between text-xs" style={{ color: theme.textMuted }}>
                                <span>Restante no salão</span>
                                <span>{money(amountDue)}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg"
                            style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}
                          >
                            {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Processando…</> : <><ShieldCheck className="w-5 h-5" /> Confirmar agendamento</>}
                          </button>

                          <p className="text-[10px] text-center flex items-center justify-center gap-1.5" style={{ color: theme.textMuted }}>
                            <ShieldCheck className="w-3 h-3 text-green-500" /> Pagamento seguro via Stripe
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ───────────────── STEP 5: SUCCESS ───────────────── */}
                {step === 5 && bookingCode && (
                  <motion.div key="s5" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
                    className="px-5 lg:px-10 py-12 max-w-lg mx-auto w-full text-center">

                    {/* Checkmark */}
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12, stiffness: 180, delay: 0.1 }}
                      className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg"
                      style={{ background: `${accent}20`, border: `3px solid ${accent}` }}>
                      <CheckCircle2 className="w-10 h-10" style={{ color: accent }} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                      <h2 className="text-3xl font-black mb-2" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>Reserva confirmada!</h2>
                      <p className="text-sm" style={{ color: theme.textMuted }}>Seu horário está garantido. Anote o código de confirmação abaixo.</p>
                    </motion.div>

                    {/* Booking card */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                      className="mt-8 rounded-2xl border overflow-hidden"
                      style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
                      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: theme.cardBorder, background: `${accent}0a` }}>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>Código da reserva</p>
                        <p className="text-2xl font-black" style={{ color: accent, fontFamily: theme.fontSerif }}>#{bookingCode}</p>
                      </div>
                      <div className="px-6 py-5 space-y-3 text-left">
                        {[
                          { label: "Serviço", value: selectedService?.name },
                          { label: "Profissional", value: proName },
                          { label: "Data", value: selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "" },
                          { label: "Horário", value: selectedTime },
                          { label: "Total", value: money(total) },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between">
                            <span style={{ color: theme.textMuted }}>{label}</span>
                            <span className="font-semibold" style={{ color: theme.textPrimary }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-6 space-y-3">
                      <a href={whatsappUrl} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-base transition-transform hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: "#25D366", color: "#fff" }}>
                        <WhatsAppIcon className="w-5 h-5" />
                        <div className="text-left">
                          <p className="leading-none">Enviar reserva no WhatsApp</p>
                          <p className="text-xs font-normal opacity-80 mt-0.5">Confirme com o estabelecimento</p>
                        </div>
                      </a>

                      <a href={`/${slug}/portal`}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm border transition-opacity hover:opacity-80"
                        style={{ borderColor: theme.cardBorder, color: theme.textPrimary }}>
                        <Calendar className="w-4 h-4" style={{ color: accent }} /> Ver meus agendamentos
                      </a>

                      <button onClick={resetAll} className="text-sm underline" style={{ color: theme.textMuted }}>
                        Fazer outro agendamento
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── MOBILE FIXED FOOTER — Step 4 ── */}
            {step === 4 && (
              <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t px-5 py-4"
                style={{ background: theme.cardBg, borderColor: theme.cardBorder, boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center gap-4 max-w-xl mx-auto">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Pagar agora</p>
                    <p className="text-xl font-black" style={{ color: accent }}>{money(amountPaid)}</p>
                  </div>
                  <button
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 active:scale-[0.98] shadow-md"
                    style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}
                  >
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</> : <><ShieldCheck className="w-4 h-4" /> Confirmar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile info peek bar */}
            {step < 4 && (
              <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t"
                style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
                <button
                  onClick={handleOpenSheet}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold relative overflow-hidden"
                  style={{ color: theme.textMuted }}
                >
                  {geoStatus === "loading" ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accent }} />
                      <span style={{ color: accent, fontWeight: 700 }}>Traçando rota em tempo real…</span>
                    </div>
                  ) : (
                    <>
                      {/* Pulse ripple — only until first interaction */}
                      {!hasOpenedSheet && (
                        <>
                          <motion.span
                            className="absolute inset-0 rounded-none"
                            style={{ background: `${accent}18` }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", repeatDelay: 1 }}
                          />
                          <motion.span
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-6 rounded-full"
                            style={{ background: `${accent}20` }}
                            animate={{ scaleX: [0.8, 1.4, 0.8], opacity: [0.6, 0, 0.6] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          />
                        </>
                      )}
                      <motion.span
                        animate={!hasOpenedSheet ? { y: [0, -3, 0] } : { y: 0 }}
                        transition={{ repeat: hasOpenedSheet ? 0 : Infinity, duration: 1.4, ease: "easeInOut" }}
                      >
                        <ChevronUp className="w-4 h-4" style={{ color: accent }} />
                      </motion.span>
                      <MapPin className="w-3.5 h-3.5" style={{ color: accent }} />
                      <span style={{ color: accent, fontWeight: 700 }}>
                        {distanceKm !== null ? `A ${distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + ' km'} de você • Horários` : "Localização & horários"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Footer */}
            {step === 5 && (
              <footer className="mt-4 pb-8 text-center text-xs" style={{ color: theme.textMuted }}>
                <p>© {new Date().getFullYear()} {storeName}</p>
                <p className="mt-1 font-mono opacity-50">Desenvolvido com <span style={{ color: accent }}>Raffros Corteflow</span></p>
              </footer>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
