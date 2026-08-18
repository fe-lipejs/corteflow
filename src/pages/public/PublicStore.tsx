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
  Navigation,
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
  ChevronUp,
  AlertTriangle,
  Store,
  Home,
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
const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={style}
  >
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos((pos1.lat * Math.PI) / 180) * Math.cos((pos2.lat * Math.PI) / 180);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── SlotGrid Component ────────────────────────────────────────────────────────
function SlotGrid({
  allSlots,
  selectedTime,
  onSelect,
  accent,
  theme,
  isDark,
}: {
  allSlots: Slot[];
  selectedTime: string;
  onSelect: (t: string) => void;
  accent: string;
  theme: any;
  isDark: boolean;
}) {
  const visibleSlots = allSlots.filter(
    (s) => s.available || (s.unavailableReason !== "past" && s.unavailableReason !== "no_fit")
  );

  if (visibleSlots.length === 0) {
    return (
      <div
        className="py-12 text-center rounded-2xl border"
        style={{
          borderColor: theme.cardBorder,
          background: theme.cardBg,
        }}
      >
        <div
          className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
          style={{ background: `${accent}15` }}
        >
          <Clock className="w-6 h-6" style={{ color: accent }} />
        </div>
        <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>
          Nenhum horário disponível
        </p>
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
          Por favor, selecione outra data acima.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3">
      {visibleSlots.map((slot) => {
        if (!slot.available) {
          return (
            <button
              key={slot.time}
              disabled
              className="py-3 px-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all opacity-30 cursor-not-allowed line-through"
              style={{
                borderColor: theme.cardBorder,
                background: "transparent",
                color: theme.textMuted,
              }}
            >
              {slot.time}
            </button>
          );
        }

        const isSel = selectedTime === slot.time;
        return (
          <motion.button
            key={slot.time}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(slot.time)}
            className="py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-200 relative cursor-pointer"
            style={{
              borderColor: isSel ? accent : theme.cardBorder,
              background: isSel
                ? theme.btnPrimaryBg || accent
                : theme.cardBg,
              color: isSel ? theme.btnPrimaryText : theme.textPrimary,
              boxShadow: isSel
                ? `0 4px 16px ${accent}40`
                : isDark
                  ? "none"
                  : "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            {slot.time}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Step Indicator Component ─────────────────────────────────────────────────
const STEP_LABELS = ["Serviço", "Profissional", "Data & Hora", "Confirmar"];

function StepIndicator({
  step,
  accent,
  theme,
  isDark,
}: {
  step: number;
  accent: string;
  theme: any;
  isDark: boolean;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-3 sm:py-4">
      <div className="flex items-center justify-between relative">
        {STEP_LABELS.map((label, i) => {
          const num = i + 1;
          const done = step > num;
          const active = step === num;

          return (
            <div key={num} className="flex-1 flex flex-col items-center relative z-10">
              <div className="flex items-center w-full">
                {/* Left Line */}
                <div
                  className="flex-1 h-[2px] transition-all duration-300"
                  style={{
                    background: i === 0 ? "transparent" : step >= num ? accent : theme.cardBorder,
                    opacity: i === 0 ? 0 : 1,
                  }}
                />

                {/* Node Pill */}
                <motion.div
                  animate={{ scale: active ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                  style={{
                    background: done || active
                      ? accent
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#E2E8F0",
                    color: done || active
                      ? theme.btnPrimaryText
                      : theme.textMuted,
                    border: done || active
                      ? "none"
                      : `1px solid ${theme.cardBorder}`,
                    boxShadow: "none",
                  }}
                >
                  {done ? <Check className="w-4 h-4 stroke-[2.5]" /> : num}
                </motion.div>

                {/* Right Line */}
                <div
                  className="flex-1 h-[2px] transition-all duration-300"
                  style={{
                    background:
                      i === STEP_LABELS.length - 1
                        ? "transparent"
                        : step > num
                          ? accent
                          : theme.cardBorder,
                    opacity: i === STEP_LABELS.length - 1 ? 0 : 1,
                  }}
                />
              </div>

              {/* Label */}
              <span
                className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-1.5 transition-colors hidden xs:block"
                style={{
                  color: active ? accent : done ? theme.textPrimary : theme.textMuted,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
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
  const slugFromHook = useTenantSlug();
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugFromHook ?? paramSlug ?? undefined;
  const { setThemeId, setCustomPalette } = useTheme();
  const { data: storeData, isLoading: loading } = usePublicStore(slug);
  const queryClient = useQueryClient();

  const tenant: any = storeData?.tenant;
  const settings: any = storeData?.settings;
  const rawServicesList: any[] = storeData?.services || [];
  const professionalsList: any[] = storeData?.professionals || [];
  const businessHoursList: any[] = storeData?.businessHours || [];
  
  const [bookingMode, setBookingMode] = useState<'instore' | 'home'>('instore');
  const [clientAddress, setClientAddress] = useState("");

  const servicesList = useMemo(() => {
    return rawServicesList.filter(s => {
      const mode = s.service_mode || 'instore';
      if (mode === 'both') return true;
      return mode === bookingMode;
    });
  }, [rawServicesList, bookingMode]);

  // Theme setup directly using preset defaults (Classic, Noir, Elegant)
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

  // Auto-scroll hooks
  useEffect(() => {
    if (step >= 4) {
      setTimeout(() => {
        inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [step]);

  useEffect(() => {
    if (step === 3 && selectedDate) {
      setTimeout(() => {
        timeSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [selectedDate, step]);

  useEffect(() => {
    if (step === 3 && selectedTime) {
      setTimeout(() => {
        confirmBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedTime, step]);

  // Favicon
  useEffect(() => {
    if (settings?.logo_url) {
      const link: HTMLLinkElement =
        document.querySelector("link[rel*='icon']") || document.createElement("link");
      link.type = "image/x-icon";
      link.rel = "icon";
      link.href = settings.logo_url;
      document.head.appendChild(link);
    }
  }, [settings?.logo_url]);

  // Geo
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied" | "ok" | "ignored">("idle");
  const [clientDistanceKm, setClientDistanceKm] = useState<number | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const todayWeekday = new Date().getDay();

  const storeCoords = useMemo(
    () => ({
      lat: settings?.latitude || -20.4433088,
      lng: settings?.longitude || -40.3535541,
    }),
    [settings]
  );

  const geocodeAndCheckDistance = async (address: string) => {
    if (!settings?.latitude || !settings?.longitude) return 0;
    try {
      setIsGeocoding(true);
      setErrorMsg("");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (!data || data.length === 0) {
        setErrorMsg("Não encontramos este endereço. Verifique se está digitado corretamente.");
        return null;
      }
      const clientLat = parseFloat(data[0].lat);
      const clientLng = parseFloat(data[0].lon);
      const dist = haversineKm({ lat: clientLat, lng: clientLng }, storeCoords);
      
      if (settings?.home_service_radius_km && dist > settings.home_service_radius_km) {
        setErrorMsg(`Endereço fora da área de cobertura do salão (máximo ${settings.home_service_radius_km} km).`);
        return null;
      }
      
      setClientDistanceKm(dist);
      return dist;
    } catch (err) {
      setErrorMsg("Erro ao validar endereço. Tente novamente.");
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");

    let isResolved = false;
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
          console.warn("Geolocation denied:", err.message);
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

  // Derived styles & Contrast Tokens
  const accent = settings?.custom_palette?.primary || theme.accent;
  const contrast = useMemo(() => getThemeContrastEngine(theme), [theme]);
  const isDark = contrast.isDark;
  const storeName = settings?.fantasy_name || tenant?.name || "";

  // Apple-inspired canvas background for Light mode (#F5F5F7), or exact theme.bg for Dark mode
  const canvasBg = isDark ? theme.bg : "#F5F5F7";
  const sidebarBackground = isDark ? theme.sidebarBg : "#FFFFFF";
  const cardBackground = isDark ? (theme.cardBg || "#141414") : "#FFFFFF";
  const cardBorderColor = isDark ? theme.cardBorder : "#E5E7EB";
  const cardShadowStyle = isDark
    ? "0 4px 20px rgba(0,0,0,0.4)"
    : "0 2px 10px -2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04)";

  const storeAddress = useMemo(() => {
    if (settings?.full_address && settings.full_address.trim()) return settings.full_address.trim();
    const parts = [
      settings?.address
        ? `${settings.address}${settings.street_number ? `, ${settings.street_number}` : ""}`
        : "",
      settings?.complement ? `(${settings.complement})` : "",
      settings?.neighborhood,
      settings?.city ? `${settings.city}${settings.state ? ` - ${settings.state}` : ""}` : "",
      settings?.zip_code ? `CEP ${settings.zip_code}` : "",
      "Brasil",
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
    return settings?.address || "";
  }, [settings]);

  const hasLocationInfo = Boolean(storeAddress || settings?.map_link);
  const storePhone = settings?.phone || settings?.whatsapp_number;

  let storeInsta = settings?.instagram ? settings.instagram.replace("@", "").trim() : null;
  if (storeInsta?.includes("instagram.com/")) {
    storeInsta = storeInsta.split("instagram.com/")[1].replace("/", "");
  }

  const travelFee = useMemo(() => {
    if (bookingMode !== 'home' || clientDistanceKm === null) return 0;
    
    if (selectedPro && selectedPro !== "any" && selectedPro.home_fee != null && selectedPro.home_fee > 0) {
      return selectedPro.home_fee;
    }
    
    const feeType = settings?.home_service_fee_type || 'fixed';
    const feeValue = settings?.home_service_fee_value || 0;
    
    if (feeType === 'free') return 0;
    if (feeType === 'fixed') return feeValue;
    if (feeType === 'per_km') {
      const baseFee = settings?.home_service_base_fee || 0;
      const freeRadius = settings?.home_service_free_radius_km || 0;
      let billableKm = clientDistanceKm;
      if (freeRadius > 0) {
        billableKm = Math.max(0, clientDistanceKm - freeRadius);
      }
      return baseFee + (billableKm * feeValue);
    }
    return 0;
  }, [bookingMode, clientDistanceKm, selectedPro, settings]);

  const serviceHomeExtra = bookingMode === 'home' ? (selectedService?.home_price_extra ?? 0) : 0;
  const total = (selectedService?.price ?? 0) + serviceHomeExtra + travelFee;
  const amountPaid = paymentScope === "full" ? total : paymentScope === "partial" ? total / 2 : 0;
  const amountDue = total - amountPaid;
  const proName = selectedPro === "any" ? "Qualquer profissional" : selectedPro?.name ?? "";

  const allowedPaymentScopes = useMemo((): { key: PaymentScope; label: string; desc: string }[] => {
    let allowLocal = true,
      allowDeposit = true,
      allowFull = true;

    if (settings?.payment_methods) {
      const pm = settings.payment_methods;
      allowLocal = pm.pay_local ?? true;
      allowDeposit = pm.partial_50 ?? true;
      allowFull = pm.full_100 ?? false;
    } else if (settings?.booking_payment_mode) {
      const pm = settings.booking_payment_mode as string;
      try {
        if (pm.startsWith("{")) {
          const parsed = JSON.parse(pm);
          allowLocal = parsed.local !== false;
          allowDeposit = parsed.deposit !== false;
          allowFull = parsed.full !== false;
        } else {
          allowLocal = pm === "local" || pm === "client_choice";
          allowDeposit = pm === "deposit" || pm === "client_choice";
          allowFull = pm === "full" || pm === "client_choice";
          if (!allowLocal && !allowDeposit && !allowFull) {
            allowLocal = true;
            allowDeposit = true;
            allowFull = true;
          }
        }
      } catch {
        allowLocal = true;
        allowDeposit = true;
        allowFull = true;
      }
    }

    const depositPct = settings?.deposit_percentage || 50;
    const isStripeActive = storeData?.isStripeEnabled === true;
    if (!isStripeActive) {
      allowDeposit = false;
      allowFull = false;
      allowLocal = true;
    }

    const all: { key: PaymentScope; label: string; desc: string }[] = [];
    if (allowDeposit)
      all.push({
        key: "partial",
        label: `Entrada ${depositPct}%`,
        desc: money(total * (depositPct / 100)),
      });
    if (allowFull) all.push({ key: "full", label: "Total agora", desc: money(total) });
    if (allowLocal) all.push({ key: "local", label: "No local", desc: "Pagar após atendimento" });
    if (all.length === 0) all.push({ key: "local", label: "No local", desc: "Pagar após atendimento" });
    return all;
  }, [
    settings?.payment_methods,
    settings?.booking_payment_mode,
    settings?.deposit_percentage,
    total,
    storeData?.isStripeEnabled,
  ]);

  useEffect(() => {
    if (step === 4 && allowedPaymentScopes.length > 0) {
      const isCurrentAllowed = allowedPaymentScopes.some((o) => o.key === paymentScope);
      if (!isCurrentAllowed) {
        setPaymentScope(allowedPaymentScopes[0].key);
      }
    }
  }, [step, allowedPaymentScopes, paymentScope]);

  const distanceKm = useMemo(
    () => (userPos ? haversineKm(userPos, storeCoords) : null),
    [userPos, storeCoords]
  );

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

  const availableProfessionals = useMemo(() => {
    let list = professionalsList.filter((p: any) => p.status === 'active' || !p.status);
    
    if (selectedService && storeData?.professionalServices) {
      const allowedProIds = storeData.professionalServices
        .filter((ps: any) => ps.service_id === selectedService.id)
        .map((ps: any) => ps.professional_id);
      
      list = list.filter((p: any) => allowedProIds.includes(p.id));
    }
    
    if (bookingMode === 'home') {
      const salonRadius = settings?.home_service_radius_km || 10;
      list = list.filter((p: any) => {
        if (!p.offers_home_service) return false;
        if (clientDistanceKm == null) return true;
        const effectiveRadius = p.max_home_distance_km && p.max_home_distance_km > 0 
          ? p.max_home_distance_km 
          : salonRadius;
        return clientDistanceKm <= effectiveRadius;
      });
    }
    
    return list;
  }, [professionalsList, selectedService, storeData?.professionalServices, bookingMode, clientDistanceKm, settings?.home_service_radius_km]);

  const availableSlots: Slot[] = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    return generateAvailableSlots(
      selectedDate,
      selectedService,
      selectedPro === "any" ? "any" : selectedPro?.id ?? "any",
      availableProfessionals,
      servicesList,
      businessHoursList,
      storeData?.professionalWorkingHours || [],
      storeData?.professionalBlockedTimes || [],
      storeData?.bookings || [],
      storeData?.professionalServices || [],
      [selectedService],
      bookingMode,
      clientDistanceKm,
      settings?.home_service_radius_km
    );
  }, [
    selectedDate,
    selectedService,
    selectedPro,
    availableProfessionals,
    servicesList,
    businessHoursList,
    storeData,
    bookingMode,
    clientDistanceKm,
    settings?.home_service_radius_km
  ]);

  const isAppleDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  }, []);

  const destinationTarget = useMemo(() => {
    if (settings?.latitude && settings?.longitude) {
      return `${settings.latitude},${settings.longitude}`;
    }
    if (settings?.map_link && settings.map_link.trim()) {
      const rawLink = settings.map_link.trim();
      const coordMatch =
        rawLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
        rawLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
        rawLink.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) return `${coordMatch[1]},${coordMatch[2]}`;
      const qMatch = rawLink.match(/[?&]q=([^&]+)/);
      if (qMatch) return qMatch[1];
      const placeMatch = rawLink.match(/\/place\/([^/@?]+)/);
      if (placeMatch) return placeMatch[1];
    }
    if (storeAddress && storeAddress.trim()) {
      return encodeURIComponent(storeAddress.trim());
    }
    return `${storeCoords.lat},${storeCoords.lng}`;
  }, [settings?.latitude, settings?.longitude, settings?.map_link, storeAddress, storeCoords]);

  const mapPreviewUrl = useMemo(() => {
    if (settings?.map_link && settings.map_link.includes("<iframe")) {
      const match = settings.map_link.match(/src="([^"]+)"/);
      if (match) return match[1];
    }
    if (
      settings?.map_link &&
      (settings.map_link.includes("output=embed") ||
        settings.map_link.includes("google.com/maps/embed"))
    ) {
      return settings.map_link;
    }
    return `https://maps.google.com/maps?q=${destinationTarget}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
  }, [settings?.map_link, destinationTarget]);

  const mapModalUrl = useMemo(() => {
    if (userPos) {
      return `https://maps.google.com/maps?saddr=${userPos.lat},${userPos.lng}&daddr=${destinationTarget}&t=&z=${mapZoom}&output=embed`;
    }
    if (settings?.map_link && settings.map_link.includes("<iframe")) {
      const match = settings.map_link.match(/src="([^"]+)"/);
      if (match) return match[1];
    }
    if (
      settings?.map_link &&
      (settings.map_link.includes("output=embed") ||
        settings.map_link.includes("google.com/maps/embed"))
    ) {
      return settings.map_link;
    }
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
    if (
      settings?.map_link &&
      settings.map_link.trim().startsWith("http") &&
      !settings.map_link.includes("<iframe")
    ) {
      return settings.map_link.trim();
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destinationTarget}`;
  }, [isAppleDevice, userPos, destinationTarget, settings?.map_link]);

  const whatsappUrl = useMemo(() => {
    if (!bookingCode || !selectedService || !selectedDate || !selectedTime) return "#";
    const lines = [
      `*NOVA RESERVA — ${storeName}*`,
      "",
      `*Código:* #${bookingCode}`,
      `*Cliente:* ${customerName}`,
      `*Serviço:* ${selectedService.name} (${selectedService.duration_minutes} min)`,
      `*Profissional:* ${proName}`,
      `*Data/Hora:* ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às ${selectedTime}`,
      "",
      `*Valor:* ${money(total)}`,
      storeAddress ? `*Local:* ${storeAddress}` : "",
      customerNotes ? `*Obs:* ${customerNotes}` : "",
    ].filter(Boolean);
    return `https://wa.me/${onlyDigits(storePhone)}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [
    bookingCode,
    selectedService,
    selectedDate,
    selectedTime,
    customerName,
    proName,
    total,
    storeName,
    storeAddress,
    storePhone,
    customerNotes,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBack = () => {
    setErrorMsg("");
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime) return;

    if (!customerName || !customerPhone) {
      setErrorMsg("Por favor, preencha seu nome e WhatsApp.");
      inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!phoneFormat.validate(customerPhone)) {
      setErrorMsg("Informe um WhatsApp válido com DDD.");
      inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setIsProcessing(true);
    setErrorMsg("");

    try {
      const cleanPhone = customerPhone.replace(/\D/g, "");
      let customerId = "";
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newC, error: cErr } = await supabase
          .from("customers")
          .insert([{ tenant_id: tenant.id, name: customerName, phone: cleanPhone }])
          .select("id")
          .single();
        if (cErr) throw cErr;
        customerId = newC.id;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = Math.random().toString(36).substring(2, 12);
      const pad = (n: number) => String(n).padStart(2, "0");
      const tzOffsetMin = -new Date().getTimezoneOffset();
      const tzSign = tzOffsetMin >= 0 ? "+" : "-";
      const tzAbs = Math.abs(tzOffsetMin);
      const tzStr = `${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;
      const scheduledAt = `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00${tzStr}`;
      let proId = selectedPro === "any" ? null : selectedPro?.id;
      if (selectedPro === "any") {
        const slot = availableSlots.find((s) => s.time === selectedTime);
        if (slot?.availableProIds?.length) {
          proId = slot.availableProIds[Math.floor(Math.random() * slot.availableProIds.length)];
        } else {
          proId = professionalsList[0]?.id || null;
        }
      }

      const { data: newBooking, error: bErr } = await supabase
        .from("bookings")
        .insert([
          {
            tenant_id: tenant.id,
            customer_id: customerId,
            professional_id: proId,
            service_id: selectedService.id,
            order_number: code,
            scheduled_at: scheduledAt,
            status: "confirmed",
            payment_mode:
              paymentScope === "full"
                ? "full"
                : paymentScope === "partial"
                  ? "deposit"
                  : "local",
            amount_paid:
              paymentScope === "local" || paymentMethod === "cash" ? 0 : amountPaid,
            amount_total: total,
            notes: customerNotes,
            access_code: accessCode,
            service_location: bookingMode,
            client_address: bookingMode === 'home' ? clientAddress : null,
            travel_fee: bookingMode === 'home' ? travelFee : 0,
          },
        ])
        .select("id")
        .single();
      if (bErr) throw bErr;

      if (paymentScope !== "local" && paymentMethod !== "cash") {
        const { data: checkoutData, error: cErr2 } = await supabase.functions.invoke(
          "create-booking-checkout",
          {
            body: { bookingId: newBooking.id, returnUrl: getTenantPortalUrl(slug ?? "") },
          }
        );
        if (!cErr2 && checkoutData?.url) {
          window.location.href = checkoutData.url;
          return;
        }
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
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: isDark ? theme.bg : "#F5F5F7" }}
      >
        <div className="relative flex items-center justify-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg"
            style={{
              background: `${accent}15`,
              borderColor: `${accent}30`,
              color: accent,
            }}
          >
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </div>
        <p
          className="mt-4 text-xs font-semibold tracking-wider uppercase"
          style={{ color: theme.textMuted }}
        >
          Carregando experiência…
        </p>
      </div>
    );
  }

  const isTenantInactive =
    !tenant ||
    Boolean(tenant.deleted_at) ||
    ["blocked", "suspended", "deleted", "canceled"].includes(tenant.status) ||
    (tenant.status !== "active" && tenant.status !== "trial");

  if (isTenantInactive) {
    return (
      <div
        className="min-h-screen flex flex-col p-6 items-center justify-center text-center max-w-md mx-auto w-full"
        style={{ background: canvasBg }}
      >
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
        >
          Estabelecimento Indisponível
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: theme.textMuted }}>
          Esta página de agendamento não está acessível no momento.
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
      <div
        className="min-h-screen selection:bg-amber-500/20 selection:text-amber-300 transition-colors duration-300"
        style={{
          background: canvasBg,
          color: theme.textPrimary,
          fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
        }}
      >
        {/* ── MAP MODAL ── */}
        <AnimatePresence>
          {showMapModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
              style={{ background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(16px)" }}
              onClick={() => setShowMapModal(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col border"
                style={{
                  background: cardBackground,
                  borderColor: cardBorderColor,
                }}
              >
                {/* Modal Header */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b"
                  style={{ borderColor: cardBorderColor }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{
                        background: `${accent}15`,
                        borderColor: `${accent}30`,
                        color: accent,
                      }}
                    >
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                      <h3
                        className="font-bold text-sm leading-none"
                        style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                      >
                        {storeName}
                      </h3>
                      <p
                        className="text-xs mt-1 truncate max-w-[240px] sm:max-w-md font-medium"
                        style={{ color: theme.textMuted }}
                      >
                        {storeAddress || "Localização do estabelecimento"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMapModal(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border transition-all hover:opacity-80 active:scale-95 cursor-pointer"
                    style={{ borderColor: cardBorderColor, color: theme.textMuted }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Map Display */}
                <div className="relative h-72 sm:h-84 w-full bg-neutral-950">
                  <iframe
                    title="Rota e Localização"
                    src={mapModalUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                    allowFullScreen
                  />

                  {geoStatus === "loading" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-md z-20 px-6 text-center"
                    >
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
                      <p className="text-xs font-semibold text-white">Traçando rota em tempo real...</p>
                    </motion.div>
                  )}

                  {/* Zoom Controls */}
                  <div className="absolute right-4 top-4 flex flex-col gap-1.5 z-10">
                    <button
                      onClick={() => setMapZoom((z) => Math.min(z + 1, 20))}
                      className="w-8 h-8 rounded-xl text-sm font-bold flex items-center justify-center border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                      style={{
                        background: cardBackground,
                        borderColor: cardBorderColor,
                        color: theme.textPrimary,
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => setMapZoom((z) => Math.max(z - 1, 10))}
                      className="w-8 h-8 rounded-xl text-sm font-bold flex items-center justify-center border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                      style={{
                        background: cardBackground,
                        borderColor: cardBorderColor,
                        color: theme.textPrimary,
                      }}
                    >
                      −
                    </button>
                  </div>
                </div>

                {/* Business Hours */}
                {businessHoursList.length > 0 && (
                  <div
                    className="px-6 py-4 border-t max-h-48 overflow-y-auto"
                    style={{
                      borderColor: cardBorderColor,
                      background: isDark ? "rgba(0,0,0,0.2)" : "#F8FAFC",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: accent }} />
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textPrimary }}>
                          Horários de Funcionamento
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {businessHoursList.map((h: any) => {
                        const isToday = h.weekday === todayWeekday;
                        return (
                          <div
                            key={h.weekday}
                            className="flex flex-col p-2.5 rounded-xl border transition-all"
                            style={{
                              borderColor: isToday ? `${accent}60` : cardBorderColor,
                              background: isToday ? `${accent}12` : "transparent",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold" style={{ color: isToday ? accent : theme.textPrimary }}>
                                {WEEKDAYS_FULL[h.weekday]}
                              </span>
                              {isToday && (
                                <span
                                  className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded"
                                  style={{ background: accent, color: theme.btnPrimaryText }}
                                >
                                  Hoje
                                </span>
                              )}
                            </div>
                            <span
                              className="text-[11px] font-medium mt-1"
                              style={{ color: h.is_open ? theme.textPrimary : theme.textMuted }}
                            >
                              {h.is_open ? `${h.open_time.substring(0, 5)} – ${h.close_time.substring(0, 5)}` : "Fechado"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div
                  className="px-6 py-4 flex items-center justify-between border-t"
                  style={{ borderColor: cardBorderColor }}
                >
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md"
                    style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Como Chegar (Abrir no GPS)
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MOBILE INFO SHEET ── */}
        <AnimatePresence>
          {showInfoSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end lg:hidden"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowInfoSheet(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-t-3xl overflow-hidden shadow-2xl"
                style={{
                  background: cardBackground,
                  border: `1px solid ${cardBorderColor}`,
                  maxHeight: "85vh",
                  overflowY: "auto",
                }}
              >
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: isDark ? "rgba(255,255,255,0.2)" : "#CBD5E1" }}
                  />
                </div>

                <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: cardBorderColor }}>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}>
                      {storeName}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                      {storeAddress}
                    </p>
                  </div>
                  <button onClick={() => setShowInfoSheet(false)} className="p-2 rounded-full" style={{ color: theme.textMuted }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {hasLocationInfo && (
                    <div className="rounded-2xl overflow-hidden border relative" style={{ borderColor: cardBorderColor, height: 180 }}>
                      <iframe title="Mapa" src={mapPreviewUrl} className="w-full h-full border-0" loading="lazy" allowFullScreen />
                    </div>
                  )}

                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs font-bold shadow-sm"
                    style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}
                  >
                    <Navigation className="w-3.5 h-3.5" /> Como chegar (Abrir no GPS)
                  </a>

                  {businessHoursList.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: theme.textMuted }}>
                        Horários
                      </p>
                      <div className="space-y-1.5">
                        {businessHoursList.map((h: any) => {
                          const isToday = h.weekday === todayWeekday;
                          return (
                            <div
                              key={h.weekday}
                              className="flex items-center justify-between py-1 text-xs"
                              style={{
                                color: isToday ? theme.textPrimary : theme.textMuted,
                                fontWeight: isToday ? 700 : 400,
                              }}
                            >
                              <span className="flex items-center gap-2">
                                {WEEKDAYS_FULL[h.weekday]}
                                {isToday && (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: `${accent}20`, color: accent }}
                                  >
                                    Hoje
                                  </span>
                                )}
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

                  <div className="flex flex-col gap-2.5 pt-2">
                    <a
                      href={`/${slug}/portal`}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs font-bold shadow-md"
                      style={{ background: theme.btnPrimaryBg || accent, color: theme.btnPrimaryText }}
                    >
                      <Calendar className="w-4 h-4" /> Meus agendamentos
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CORE LAYOUT: Split Sidebar & Wizard ── */}
        <div className="flex flex-col lg:flex-row min-h-screen w-full max-w-[100vw]">
          {/* ── LEFT SIDEBAR ── */}
          <aside
            className="relative lg:w-[410px] xl:w-[440px] lg:h-screen lg:sticky lg:top-0 lg:self-start border-b lg:border-b-0 lg:border-r overflow-y-auto scrollbar-none flex flex-col shrink-0"
            style={{
              background: sidebarBackground,
              borderColor: cardBorderColor,
              boxShadow: isDark ? "none" : "2px 0 12px rgba(0,0,0,0.03)",
            }}
          >
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
                    background: `linear-gradient(135deg, ${accent}25 0%, ${sidebarBackground} 100%)`,
                  }}
                />
              )}
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
                        background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                        color: theme.btnPrimaryText,
                      }}
                    >
                      {storeName.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Establishment Name */}
              <h1
                className="text-xl sm:text-2xl font-black tracking-tight"
                style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
              >
                {storeName}
              </h1>

              {/* Rating Pill */}
              <div
                className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border text-xs font-semibold"
                style={{
                  background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                  borderColor: cardBorderColor,
                  color: isDark ? "#FFFFFF" : "#334155",
                }}
              >
                <span className="flex items-center gap-1 font-bold" style={{ color: accent }}>
                  <Star className="w-3.5 h-3.5 fill-current" /> 5.0
                </span>
                <span className="opacity-40">•</span>
                <span className="capitalize" style={{ color: theme.textPrimary }}>
                  {tenant?.business_type === "barbearia"
                    ? "Barbearia"
                    : tenant?.business_type === "esmalteria"
                      ? "Esmalteria"
                      : "Salão de Beleza"}
                </span>
              </div>

              {/* Bio / Description */}
              <p
                className="mt-3.5 text-xs sm:text-sm leading-relaxed max-w-[320px] font-medium"
                style={{ color: theme.textSecondary }}
              >
                {settings?.slogan ||
                  settings?.custom_palette?.slogan ||
                  settings?.short_description ||
                  settings?.description ||
                  "Agende seu horário com os melhores profissionais."}
              </p>

              {/* Social Pill Buttons */}
              <div className="flex items-center justify-center gap-2.5 mt-5 w-full max-w-[320px]">
                {storeInsta && (
                  <motion.a
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    href={`https://instagram.com/${storeInsta}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all cursor-pointer font-bold text-xs shadow-sm"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
                      borderColor: cardBorderColor,
                      color: theme.textPrimary,
                    }}
                  >
                    <InstagramIcon style={{ color: accent }} />
                    <span>Instagram</span>
                  </motion.a>
                )}
                {storePhone && (
                  <motion.a
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    href={`https://wa.me/${onlyDigits(storePhone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all cursor-pointer font-bold text-xs shadow-sm"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
                      borderColor: cardBorderColor,
                      color: theme.textPrimary,
                    }}
                  >
                    <WhatsAppIcon style={{ color: accent }} />
                    <span>WhatsApp</span>
                  </motion.a>
                )}
              </div>

              {/* Info Group */}
              <div
                className="w-full mt-6 flex flex-col rounded-2xl overflow-hidden border shadow-sm text-left"
                style={{
                  background: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
                  borderColor: cardBorderColor,
                }}
              >
                {hasLocationInfo && (
                  <button
                    onClick={() => {
                      setShowMapModal(true);
                      if (geoStatus === "idle") requestLocation();
                    }}
                    className="flex items-center justify-between p-3.5 transition-colors border-b group cursor-pointer w-full text-left"
                    style={{ borderColor: cardBorderColor }}
                  >
                    <div className="flex items-center gap-3 min-w-0 text-left">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${accent}15`, color: accent }}
                      >
                        <MapPin className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div className="min-w-0 pr-2 text-left">
                        <p className="text-xs font-bold leading-none text-left" style={{ color: theme.textPrimary }}>
                          Local & Horários
                        </p>
                        <p className="text-[11px] truncate mt-1 text-left" style={{ color: theme.textMuted }}>
                          {storeAddress || "Ver no mapa"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                      style={{ color: theme.textPrimary }}
                    />
                  </button>
                )}

                <a
                  href={`/${slug}/portal`}
                  className="flex items-center justify-between p-3.5 transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${accent}15`, color: isDark ? accent : "#000000" }}
                    >
                      <Calendar className="w-4 h-4" style={{ color: accent }} />
                    </div>
                    <div className="min-w-0 pr-2 text-left">
                      <p className="text-xs font-bold leading-none text-left" style={{ color: theme.textPrimary }}>
                        Meus Agendamentos
                      </p>
                      <p className="text-[11px] truncate mt-1 text-left" style={{ color: theme.textMuted }}>
                        Acessar portal do cliente
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    style={{ color: theme.textPrimary }}
                  />
                </a>
              </div>
            </div>
          </aside>

          {/* ── RIGHT MAIN WIZARD ── */}
          <main
            className="flex-1 flex flex-col min-h-0 relative"
            style={{
              background: canvasBg,
            }}
          >
            {/* Step Progress Top Bar */}
            {step < 5 && (
              <div
                className="border-b sticky top-0 z-20 backdrop-blur-xl transition-colors"
                style={{
                  borderColor: cardBorderColor,
                  background: isDark ? `${theme.bg}ee` : "rgba(255, 255, 255, 0.95)",
                  boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                <StepIndicator step={step} accent={accent} theme={theme} isDark={isDark} />
              </div>
            )}

            {/* Back Bar (Step 2, 3, 4) */}
            {step > 1 && step < 5 && (
              <div
                className="flex items-center gap-3 px-5 lg:px-10 py-3.5 border-b"
                style={{ borderColor: cardBorderColor, background: isDark ? "transparent" : "#FFFFFF" }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBack}
                  className="w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    borderColor: cardBorderColor,
                    background: cardBackground,
                    color: theme.textPrimary,
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                    {["", "Serviço", "Profissional", "Data & Horário", "Confirmar"][step]}
                  </p>
                  {step === 2 && selectedService && (
                    <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                      {selectedService.name} · {money(selectedService.price)}
                    </p>
                  )}
                  {step === 3 && selectedPro && (
                    <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                      {selectedService?.name} · {proName}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error Banner */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-5 lg:mx-10 mt-4 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#f87171",
                  }}
                >
                  <span>{errorMsg}</span>
                  <button onClick={() => setErrorMsg("")} className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step Views */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {/* ───────────────── STEP 1: SERVICES ───────────────── */}
                {step === 1 && (
                  <motion.div
                    key="s1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 lg:px-10 py-6 sm:py-8 pb-32 lg:pb-12 max-w-5xl mx-auto w-full"
                  >
                    <div className="mb-6">
                      <h2
                        className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                        style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                      >
                        O que você deseja fazer?
                      </h2>
                      <p className="text-xs sm:text-sm mt-1 font-medium" style={{ color: theme.textSecondary }}>
                        Selecione o serviço para iniciar seu agendamento.
                      </p>
                    </div>

                    {/* Modo de Atendimento (Se o salão oferecer domicílio) */}
                    {settings?.offers_home_service && (
                      <div className="mb-6">
                        <div className="flex p-1 rounded-xl w-full max-w-sm mb-4" style={{ background: theme.inputBg, border: `1px solid ${theme.borderActive}30` }}>
                          <button
                            onClick={() => setBookingMode('instore')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                              bookingMode === 'instore' ? 'shadow-md' : 'opacity-70'
                            }`}
                            style={bookingMode === 'instore' ? { background: theme.accent, color: theme.btnPrimaryText } : { color: theme.textPrimary }}
                          >
                            <Store className="w-4 h-4" /> No Salão
                          </button>
                          <button
                            onClick={() => setBookingMode('home')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                              bookingMode === 'home' ? 'shadow-md' : 'opacity-70'
                            }`}
                            style={bookingMode === 'home' ? { background: theme.accent, color: theme.btnPrimaryText } : { color: theme.textPrimary }}
                          >
                            <Home className="w-4 h-4" /> A Domicílio
                          </button>
                        </div>
                        
                        <AnimatePresence>
                          {bookingMode === 'home' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mb-2"
                            >
                              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                                Endereço de Atendimento *
                              </label>
                              <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} />
                                <input
                                  type="text"
                                  value={clientAddress}
                                  onChange={(e) => setClientAddress(e.target.value)}
                                  placeholder="Rua, Número, Bairro, Cidade - Estado"
                                  className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-shadow"
                                  style={{
                                    borderColor: theme.inputFocusBorder,
                                    background: theme.bgInput,
                                    color: theme.textPrimary,
                                  }}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {servicesList.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-3xl border"
                        style={{
                          borderColor: cardBorderColor,
                          background: cardBackground,
                          boxShadow: cardShadowStyle,
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5"
                          style={{ background: `${accent}15`, color: accent }}
                        >
                          <Scissors className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>
                          Nenhum serviço disponível
                        </h3>
                        <p className="text-xs mt-1 max-w-xs font-medium" style={{ color: theme.textSecondary }}>
                          O estabelecimento ainda não cadastrou serviços no catálogo.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {servicesList.map((s, i) => {
                          const hasDiscount = s.original_price && s.original_price > s.price;
                          const discountPct = hasDiscount
                            ? Math.round(((s.original_price - s.price) / s.original_price) * 100)
                            : 0;

                          return (
                            <motion.button
                              key={s.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              whileHover={{ y: -3 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={async () => {
                                if (bookingMode === 'home' && !clientAddress.trim()) {
                                  setErrorMsg("Por favor, preencha o endereço de atendimento.");
                                  return;
                                }
                                if (bookingMode === 'home') {
                                  const dist = await geocodeAndCheckDistance(clientAddress);
                                  if (dist === null) return; // Geocoding failed or distance exceeded
                                }
                                setErrorMsg("");
                                setSelectedService(s);
                                setStep(2);
                              }}
                              className="group relative text-left rounded-3xl overflow-hidden border transition-all duration-200 flex flex-col cursor-pointer"
                              style={{
                                borderColor: cardBorderColor,
                                background: cardBackground,
                                boxShadow: cardShadowStyle,
                              }}
                            >
                              {/* Service Photo */}
                              {s.photo_url ? (
                                <div className="relative h-44 sm:h-48 overflow-hidden bg-neutral-900">
                                  <img
                                    src={s.photo_url}
                                    alt={s.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                  />
                                  <div
                                    className="absolute inset-0"
                                    style={{
                                      background:
                                        "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)",
                                    }}
                                  />
                                  {hasDiscount && (
                                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-red-500 shadow-sm">
                                      -{discountPct}%
                                    </span>
                                  )}
                                  {s.category && (
                                    <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-black/60 backdrop-blur-md">
                                      {s.category}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="h-20 flex items-center justify-between px-5 border-b"
                                  style={{
                                    borderColor: cardBorderColor,
                                    background: `${accent}0a`,
                                  }}
                                >
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${accent}15`, color: accent }}
                                  >
                                    <Scissors className="w-5 h-5" />
                                  </div>
                                  {s.category && (
                                    <span
                                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: `${accent}15`, color: accent }}
                                    >
                                      {s.category}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Service Details */}
                              <div className="p-4 sm:p-5 flex flex-col flex-1">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <h3
                                    className="text-base font-bold leading-snug"
                                    style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                                  >
                                    {s.name}
                                  </h3>
                                </div>

                                {s.description && (
                                  <p
                                    className="text-xs leading-relaxed line-clamp-2 mb-3"
                                    style={{ color: theme.textSecondary }}
                                  >
                                    {s.description}
                                  </p>
                                )}

                                <div
                                  className="flex items-center justify-between pt-3 mt-auto border-t"
                                  style={{ borderColor: cardBorderColor }}
                                >
                                  <span
                                    className="flex items-center gap-1.5 text-xs font-semibold"
                                    style={{ color: theme.textMuted }}
                                  >
                                    <Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min
                                  </span>
                                  <div className="text-right">
                                    {hasDiscount && (
                                      <span
                                        className="text-[10px] line-through block"
                                        style={{ color: theme.textMuted }}
                                      >
                                        {money(s.original_price)}
                                      </span>
                                    )}
                                    <span
                                      className="text-base font-black"
                                      style={{ color: accent, fontFamily: theme.fontSerif }}
                                    >
                                      {money(s.price)}
                                    </span>
                                  </div>
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
                  <motion.div
                    key="s2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 lg:px-10 py-6 sm:py-8 pb-32 lg:pb-12 max-w-4xl mx-auto w-full"
                  >
                    <div className="mb-6">
                      <h2
                        className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                        style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                      >
                        Com quem prefere ser atendido?
                      </h2>
                      <p className="text-xs sm:text-sm mt-1 font-medium" style={{ color: theme.textSecondary }}>
                        Escolha um profissional ou deixe o sistema encontrar o primeiro horário livre.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
                      {/* Anyone Option */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedPro("any");
                          setStep(3);
                        }}
                        className="group relative rounded-3xl border-2 p-5 sm:p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer"
                        style={{
                          borderColor: `${accent}60`,
                          background: isDark ? `${accent}0c` : `${accent}08`,
                          boxShadow: cardShadowStyle,
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md"
                          style={{ background: `${accent}20`, color: accent }}
                        >
                          <Zap className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-xs sm:text-sm" style={{ color: theme.textPrimary }}>
                          Qualquer profissional
                        </p>
                        <p className="text-[11px] mt-0.5 font-medium" style={{ color: theme.textSecondary }}>
                          Horário mais rápido
                        </p>
                        <span
                          className="mt-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${accent}20`, color: accent }}
                        >
                          Recomendado
                        </span>
                      </motion.button>

                      {/* Professional Cards */}
                      {availableProfessionals.map((p, i) => (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedPro(p);
                            setStep(3);
                          }}
                          className="group relative rounded-3xl border p-5 sm:p-6 flex flex-col items-center text-center transition-all cursor-pointer"
                          style={{
                            borderColor: cardBorderColor,
                            background: cardBackground,
                            boxShadow: cardShadowStyle,
                          }}
                        >
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              alt={p.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover mb-3 shadow-md"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 border"
                              style={{
                                borderColor: cardBorderColor,
                                background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                              }}
                            >
                              <User className="w-6 h-6" style={{ color: theme.textMuted }} />
                            </div>
                          )}
                          <p
                            className="font-bold text-xs sm:text-sm"
                            style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                          >
                            {p.name}
                          </p>
                          <p className="text-[11px] mt-0.5 truncate w-full font-medium" style={{ color: theme.textSecondary }}>
                            {p.role_title || "Profissional"}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ───────────────── STEP 3: DATE & TIME ───────────────── */}
                {step === 3 && (
                  <motion.div
                    key="s3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 lg:px-10 py-6 sm:py-8 pb-32 lg:pb-12 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8"
                  >
                    <div>
                      <h2
                        className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                        style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                      >
                        Quando você prefere?
                      </h2>
                      <p className="text-xs sm:text-sm mt-1 font-medium" style={{ color: theme.textSecondary }}>
                        Selecione o melhor dia e horário na agenda.
                      </p>
                    </div>

                    {/* Horizontal Date Carousel */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.textSecondary }}>
                          Selecione o Dia
                        </p>
                        {!hasScrolledDates && (
                          <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: theme.textMuted }}>
                            <span>Deslize para ver mais</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div
                        className="flex gap-2.5 sm:gap-3 overflow-x-auto pt-1 pb-3 scrollbar-none"
                        onScroll={() => setHasScrolledDates(true)}
                      >
                        {availableDays.map(({ date: d, isOpen }) => {
                          const isSel = selectedDate?.getTime() === d.getTime();
                          const isToday = d.getTime() === startOfDay(new Date()).getTime();

                          return (
                            <motion.button
                              key={d.getTime()}
                              disabled={!isOpen}
                              whileHover={isOpen ? { scale: 1.04 } : undefined}
                              whileTap={isOpen ? { scale: 0.96 } : undefined}
                              onClick={() => {
                                if (!isOpen) return;
                                setHasScrolledDates(true);
                                setSelectedDate(d);
                                setSelectedTime(null);
                              }}
                              className="shrink-0 w-[68px] sm:w-[76px] py-3.5 rounded-2xl text-center border transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              style={{
                                borderColor: isSel ? accent : cardBorderColor,
                                background: isSel
                                  ? theme.btnPrimaryBg || accent
                                  : cardBackground,
                                color: isSel ? theme.btnPrimaryText : theme.textPrimary,
                                boxShadow: isSel
                                  ? `0 4px 16px ${accent}40`
                                  : cardShadowStyle,
                              }}
                            >
                              <p
                                className="text-[10px] uppercase font-bold tracking-wider mb-1"
                                style={{
                                  opacity: isSel ? 0.9 : 0.7,
                                  color: isSel ? theme.btnPrimaryText : theme.textMuted,
                                }}
                              >
                                {isToday ? "Hoje" : WEEKDAYS[d.getDay()]}
                              </p>
                              <p
                                className="text-xl sm:text-2xl font-black leading-none"
                                style={{
                                  color: isSel ? theme.btnPrimaryText : theme.textPrimary,
                                  fontFamily: theme.fontSerif,
                                }}
                              >
                                {format(d, "dd")}
                              </p>
                              <p
                                className="text-[10px] uppercase font-semibold mt-1"
                                style={{
                                  opacity: isSel ? 0.9 : 0.7,
                                  color: isSel ? theme.btnPrimaryText : theme.textMuted,
                                }}
                              >
                                {format(d, "MMM", { locale: ptBR })}
                              </p>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slot Grid */}
                    <AnimatePresence>
                      {selectedDate && (
                        <motion.div
                          key={`slots-${selectedDate?.toDateString()}-${selectedService?.id}`}
                          ref={timeSlotsRef}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="pt-2"
                        >
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: theme.textSecondary }}>
                            Horários em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                          </p>

                          <SlotGrid
                            allSlots={availableSlots}
                            selectedTime={selectedTime || ""}
                            onSelect={setSelectedTime}
                            accent={accent}
                            theme={theme}
                            isDark={isDark}
                          />

                          {/* Reveal Continue Button */}
                          <AnimatePresence>
                            {selectedDate && selectedTime && (
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8"
                                ref={confirmBtnRef}
                              >
                                <motion.button
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => setStep(4)}
                                  className="w-full py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-transform cursor-pointer shadow-lg"
                                  style={{
                                    background: theme.btnPrimaryBg || accent,
                                    color: theme.btnPrimaryText,
                                    boxShadow: `0 8px 24px ${accent}35`,
                                  }}
                                >
                                  <span>Continuar para confirmação</span>
                                  <ArrowRight className="w-4 h-4" />
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* ───────────────── STEP 4: CONFIRMATION & PAYMENT ───────────────── */}
                {step === 4 && (
                  <motion.div
                    key="s4"
                    ref={step4Ref}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 lg:px-10 py-6 sm:py-8 max-w-5xl mx-auto w-full pb-32 lg:pb-12"
                  >
                    {/* Booking Card */}
                    <div
                      className="rounded-3xl p-5 sm:p-6 mb-6 border"
                      style={{
                        background: cardBackground,
                        borderColor: cardBorderColor,
                        boxShadow: cardShadowStyle,
                      }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>
                        Resumo do seu agendamento
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { icon: Scissors, label: "Serviço", value: selectedService?.name },
                          { icon: User, label: "Profissional", value: proName },
                          {
                            icon: Calendar,
                            label: "Data",
                            value: selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "",
                          },
                          { icon: Clock, label: "Horário", value: selectedTime || "" },
                          ...(bookingMode === 'home' ? [
                            { icon: Home, label: "Atendimento", value: "A Domicílio" },
                            { icon: MapPin, label: "Endereço", value: clientAddress || "Não informado" }
                          ] : [])
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-2.5">
                            <div
                              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${accent}15`, color: accent }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>
                                {label}
                              </p>
                              <p className="text-xs sm:text-sm font-bold truncate mt-0.5" style={{ color: theme.textPrimary }}>
                                {value}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Split Form & Sticky Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-8 items-start">
                      {/* Left: Inputs & Payment */}
                      <div className="space-y-6">
                        {/* Contact Inputs */}
                        <div
                          ref={inputsRef}
                          className="p-5 sm:p-6 rounded-3xl border"
                          style={{
                            background: cardBackground,
                            borderColor: cardBorderColor,
                            boxShadow: cardShadowStyle,
                          }}
                        >
                          <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                            <User className="w-4 h-4" style={{ color: accent }} /> Seus Dados
                          </h3>
                          <div className="space-y-3.5">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
                                WhatsApp com DDD *
                              </label>
                              <input
                                type="tel"
                                placeholder={phoneFormat.placeholder}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(phoneFormat.format(e.target.value))}
                                maxLength={phoneFormat.maxLength}
                                className="w-full rounded-xl border px-3.5 py-3 text-sm font-medium focus:outline-none transition-all"
                                style={{
                                  background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                  borderColor: cardBorderColor,
                                  color: theme.textPrimary,
                                }}
                                onFocus={(e) => (e.target.style.borderColor = accent)}
                                onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
                                Nome Completo *
                              </label>
                              <input
                                type="text"
                                placeholder="Seu nome"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full rounded-xl border px-3.5 py-3 text-sm font-medium focus:outline-none transition-all"
                                style={{
                                  background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                  borderColor: cardBorderColor,
                                  color: theme.textPrimary,
                                }}
                                onFocus={(e) => (e.target.style.borderColor = accent)}
                                onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
                                Observações (opcional)
                              </label>
                              <textarea
                                placeholder="Ex: Preferência de corte, foto de referência..."
                                value={customerNotes}
                                onChange={(e) => setCustomerNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-xl border px-3.5 py-3 text-sm focus:outline-none resize-none transition-all"
                                style={{
                                  background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                  borderColor: cardBorderColor,
                                  color: theme.textPrimary,
                                }}
                                onFocus={(e) => (e.target.style.borderColor = accent)}
                                onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payment Scope & Method */}
                        <div
                          className="p-5 sm:p-6 rounded-3xl border"
                          style={{
                            background: cardBackground,
                            borderColor: cardBorderColor,
                            boxShadow: cardShadowStyle,
                          }}
                        >
                          <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                            <CreditCard className="w-4 h-4" style={{ color: accent }} /> Condição de Pagamento
                          </h3>

                          {/* Scope Pills */}
                          <div
                            className="grid gap-2 mb-5"
                            style={{
                              gridTemplateColumns: `repeat(${allowedPaymentScopes.length}, 1fr)`,
                            }}
                          >
                            {allowedPaymentScopes.map(({ key, label, desc }) => (
                              <button
                                key={key}
                                onClick={() => setPaymentScope(key)}
                                className="relative rounded-2xl p-3 text-center border-2 transition-all cursor-pointer"
                                style={{
                                  borderColor: paymentScope === key ? accent : cardBorderColor,
                                  background: paymentScope === key ? `${accent}12` : "transparent",
                                }}
                              >
                                {paymentScope === key && (
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 absolute top-2 right-2"
                                    style={{ color: accent }}
                                  />
                                )}
                                <p
                                  className="text-xs font-bold"
                                  style={{
                                    color: paymentScope === key ? accent : theme.textPrimary,
                                  }}
                                >
                                  {label}
                                </p>
                                <p className="text-[11px] mt-0.5 font-medium" style={{ color: theme.textSecondary }}>
                                  {desc}
                                </p>
                              </button>
                            ))}
                          </div>

                          {/* Online Methods if deposit/full */}
                          {paymentScope !== "local" && (
                            <>
                              <div
                                className="flex items-center gap-1 border rounded-xl p-1 mb-4"
                                style={{ borderColor: cardBorderColor }}
                              >
                                {(
                                  [
                                    { key: "pix", label: "PIX Instantâneo", icon: QrCode },
                                    { key: "card", label: "Cartão de Crédito", icon: CreditCard },
                                  ] as { key: PaymentMethod; label: string; icon: any }[]
                                ).map(({ key, label, icon: Icon }) => (
                                  <button
                                    key={key}
                                    onClick={() => setPaymentMethod(key)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    style={{
                                      background: paymentMethod === key ? theme.btnPrimaryBg || accent : "transparent",
                                      color: paymentMethod === key ? theme.btnPrimaryText : theme.textSecondary,
                                    }}
                                  >
                                    <Icon className="w-3.5 h-3.5" /> {label}
                                  </button>
                                ))}
                              </div>

                              {paymentMethod === "pix" && (
                                <div
                                  className="rounded-2xl border p-5 text-center space-y-3"
                                  style={{
                                    borderColor: cardBorderColor,
                                    background: isDark ? "rgba(0,0,0,0.2)" : "#F8FAFC",
                                  }}
                                >
                                  <div className="mx-auto w-32 h-32 bg-white rounded-2xl flex items-center justify-center p-2 shadow-md">
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=pix-navalha-${slug}-${amountPaid}`}
                                      alt="QR PIX"
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      readOnly
                                      value={`pix.navalha.${slug}.${amountPaid}`}
                                      className="flex-1 rounded-xl px-3 py-2 text-[11px] font-mono border truncate"
                                      style={{
                                        background: isDark ? "#0A0A0C" : "#FFFFFF",
                                        borderColor: cardBorderColor,
                                        color: theme.textSecondary,
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(`pix.navalha.${slug}.${amountPaid}`);
                                        setPixCopied(true);
                                        setTimeout(() => setPixCopied(false), 2500);
                                      }}
                                      className="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                                      style={{
                                        borderColor: pixCopied ? "#10b981" : cardBorderColor,
                                        color: pixCopied ? "#10b981" : theme.textPrimary,
                                      }}
                                    >
                                      {pixCopied ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" /> Copiado
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" /> Copiar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
                                    Pague {money(amountPaid)} via PIX e confirme o agendamento abaixo.
                                  </p>
                                </div>
                              )}

                              {paymentMethod === "card" && (
                                <div className="space-y-3">
                                  <button
                                    onClick={() => {
                                      setCardNumber("4242 4242 4242 4242");
                                      setCardExp("12/30");
                                      setCardCvc("123");
                                    }}
                                    className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                    style={{ color: accent }}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Preencher cartão de teste Stripe
                                  </button>
                                  <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>
                                      Número do Cartão
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="4242 4242 4242 4242"
                                      value={cardNumber}
                                      onChange={(e) => handleCardNumberChange(e.target.value)}
                                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono focus:outline-none transition-all"
                                      style={{
                                        background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                        borderColor: cardBorderColor,
                                        color: theme.textPrimary,
                                      }}
                                      onFocus={(e) => (e.target.style.borderColor = accent)}
                                      onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>
                                        Validade
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="MM/AA"
                                        value={cardExp}
                                        onChange={(e) => handleCardExpChange(e.target.value)}
                                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono text-center focus:outline-none transition-all"
                                        style={{
                                          background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                          borderColor: cardBorderColor,
                                          color: theme.textPrimary,
                                        }}
                                        onFocus={(e) => (e.target.style.borderColor = accent)}
                                        onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>
                                        CVC
                                      </label>
                                      <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="123"
                                        value={cardCvc}
                                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono text-center focus:outline-none transition-all"
                                        style={{
                                          background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                                          borderColor: cardBorderColor,
                                          color: theme.textPrimary,
                                        }}
                                        onFocus={(e) => (e.target.style.borderColor = accent)}
                                        onBlur={(e) => (e.target.style.borderColor = cardBorderColor)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Sticky Summary Box */}
                      <div className="hidden lg:block">
                        <div
                          className="sticky top-24 rounded-3xl border p-6 space-y-4"
                          style={{
                            background: cardBackground,
                            borderColor: cardBorderColor,
                            boxShadow: cardShadowStyle,
                          }}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.textSecondary }}>
                            Total a Pagar
                          </p>

                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between" style={{ color: theme.textSecondary }}>
                              <span>Valor do Serviço</span>
                              <span className="font-semibold" style={{ color: theme.textPrimary }}>{money(total)}</span>
                            </div>
                            <div
                              className="flex justify-between font-extrabold text-base border-t pt-3"
                              style={{ borderColor: cardBorderColor }}
                            >
                              <span style={{ color: theme.textPrimary }}>Pagar Agora</span>
                              <span style={{ color: accent, fontFamily: theme.fontSerif }}>{money(amountPaid)}</span>
                            </div>
                            {paymentScope === "partial" && (
                              <div className="flex justify-between text-[11px]" style={{ color: theme.textSecondary }}>
                                <span>Restante no salão</span>
                                <span className="font-semibold">{money(amountDue)}</span>
                              </div>
                            )}
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-60"
                            style={{
                              background: theme.btnPrimaryBg || accent,
                              color: theme.btnPrimaryText,
                              boxShadow: `0 8px 24px ${accent}35`,
                            }}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Processando…
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" /> Confirmar Agendamento
                              </>
                            )}
                          </motion.button>

                          <p className="text-[10px] text-center flex items-center justify-center gap-1.5" style={{ color: theme.textMuted }}>
                            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                            <span>Reserva 100% segura</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ───────────────── STEP 5: SUCCESS ───────────────── */}
                {step === 5 && bookingCode && (
                  <motion.div
                    key="s5"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 lg:px-10 py-10 max-w-lg mx-auto w-full text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
                      className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-5 shadow-xl"
                      style={{
                        background: `${accent}20`,
                        border: `2px solid ${accent}`,
                        color: accent,
                      }}
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>

                    <h2
                      className="text-2xl sm:text-3xl font-black mb-2"
                      style={{ color: theme.textPrimary, fontFamily: theme.fontSerif }}
                    >
                      Reserva Confirmada!
                    </h2>
                    <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textSecondary }}>
                      Seu horário está garantido. Apresente o código abaixo se necessário.
                    </p>

                    {/* Receipt Card */}
                    <div
                      className="mt-6 rounded-3xl border overflow-hidden"
                      style={{
                        borderColor: cardBorderColor,
                        background: cardBackground,
                        boxShadow: cardShadowStyle,
                      }}
                    >
                      <div
                        className="px-6 py-4 border-b flex items-center justify-between"
                        style={{
                          borderColor: cardBorderColor,
                          background: `${accent}0a`,
                        }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                          Código da Reserva
                        </p>
                        <p className="text-xl font-black font-mono" style={{ color: accent }}>
                          #{bookingCode}
                        </p>
                      </div>
                      <div className="px-6 py-4 space-y-2.5 text-left text-xs">
                        {[
                          { label: "Serviço", value: selectedService?.name },
                          { label: "Profissional", value: proName },
                          {
                            label: "Data",
                            value: selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "",
                          },
                          { label: "Horário", value: selectedTime },
                          { label: "Total", value: money(total) },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between">
                            <span style={{ color: theme.textSecondary }}>{label}</span>
                            <span className="font-semibold" style={{ color: theme.textPrimary }}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 space-y-2.5">
                      <motion.a
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer"
                        style={{ background: "#25D366", color: "#FFFFFF" }}
                      >
                        <WhatsAppIcon />
                        <span>Enviar Reserva no WhatsApp</span>
                      </motion.a>

                      <a
                        href={`/${slug}/portal`}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-xs border transition-all hover:opacity-80 cursor-pointer"
                        style={{ borderColor: cardBorderColor, color: theme.textPrimary, background: cardBackground }}
                      >
                        <Calendar className="w-4 h-4" style={{ color: accent }} />
                        <span>Ver Meus Agendamentos</span>
                      </a>

                      <button
                        onClick={resetAll}
                        className="text-xs underline block mx-auto pt-2 cursor-pointer font-medium"
                        style={{ color: theme.textSecondary }}
                      >
                        Fazer outro agendamento
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── MOBILE FIXED BOTTOM BAR (Step 4) ── */}
            {step === 4 && (
              <div
                className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t px-5 py-3.5 shadow-2xl backdrop-blur-xl"
                style={{
                  background: isDark ? `${theme.sidebarBg}f0` : "rgba(255,255,255,0.95)",
                  borderColor: cardBorderColor,
                }}
              >
                <div className="flex items-center gap-4 max-w-xl mx-auto">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>
                      Pagar Agora
                    </p>
                    <p className="text-lg font-black leading-tight" style={{ color: accent }}>
                      {money(amountPaid)}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    className="flex-1 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60"
                    style={{
                      background: theme.btnPrimaryBg || accent,
                      color: theme.btnPrimaryText,
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Confirmar
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            )}


          </main>
        </div>
      </div>
    </>
  );
}
