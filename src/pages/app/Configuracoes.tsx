import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { useTranslation } from 'react-i18next';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { usePhoneFormat } from '../../hooks/usePhoneFormat';
import { normalizeBrazilianPhone, formatPhoneMask } from '../../lib/phoneUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { processFileIfHeic } from '../../lib/imageHelper';
import { generateSmartPaletteFromLogo, generatePaletteFromAccent } from '../../lib/colorExtractor';
import { geocodeAddress } from '../../lib/geocoding';
import { useQueryClient } from '@tanstack/react-query';
import { PUBLIC_STORE_QUERY_KEY } from '../../hooks/usePublicStore';
import { usePlanFeatures } from '../../hooks/usePlanFeatures';
import FeatureGate from '../../components/FeatureGate';
import { UpgradeModal } from '../../components/UpgradeModal';
import {
  Save, Check, Link as LinkIcon, Copy, ExternalLink, Image as ImageIcon,
  MapPin, Phone, Globe, Mail, Palette, Clock, CreditCard, Upload,
  Trash2, Eye, Settings2, Sparkles, Building2, X, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Shield, Bell, Wand2, RotateCcw,
  Sun, Moon, Smartphone, Laptop, ShieldCheck, Crown, CalendarCheck, FileText,
  Lock, RefreshCw, Scissors, ShieldAlert, Zap, Home, Navigation
} from 'lucide-react';
import StripeActivatedModal from '../../components/modals/StripeActivatedModal';
import { ImageCropperModal } from '../../components/ImageCropperModal';

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const WhatsAppIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const StripeIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="currentColor" className={className} style={style}>
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697.5 12.521.5 5.86.5 1.584 3.977 1.584 9.544c0 6.082 5.679 7.18 8.878 8.371 2.457.915 3.328 1.597 3.328 2.64 0 .972-.947 1.554-2.428 1.554-2.28 0-5.183-1.077-7.147-2.189l-.92 5.584c2.052 1.073 5.378 1.868 8.068 1.868 6.786 0 11.233-3.23 11.233-9.197 0-6.175-5.59-7.25-8.62-8.025z" />
  </svg>
);

const TABS = [
  { id: 'aparencia', label: 'Aparência & Marca', icon: Palette },
  { id: 'politicas', label: 'Políticas de Agendamento', icon: Shield },
  { id: 'local', label: 'Localização', icon: MapPin },
  { id: 'stripe', label: 'Recebimentos & Pagamentos', icon: CreditCard },
  { id: 'contato', label: 'Contato', icon: Phone },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'conta', label: 'Status da Conta', icon: ShieldCheck },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Configuracoes() {
  const navigate = useNavigate();
  const { tenant, profile, signOut, refreshProfile } = useAuth();
  const engine = usePermissionEngine();
  const { i18n } = useTranslation();
  const { theme, setThemeId, themeId, fontStyle, setFontStyle, setCustomPalette: setContextCustomPalette } = useTheme();
  const phoneFormat = usePhoneFormat(tenant?.language || 'pt');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('aparencia');

  // Account & Subscription Status
  const [subInfo, setSubInfo] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelSubModalOpen, setCancelSubModalOpen] = useState(false);
  const [cancelConfirmationText, setCancelConfirmationText] = useState('');
  const [cancelSubLoading, setCancelSubLoading] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [accountDeletedSuccess, setAccountDeletedSuccess] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Stripe Connect Status & Modal
  const [stripeConnectInfo, setStripeConnectInfo] = useState<{
    has_account: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted?: boolean;
    stripe_account_id?: string;
  } | null>(null);
  const [syncingConnect, setSyncingConnect] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [showStripeActivatedModal, setShowStripeActivatedModal] = useState(false);
  const [stripeRequiredModalOpen, setStripeRequiredModalOpen] = useState(false);
  const [disconnectStripeModalOpen, setDisconnectStripeModalOpen] = useState(false);
  const [disconnectingStripe, setDisconnectingStripe] = useState(false);

  // ─── Form State ───────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>('pt');
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [customPalette, setCustomPalette] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState('local');
  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [depositPercentage, setDepositPercentage] = useState(50);
  // Fix #2: Individual payment option toggles
  const [allowLocal, setAllowLocal] = useState(true);
  const [allowDeposit, setAllowDeposit] = useState(true);
  const [allowFull, setAllowFull] = useState(true);

  // Tenant Identity & Custom Slug
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);

  // Studio Customizer Modal
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [draftFontStyle, setDraftFontStyle] = useState<'serif' | 'sans'>('serif');

  // Lock body scroll when customizer modal is open
  useEffect(() => {
    if (isCustomizerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCustomizerOpen]);

  // Branding
  const [previewMode, setPreviewMode] = useState<'public' | 'admin'>('public');
  const [fantasyName, setFantasyName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Contact
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');

  // Location
  const [streetAddress, setStreetAddress] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [mapLinkStatus, setMapLinkStatus] = useState<'idle' | 'resolving' | 'resolved' | 'error'>('idle');
  const [resolvedPlaceName, setResolvedPlaceName] = useState<string | null>(null);

  // Policies (Intelligent Engine)
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [rescheduleDeadlineHours, setRescheduleDeadlineHours] = useState(24);
  const [allowCancel, setAllowCancel] = useState(true);
  const [cancelPolicyText, setCancelPolicyText] = useState('');

  // New Intelligent Policies
  const [cancelFreeHoursBefore, setCancelFreeHoursBefore] = useState(2);
  const [cancelFeePercent, setCancelFeePercent] = useState(0);
  const [noshowFeePercent, setNoshowFeePercent] = useState(0);
  const [delayToleranceMinutes, setDelayToleranceMinutes] = useState(15);
  


  // Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Business Hours
  const [businessHours, setBusinessHours] = useState<Array<{
    weekday: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
    lunch_start: string;
    lunch_end: string;
  }>>([
    { weekday: 0, is_open: false, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 1, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 2, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 3, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 4, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 5, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '', lunch_end: '' },
    { weekday: 6, is_open: true, open_time: '09:00', close_time: '14:00', lunch_start: '', lunch_end: '' },
  ]);

  // Image uploads
  const logoUpload = useImageUpload({ maxWidth: 800, maxHeight: 800, quality: 0.9 });
  const bannerUpload = useImageUpload({ maxWidth: 1600, maxHeight: 600, quality: 0.85 });

  // Cropper states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [cropType, setCropType] = useState<'logo' | 'banner'>('logo');

  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [bgMode, setBgMode] = useState<'dark' | 'light'>('dark');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoSize, setLogoSize] = useState<string | null>(null);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [bannerSize, setBannerSize] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<'barbearia' | 'salao' | 'esmalteria'>((tenant?.business_type as any) || 'barbearia');

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    let file = e.target.files?.[0];
    if (file) {
      if (type === 'logo') setIsProcessingLogo(true);
      else setIsProcessingBanner(true);

      try {
        file = await processFileIfHeic(file);

        if (type === 'logo') setLogoSize(formatSize(file.size));
        else setBannerSize(formatSize(file.size));

        const reader = new FileReader();
        reader.onload = () => {
          setCropImageSrc(reader.result as string);
          setCropType(type);
          setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
      } finally {
        if (type === 'logo') setIsProcessingLogo(false);
        else setIsProcessingBanner(false);
      }
    }
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropModalOpen(false);
    if (!tenant) return;

    if (cropType === 'logo') {
      const url = await logoUpload.upload(croppedFile, `${tenant.id}/logo`);
      if (url) {
        setLogoUrl(url);
        handleMagicExtract(url, bgMode);
      }
    } else {
      const url = await bannerUpload.upload(croppedFile, `${tenant.id}/banner`);
      if (url) setBannerUrl(url);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    setLogoUrl('');
    logoUpload.clearPreview();
  };

  const removeBanner = (e: React.MouseEvent) => {
    e.preventDefault();
    setBannerUrl('');
    bannerUpload.clearPreview();
  };

  const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const loadSettings = useCallback(async () => {
    if (!tenant) return;
    setInitialLoading(true);

    try {
      if (tenant.business_type) {
        setBusinessType(tenant.business_type as any);
      }
      // Load tenant settings
      const { data } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenant.id).maybeSingle();
      if (data) {
        setSettingsId(data.id);
        setSelectedTheme(data.theme_preset || 'noir');
        setCustomPalette(data.custom_palette || null);
        if (data.theme_preset) setThemeId(data.theme_preset);
        else setThemeId('noir');
        if (data.custom_palette) {
          setContextCustomPalette(data.custom_palette);
          if (data.custom_palette.fontStyle) {
            setFontStyle(data.custom_palette.fontStyle);
            setDraftFontStyle(data.custom_palette.fontStyle);
          }
        } else {
          setContextCustomPalette(undefined);
        }

        if (data.custom_palette?.background) {
          // Detect if background is light or dark
          const bg = data.custom_palette.background.toLowerCase();
          setBgMode(bg.startsWith('#f') || bg.startsWith('#e') || bg === '#ffffff' ? 'light' : 'dark');
        } else if (data.theme_preset === 'elegant') {
          setBgMode('light');
        } else {
          setBgMode('dark');
        }
        setDepositPercentage(data.deposit_percentage || 50);
        // Payment Methods JSONB
        try {
          const pm = data.payment_methods;
          if (pm) {
            setAllowLocal(pm.pay_local ?? true);
            setAllowDeposit(pm.partial_50 ?? true);
            setAllowFull(pm.full_100 ?? false);
          } else {
            setAllowLocal(true);
            setAllowDeposit(true);
            setAllowFull(false);
          }
        } catch {
          setAllowLocal(true);
          setAllowDeposit(true);
          setAllowFull(false);
        }
        setFantasyName(data.fantasy_name || tenant.name || '');
        setTenantName(tenant.name || data.fantasy_name || '');
        setSlug(tenant.slug || '');
        setSlogan(data.slogan ?? data.custom_palette?.slogan ?? data.short_description ?? '');
        setDescription(data.description ?? data.custom_palette?.description ?? data.short_description ?? '');
        setLogoUrl(data.logo_url || '');
        setBannerUrl(data.banner_url || '');
        if (data.logo_url) logoUpload.setPreview(data.logo_url);
        if (data.banner_url) bannerUpload.setPreview(data.banner_url);
        setWhatsapp(data.whatsapp_number || data.phone || '');
        setInstagram(data.instagram || '');
        setFacebook(data.facebook || '');
        setWebsite(data.website || '');
        setEmail(data.email || '');
        setStreetAddress(data.address || data.street || '');
        setFullAddress(data.full_address || data.address || '');
        setZipCode(data.zip_code || '');
        setStreetNumber(data.street_number || '');
        setComplement(data.complement || '');
        setNeighborhood(data.neighborhood || '');
        setCity(data.city || '');
        setState(data.state || '');
        setCountry(data.country || '');
        setMapLink(data.map_link || '');
        setLatitude(data.latitude || null);
        setLongitude(data.longitude || null);

        // Policies
        setAllowReschedule(data.allow_reschedule ?? true);
        setRescheduleDeadlineHours(data.reschedule_deadline_hours ?? 24);
        setAllowCancel(data.allow_cancel ?? true);
        setCancelPolicyText(data.cancel_policy_text || '');

        // Intelligent engine policies
        setCancelFreeHoursBefore(data.cancel_free_hours_before ?? 2);
        setCancelFeePercent(data.cancel_fee_percent ?? 0);
        setNoshowFeePercent(data.noshow_fee_percent ?? 0);
        setDelayToleranceMinutes(data.delay_tolerance_minutes ?? 15);


      } else {
        setTenantName(tenant.name || '');
        setSlug(tenant.slug || '');
      }

      // Load notification settings
      const { data: notifData } = await supabase.from('notification_settings').select('*').eq('tenant_id', tenant.id).maybeSingle();
      if (notifData) {
        setSoundEnabled(notifData.sound_enabled ?? true);
      }

      // Load business hours
      const { data: hours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('weekday', { ascending: true });

      if (hours && hours.length > 0) {
        const mapped = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
          const found = hours.find((h: any) => h.weekday === wd);
          return {
            weekday: wd,
            is_open: found ? found.is_open : false,
            open_time: found?.open_time?.substring(0, 5) || '09:00',
            close_time: found?.close_time?.substring(0, 5) || '18:00',
            lunch_start: found?.lunch_start?.substring(0, 5) || '',
            lunch_end: found?.lunch_end?.substring(0, 5) || '',
          };
        });
        setBusinessHours(mapped);
      }
      // Load subscription info
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, plans(*), subscription_contracts(*)')
        .eq('tenant_id', tenant.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subData) {
        setSubInfo(subData);
      }

      // Load connect account info
      const { data: connectData } = await supabase
        .from('stripe_connect_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (connectData) {
        setStripeConnectInfo({
          has_account: true,
          charges_enabled: connectData.charges_enabled,
          payouts_enabled: connectData.payouts_enabled,
          stripe_account_id: connectData.stripe_account_id,
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [tenant]);

  // ─── Load Settings ────────────────────────────────────────────────────────
  useEffect(() => {
    if (tenant) {
      setLanguage(tenant.language || 'pt');
      setBusinessType(tenant.business_type as any || 'barbearia');
      loadSettings();

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && TABS.some(t => t.id === tabParam)) {
        setActiveTab(tabParam as TabId);
      }
      if (tabParam === 'stripe' || window.location.search.includes('connect')) {
        syncConnectStatus(true);
      }
    }
  }, [tenant, loadSettings]);

  // Auto sync fresh Stripe status whenever entering Stripe tab
  useEffect(() => {
    if (activeTab === 'stripe' && tenant?.id) {
      syncConnectStatus(false);
    }
  }, [activeTab, tenant?.id]);

  // ─── Slug Uniqueness & Format Validation ──────────────────────────────────
  const slugCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateSlugLive = (rawSlug: string) => {
    const formatted = rawSlug
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '');

    if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current);

    if (!formatted || formatted.length < 3) {
      setSlugStatus('invalid');
      setSlugMessage('O link deve ter no mínimo 3 caracteres (letras, números ou hífens).');
      return;
    }

    if (tenant && formatted === tenant.slug) {
      setSlugStatus('available');
      setSlugMessage('Este é o seu link atual.');
      return;
    }

    setSlugStatus('checking');
    setSlugMessage('Verificando disponibilidade...');

    slugCheckTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, slug')
          .eq('slug', formatted)
          .maybeSingle();

        if (error) throw error;

        if (data && data.id !== tenant?.id) {
          setSlugStatus('unavailable');
          setSlugMessage(`O link "${formatted}" já está em uso por outro salão.`);
        } else {
          setSlugStatus('available');
          setSlugMessage(`O link "${formatted}" está livre!`);
        }
      } catch (err: any) {
        console.error('Erro ao validar slug:', err);
        setSlugStatus('idle');
        setSlugMessage('');
      }
    }, 400);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    setSlug(raw);
    validateSlugLive(raw);
  };

  // Extract smart colors and generate tailored theme (local draft only)
  const handleMagicExtract = async (targetUrlOverride?: string, targetModeOverride?: 'dark' | 'light', chosenAccent?: string) => {
    const targetUrl = targetUrlOverride || logoUrl || logoUpload.preview;
    if (!targetUrl) {
      alert('Faça upload de uma logo primeiro para extrair a paleta!');
      return;
    }
    const mode = targetModeOverride || bgMode;
    setIsExtracting(true);
    try {
      const smartResult = await generateSmartPaletteFromLogo(targetUrl, mode);
      if (smartResult.extractedPalette && smartResult.extractedPalette.length > 0) {
        setExtractedColors(smartResult.extractedPalette);
      }

      const accentToUse = chosenAccent || smartResult.primary;
      const newPalette = mode === 'dark'
        ? { primary: accentToUse }
        : {
          primary: accentToUse,
          background: '#F4F5F7',
          card: '#FFFFFF',
          text: '#0F172A',
        };
      setCustomPalette(newPalette);
      setSelectedTheme(mode === 'light' ? 'elegant' : 'noir');
    } catch (e) {
      console.error(e);
      alert('Erro ao analisar cores da imagem');
    } finally {
      setIsExtracting(false);
    }
  };

  // Switch between Dark/Light mode keeping active accent (local draft only)
  const handleToggleBgMode = (newMode: 'dark' | 'light') => {
    setBgMode(newMode);
    const activeAccent = customPalette?.primary || theme.accent;
    const newPalette = newMode === 'dark'
      ? { primary: activeAccent }
      : {
        primary: activeAccent,
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
      };
    setCustomPalette(newPalette);
    setSelectedTheme(newMode === 'light' ? 'elegant' : 'noir');
  };

  // Select a specific color from extracted palette swatches (local draft only)
  const handleSelectSwatchColor = (swatchHex: string) => {
    const newPalette = bgMode === 'dark'
      ? { primary: swatchHex }
      : {
        primary: swatchHex,
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
      };
    setCustomPalette(newPalette);
    setSelectedTheme(bgMode === 'light' ? 'elegant' : 'noir');
  };

  // Reset completely to default Noir Theme (local draft only)
  const handleResetToNoir = () => {
    setBgMode('dark');
    setCustomPalette(undefined);
    setDraftFontStyle('serif');
    setSelectedTheme('noir');
  };

  // ─── CEP Lookup (Brazil) ──────────────────────────────────────────────────
  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setStreetAddress(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);
        setCountry('Brasil');

        // Tenta obter as coordenadas (Ancoragem do ponto zero da Barbearia)
        const query = `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || ''}, ${data.uf || ''}, Brasil`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',');
        const geoResult = await geocodeAddress(query);
        if (geoResult) {
          setLatitude(geoResult.latitude);
          setLongitude(geoResult.longitude);
          setMapLinkStatus('resolved'); // Marca como resolvido no visual
        } else {
          // Fallback se não encontrar o endereço completo, tenta só pelo CEP
          const geoResultFallback = await geocodeAddress(`${digits}, Brasil`);
          if (geoResultFallback) {
            setLatitude(geoResultFallback.latitude);
            setLongitude(geoResultFallback.longitude);
            setMapLinkStatus('resolved');
          }
        }
      }
    } catch (err) {
      console.error('ViaCEP error:', err);
    }
  };

  // ─── Live Phone Verification States (SSOT) ──────────────────────────────
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'taken'>('idle');
  const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null);
  const phoneCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validatePhoneLive = (rawPhone: string) => {
    if (phoneCheckTimerRef.current) clearTimeout(phoneCheckTimerRef.current);

    if (!rawPhone || !rawPhone.trim()) {
      setPhoneCheckStatus('idle');
      setPhoneFeedback(null);
      return;
    }

    const phoneValidation = normalizeBrazilianPhone(rawPhone);
    if (!phoneValidation.isValid || !phoneValidation.normalized) {
      setPhoneCheckStatus('invalid');
      setPhoneFeedback(phoneValidation.error || 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.');
      return;
    }

    setPhoneCheckStatus('checking');
    setPhoneFeedback('Verificando disponibilidade...');

    phoneCheckTimerRef.current = setTimeout(async () => {
      try {
        const { data: avail, error: availErr } = await supabase.rpc('check_phone_availability', {
          p_phone: phoneValidation.normalized,
          p_exclude_user_id: profile?.id
        });

        if (!availErr && avail) {
          if (!avail.available) {
            setPhoneCheckStatus('taken');
            setPhoneFeedback(avail.error || 'Este número de telefone já está cadastrado em outra conta.');
          } else {
            setPhoneCheckStatus('valid');
            setPhoneFeedback('Telefone válido e disponível!');
          }
        } else {
          setPhoneCheckStatus('valid');
          setPhoneFeedback('Telefone válido!');
        }
      } catch (e) {
        setPhoneCheckStatus('idle');
        setPhoneFeedback(null);
      }
    }, 350);
  };

  // ─── Automatic Google Maps Link Resolution (SSOT) ─────────────────────────
  useEffect(() => {
    if (!mapLink || !mapLink.trim()) {
      setMapLinkStatus('idle');
      setResolvedPlaceName(null);
      return;
    }

    const clean = mapLink.trim();

    // 1. Direct coordinate extraction from URL (!3d!4d, @lat,lng, q=lat,lng)
    const data3dMatch = clean.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (data3dMatch) {
      setLatitude(parseFloat(data3dMatch[1]));
      setLongitude(parseFloat(data3dMatch[2]));
      setMapLinkStatus('resolved');
      return;
    }

    const atMatch = clean.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      setLatitude(parseFloat(atMatch[1]));
      setLongitude(parseFloat(atMatch[2]));
      setMapLinkStatus('resolved');
      return;
    }

    const qMatch = clean.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      setLatitude(parseFloat(qMatch[1]));
      setLongitude(parseFloat(qMatch[2]));
      setMapLinkStatus('resolved');
      return;
    }

    // 2. Short links (maps.app.goo.gl, goo.gl/maps) or Google Place URLs
    if (clean.includes('goo.gl') || clean.includes('google.com/maps')) {
      setMapLinkStatus('resolving');
      const timer = setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('resolve-map-link', {
            body: { url: clean },
          });

          if (!error && data?.success) {
            if (data.latitude && data.longitude) {
              setLatitude(data.latitude);
              setLongitude(data.longitude);
              setMapLinkStatus('resolved');
            }
            if (data.placeName) {
              setResolvedPlaceName(data.placeName);
            }
          } else {
            setMapLinkStatus('idle');
          }
        } catch (err) {
          console.warn('Erro ao resolver link do Google Maps:', err);
          setMapLinkStatus('idle');
        }
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [mapLink]);

  // ─── Handle Phone Formatting ──────────────────────────────────────────────
  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneMask(e.target.value);
    setWhatsapp(formatted);
    validatePhoneLive(formatted);
  };

  const queryClient = useQueryClient();

  // ─── Handle Theme Change ──────────────────────────────────────────────────
  const handleThemeChange = (id: string) => {
    setSelectedTheme(id);
    setThemeId(id); // Apply immediately for preview
    setCustomPalette(null); // Reset overrides to adopt new preset
    setContextCustomPalette(undefined);
  };

  // ─── Save Identity & Custom Slug Only ──────────────────────────────────────
  const handleSaveIdentity = async () => {
    if (!tenant) return;
    if (slugStatus === 'unavailable') {
      alert('O link personalizado escolhido já está em uso por outro salão. Por favor, escolha outro link antes de salvar.');
      return;
    }
    if (slugStatus === 'invalid') {
      alert('O link personalizado é inválido. Ele deve ter no mínimo 3 caracteres alfanuméricos.');
      return;
    }

    const cleanSlug = slug.trim() || tenant.slug;
    const cleanName = tenantName.trim() || fantasyName.trim() || tenant.name;

    setIdentitySaving(true);
    try {
      // 1. Atualiza na tabela tenants
      const { error: tenantErr } = await (supabase as any)
        .from('tenants')
        .update({
          name: cleanName,
          slug: cleanSlug,
        })
        .eq('id', tenant.id);

      if (tenantErr) {
        if (tenantErr.code === '23505') {
          alert('Este link já está em uso por outro salão. Por favor, escolha outro link.');
          setIdentitySaving(false);
          return;
        }
        throw tenantErr;
      }

      // 2. Atualiza fantasy_name na tabela tenant_settings
      if (settingsId) {
        await supabase.from('tenant_settings').update({ fantasy_name: cleanName }).eq('id', settingsId);
      } else {
        const { data } = await supabase.from('tenant_settings').insert([{ tenant_id: tenant.id, fantasy_name: cleanName }]).select().single();
        if (data) setSettingsId(data.id);
      }

      // 3. Invalida os caches do React Query
      if (tenant.slug) queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(tenant.slug) });
      if (cleanSlug) queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(cleanSlug) });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });

      // 4. Recarrega os dados do tenant no AuthContext
      await refreshProfile?.();

      setIdentitySaved(true);
      setTimeout(() => setIdentitySaved(false), 3500);
    } catch (err: any) {
      console.error('Erro ao salvar identidade:', err);
      alert(`Erro ao salvar: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIdentitySaving(false);
    }
  };

  // ─── Save All Settings ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tenant) return;
    setLoading(true);

    try {
      // Validate slug status before saving
      if (slugStatus === 'unavailable') {
        alert('O link personalizado escolhido já está em uso por outro salão. Por favor, escolha outro link antes de salvar.');
        setLoading(false);
        return;
      }
      if (slugStatus === 'invalid') {
        alert('O link personalizado é inválido. Ele deve ter no mínimo 3 caracteres alfanuméricos.');
        setLoading(false);
        return;
      }

      // Validação arquitetural do Telefone / WhatsApp (SSOT)
      let normalizedPhone: string | null = null;
      let cleanWhatsapp = whatsapp.trim();
      if (cleanWhatsapp) {
        const phoneValidation = normalizeBrazilianPhone(cleanWhatsapp);
        if (!phoneValidation.isValid || !phoneValidation.normalized) {
          alert(phoneValidation.error || 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.');
          setLoading(false);
          return;
        }
        normalizedPhone = phoneValidation.normalized;
        cleanWhatsapp = phoneValidation.formatted || cleanWhatsapp;

        // Checagem de unicidade contra outras contas
        try {
          const { data: avail, error: availErr } = await supabase.rpc('check_phone_availability', {
            p_phone: normalizedPhone,
            p_exclude_user_id: profile?.id
          });

          if (!availErr && avail && !avail.available) {
            alert(avail.error || 'Este número de telefone já está cadastrado em outra conta.');
            setLoading(false);
            return;
          }
        } catch (checkErr) {
          console.warn('Check phone availability error:', checkErr);
        }
      }

      const cleanSlug = slug.trim() || tenant.slug;
      const cleanName = tenantName.trim() || fantasyName.trim() || tenant.name;

      // Update tenant name, slug, language and business_type
      const { data: updatedTenant, error: tenantErr } = await (supabase as any)
        .from('tenants')
        .update({
          name: cleanName,
          slug: cleanSlug,
          language,
          business_type: businessType,
        })
        .eq('id', tenant.id)
        .select();

      if (!tenantErr && (!updatedTenant || updatedTenant.length === 0)) {
        alert('Erro ao salvar as configurações: Permissão negada pelo banco de dados (RLS). Certifique-se de que a migração 0052_fix_tenants_rls.sql foi aplicada!');
        setLoading(false);
        return;
      }

      if (tenantErr) {
        if (tenantErr.code === '23505') {
          alert('Este link já está em uso por outro salão. Por favor, escolha outro link.');
          setLoading(false);
          return;
        }
        console.error('Erro ao atualizar dados do salão:', tenantErr);
        alert('Erro ao atualizar dados do salão: ' + tenantErr.message);
        setLoading(false);
        return;
      }

      i18n.changeLanguage(language);

      // Atualiza telefone no perfil do usuário
      if (profile?.id) {
        await supabase.from('profiles').update({
          phone: cleanWhatsapp,
          phone_normalized: normalizedPhone,
        }).eq('id', profile.id);
      }

      // Fix #2: Serialize individual payment toggles as JSON and validate
      const activeOptions = [allowLocal, allowDeposit, allowFull].filter(Boolean).length;
      if (activeOptions === 0) {
        alert('Pelo menos uma forma de pagamento deve estar ativa!');
        setLoading(false);
        return;
      }
      const paymentModeJson = { pay_local: allowLocal, partial_50: allowDeposit, full_100: allowFull };

      const finalPalette = {
        ...(customPalette || {}),
        fontStyle: draftFontStyle,
      };

      const computedFullAddress = [streetAddress, streetNumber ? `nº ${streetNumber}` : '', neighborhood, city, state, zipCode, 'Brasil'].filter(Boolean).join(', ') || fullAddress;

      // Build payload (Note: business_type is strictly in 'tenants' table, not in 'tenant_settings')
      const payload: Record<string, any> = {
        tenant_id: tenant.id,
        theme_preset: selectedTheme,
        custom_palette: { ...finalPalette, slogan, description },
        payment_methods: paymentModeJson,
        deposit_percentage: allowDeposit ? depositPercentage : null,
        fantasy_name: cleanName,
        short_description: slogan || description || '',
        logo_url: logoUrl,
        banner_url: bannerUrl,
        whatsapp_number: whatsapp,
        phone: whatsapp,
        instagram,
        facebook,
        website,
        email,
        address: streetAddress,
        full_address: computedFullAddress,
        zip_code: zipCode,
        street_number: streetNumber,
        complement,
        neighborhood,
        city,
        state,
        country: country || 'Brasil',
        map_link: mapLink,
        latitude,
        longitude,
        allow_reschedule: allowReschedule,
        reschedule_deadline_hours: rescheduleDeadlineHours,
        allow_cancel: allowCancel,
        cancel_policy_text: cancelPolicyText,
        cancel_free_hours_before: cancelFreeHoursBefore,
        cancel_fee_percent: cancelFeePercent,
        noshow_fee_percent: noshowFeePercent,
        delay_tolerance_minutes: delayToleranceMinutes,
      };

      if (settingsId) {
        const { error: updateErr } = await supabase.from('tenant_settings').update(payload).eq('id', settingsId);
        if (updateErr) {
          console.error('Error updating tenant_settings:', updateErr);
          throw new Error('Falha ao salvar configurações do salão: ' + updateErr.message);
        }
      } else {
        const { data, error: insertErr } = await supabase.from('tenant_settings').insert([payload]).select().single();
        if (insertErr) {
          console.error('Error inserting tenant_settings:', insertErr);
          throw new Error('Falha ao criar configurações do salão: ' + insertErr.message);
        }
        if (data) setSettingsId(data.id);
      }

      // Save business hours
      for (const bh of businessHours) {
        const hourPayload = {
          tenant_id: tenant.id,
          weekday: bh.weekday,
          is_open: bh.is_open,
          open_time: bh.open_time + ':00',
          close_time: bh.close_time + ':00',
          lunch_start: bh.lunch_start ? bh.lunch_start + ':00' : null,
          lunch_end: bh.lunch_end ? bh.lunch_end + ':00' : null,
        };

        const { data: existingHour } = await supabase
          .from('business_hours')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('weekday', bh.weekday)
          .maybeSingle();

        if (existingHour) {
          await supabase.from('business_hours').update(hourPayload).eq('id', existingHour.id);
        } else {
          await supabase.from('business_hours').insert([hourPayload]);
        }
      }

      // Save notifications
      const { data: existingNotif } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existingNotif) {
        await supabase.from('notification_settings').update({ sound_enabled: soundEnabled }).eq('id', existingNotif.id);
      } else {
        await supabase.from('notification_settings').insert([{ tenant_id: tenant.id, sound_enabled: soundEnabled }]);
      }

      // Invalidate public page query cache so changes reflect immediately
      if (tenant?.slug) {
        queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(tenant.slug) });
      }
      if (cleanSlug) {
        queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(cleanSlug) });
      }
      queryClient.invalidateQueries({ queryKey: ['tenant_settings', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });

      // Refresh auth tenant data
      await refreshProfile?.();

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!tenant) return;
    setIsConnectingStripe(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connect-onboarding-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro na API: ${res.status} ${errorText}`);
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error('Stripe Connect error:', err);
      alert(`Erro ao iniciar conexão com o Stripe: ${err.message}`);
      setIsConnectingStripe(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!tenant?.id) return;
    setDisconnectingStripe(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Tenta acionar a Edge Function para desvinculação na API do Stripe
      if (session) {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/disconnect-connect-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            }
          });
        } catch (edgeErr) {
          console.warn('Edge Function disconnect-connect-account aviso:', edgeErr);
        }
      }

      // 2. Remove o registro no Supabase
      await supabase
        .from('stripe_connect_accounts')
        .delete()
        .eq('tenant_id', tenant.id);

      // 3. Reseta os métodos de pagamento para apenas Pagar no Local
      const defaultMethods = { pay_local: true, partial_50: false, full_100: false };
      await supabase
        .from('tenant_settings')
        .update({
          online_payment_enabled: false,
          payment_methods: defaultMethods,
        } as any)
        .eq('tenant_id', tenant.id);

      setStripeConnectInfo(null);
      setAllowLocal(true);
      setAllowDeposit(false);
      setAllowFull(false);
      setDisconnectStripeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant_settings', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
    } catch (err: any) {
      console.error('Error disconnecting Stripe:', err);
      alert('Erro ao desconectar conta Stripe: ' + err.message);
    } finally {
      setDisconnectingStripe(false);
    }
  };

  const syncConnectStatus = async (showModalIfActivated = true) => {
    if (!tenant?.id) return;
    setSyncingConnect(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-connect-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setStripeConnectInfo(data);
        if (data.charges_enabled) {
          setAllowDeposit(true);
          setAllowFull(true);
          if (data.just_activated && showModalIfActivated) {
            setShowStripeActivatedModal(true);
          }
        }
      }
    } catch (err) {
      console.warn('Sync connect error:', err);
    } finally {
      setSyncingConnect(false);
    }
  };

  const handleStripeActivatedChoice = async (disableLocal: boolean) => {
    if (!tenant) return;
    const newPayLocal = !disableLocal;
    setAllowLocal(newPayLocal);
    setAllowDeposit(true);
    setAllowFull(true);

    try {
      await supabase.from('tenant_settings').update({
        payment_methods: {
          pay_local: newPayLocal,
          partial_50: true,
          full_100: true,
        },
        online_payment_enabled: true,
      } as any).eq('tenant_id', tenant.id);

      queryClient.invalidateQueries({ queryKey: ['tenant_settings', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
      queryClient.invalidateQueries({ queryKey: PUBLIC_STORE_QUERY_KEY(tenant.slug) });
    } catch (e) {
      console.error('Error updating payment methods after connect choice:', e);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ returnUrl: window.location.href })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir portal do cliente');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      alert(`Erro ao abrir portal de faturamento: ${err.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (cancelConfirmationText !== 'CANCELAR' || !tenant?.id) return;
    setCancelSubLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao cancelar assinatura');
      }

      setSubInfo((prev: any) => prev ? { ...prev, status: 'canceled' } : null);
      setCancelSubModalOpen(false);
      setCancelConfirmationText('');
      queryClient.invalidateQueries({ queryKey: ['active_subscription_contract'] });
      queryClient.invalidateQueries({ queryKey: ['permission_engine'] });
      queryClient.invalidateQueries({ queryKey: ['plan_features'] });
      await loadSettings();
      alert('Assinatura cancelada com sucesso. Seu salão será bloqueado no encerramento do ciclo.');
    } catch (err: any) {
      console.error('Cancel sub error:', err);
      alert(`Erro ao cancelar assinatura: ${err.message}`);
    } finally {
      setCancelSubLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'EXCLUIR' || !tenant?.id) return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const userId = session.user.id;
      const tenantId = tenant.id;

      // 1. Aciona a Edge Function para cancelamento seguro no Stripe
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ target_tenant_id: tenantId }),
        });
      } catch (edgeErr) {
        console.warn('Aviso Edge Function delete-account:', edgeErr);
      }

      // 2. Executa a exclusão definitiva no banco via RPC de segurança
      try {
        await supabase.rpc('hard_delete_tenant_and_user', {
          p_tenant_id: tenantId,
          p_user_id: userId,
        });
      } catch (rpcErr) {
        console.warn('Fallback exclusão direta:', rpcErr);
        await supabase.from('stripe_connect_accounts').delete().eq('tenant_id', tenantId);
        await supabase.from('subscriptions').delete().eq('tenant_id', tenantId);
        await supabase.from('tenant_settings').delete().eq('tenant_id', tenantId);
        await supabase.from('business_hours').delete().eq('tenant_id', tenantId);
        await supabase.from('blocked_times').delete().eq('tenant_id', tenantId);
        await supabase.from('financial_transactions').delete().eq('tenant_id', tenantId);
        await supabase.from('bookings').delete().eq('tenant_id', tenantId);
        await supabase.from('customers').delete().eq('tenant_id', tenantId);
        await supabase.from('products').delete().eq('tenant_id', tenantId);
        await supabase.from('services').delete().eq('tenant_id', tenantId);
        await supabase.from('professionals').delete().eq('tenant_id', tenantId);
        await supabase.from('notification_settings').delete().eq('tenant_id', tenantId);
        await supabase.from('custom_pricing').delete().eq('tenant_id', tenantId);
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.from('tenants').delete().eq('id', tenantId);
      }

      // 3. Limpa storage local
      localStorage.clear();
      sessionStorage.clear();

      // 4. Fecha o modal de confirmação e exibe o pop-up de sucesso
      setDeleteAccountModalOpen(false);
      setAccountDeletedSuccess(true);

      // 5. Redireciona para a landing page após 2.5s
      setTimeout(async () => {
        try {
          await signOut();
        } catch { }
        window.location.href = '/';
      }, 2500);

    } catch (err: any) {
      console.error('Delete account error:', err);
      alert(`Erro ao excluir conta: ${err.message}`);
      setDeleteLoading(false);
    }
  };

  const publicUrl = `raffros.com/${tenant?.slug || ''}`;

  // ─── Skeleton Loading ─────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div style={{ maxWidth: '900px' }} className="pb-12 space-y-6 animate-fade-in">
        <div>
          <div className="skeleton skeleton-text w-32 mb-2" style={{ height: '12px' }} />
          <div className="skeleton skeleton-text w-64" style={{ height: '28px' }} />
        </div>
        <div className="skeleton skeleton-card" style={{ height: '100px' }} />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '12px' }} />
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: '400px' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px' }} className="pb-12 space-y-6 animate-fade-in">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: theme.accent }}>
            <Settings2 className="w-3.5 h-3.5" />
            Configurações
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.textPrimary, fontFamily: fontStyle === 'serif' ? "'Playfair Display', serif" : 'inherit' }}>
            Configurações do Salão
          </h1>
        </div>

        {/* Compact Public Link Pill (exibe o link oficial salvo no banco) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}>
            <Globe className="w-3.5 h-3.5" style={{ color: theme.accent }} />
            <span className="font-mono font-bold">raffros.com/{tenant?.slug || 'seu-link'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const currentFullUrl = `raffros.com/${tenant?.slug || ''}`;
              navigator.clipboard.writeText(currentFullUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="p-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer"
            style={{ background: theme.inputBg, borderColor: theme.border, color: copied ? theme.success : theme.textSecondary }}
            title="Copiar Link Oficial Salvo"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => window.open(`/${tenant?.slug}`, '_blank')}
            className="p-2.5 rounded-xl transition-all hover:scale-105 cursor-pointer shadow-sm"
            style={{ background: theme.btnPrimaryBg || theme.accent, color: theme.btnPrimaryText }}
            title="Ver Página Pública Oficial"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-none" style={{ borderBottom: `1px solid ${theme.border}` }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
              style={{
                background: isActive
                  ? (theme.id === 'elegant' ? '#0F172A' : '#FFFFFF')
                  : 'transparent',
                color: isActive
                  ? (theme.id === 'elegant' ? '#FFFFFF' : '#000000')
                  : theme.textSecondary,
                boxShadow: isActive ? (theme.id === 'elegant' ? '0 1px 3px rgba(0,0,0,0.1)' : '0 0 12px rgba(255,255,255,0.2)') : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="glass-card p-4 sm:p-6 rounded-2xl"
        >

          {/* ═══════════════════════════ TAB: APARÊNCIA & MARCA (UNIFICADO) ═══════════════════════════ */}
          {activeTab === 'aparencia' && (
            <div className="space-y-6">
              {/* 1. Nome & Link da Barbearia (Clean & Spacious) */}
              <div className="p-5 sm:p-6 rounded-2xl border space-y-4" style={{ background: theme.inputBg, borderColor: theme.border }}>
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: theme.textPrimary }}>
                    <Building2 className="w-4 h-4" style={{ color: theme.accent }} />
                    Nome do Estabelecimento & Link Público
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                    As alterações feitas aqui só são salvas e publicadas quando você clicar em "Salvar Configurações".
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome do Salão */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
                      Nome do Salão
                    </label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => {
                        setTenantName(e.target.value);
                        setFantasyName(e.target.value);
                      }}
                      placeholder="Ex: Barbearia Raffros"
                      className="themed-input"
                    />
                  </div>

                  {/* Link / URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                        Link Personalizado (URL)
                      </label>
                      {slugStatus === 'available' && (
                        <span className="text-[10px] font-bold text-emerald-500">✓ Disponível!</span>
                      )}
                      {slugStatus === 'unavailable' && (
                        <span className="text-[10px] font-bold text-rose-500">✕ Já em uso!</span>
                      )}
                      {slugStatus === 'checking' && (
                        <span className="text-[10px] font-bold text-amber-500">Verificando...</span>
                      )}
                    </div>
                    <div className="flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[var(--theme-accent)]"
                      style={{
                        background: theme.bg,
                        borderColor: slugStatus === 'unavailable' ? '#f43f5e' : slugStatus === 'available' ? '#10b981' : theme.border
                      }}>
                      <span className="px-3 py-2.5 text-xs font-bold select-none border-r shrink-0 flex items-center gap-1"
                        style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>
                        raffros.com/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={handleSlugChange}
                        placeholder="seu-link"
                        className="w-full px-3 py-2.5 text-sm font-bold bg-transparent border-0 focus:outline-none"
                        style={{ color: theme.textPrimary }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Imagens: Logo & Capa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Logo */}
                <div className="flex flex-col items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-center" style={{ color: theme.textSecondary }}>
                    Logo do Salão (Perfil)
                  </label>
                  <div
                    className="relative w-40 h-40 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all mx-auto"
                    style={{
                      borderColor: logoUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {isProcessingLogo ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: theme.accent }} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: theme.accent }}>Lendo...</span>
                      </div>
                    ) : logoUrl || logoUpload.preview ? (
                      <>
                        <img src={logoUrl || logoUpload.preview || ''} alt="Logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <label className="p-2 rounded-full cursor-pointer" style={{ background: theme.accent, color: theme.textInverse }}>
                            <Upload className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'logo')} className="hidden" />
                          </label>
                          <button onClick={removeLogo} className="p-2 rounded-full bg-red-500 text-white">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {logoSize && !isProcessingLogo && (
                          <div className="absolute bottom-1 right-1/2 translate-x-1/2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm pointer-events-none whitespace-nowrap">
                            {logoSize}
                          </div>
                        )}
                      </>
                    ) : (
                      <label className="text-center p-4 cursor-pointer w-full h-full flex flex-col items-center justify-center">
                        {logoUpload.isUploading ? (
                          <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: theme.accent }} />
                        ) : (
                          <Upload className="w-7 h-7 mb-2" style={{ color: theme.textMuted }} />
                        )}
                        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                          {logoUpload.isUploading ? 'Enviando...' : 'Enviar Logo'}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>Mínimo 400×400px</p>
                        <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'logo')} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Banner Capa */}
                <div className="flex flex-col items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-center" style={{ color: theme.textSecondary }}>
                    Banner (Capa Superior)
                  </label>
                  <div
                    className="relative w-full h-40 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all mx-auto"
                    style={{
                      borderColor: bannerUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {isProcessingBanner ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: theme.accent }} />
                        <span className="text-[10px] font-bold uppercase" style={{ color: theme.accent }}>Lendo...</span>
                      </div>
                    ) : bannerUrl || bannerUpload.preview ? (
                      <>
                        <img src={bannerUrl || bannerUpload.preview || ''} alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <label className="p-2 rounded-full cursor-pointer" style={{ background: theme.accent, color: theme.textInverse }}>
                            <Upload className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} className="hidden" />
                          </label>
                          <button onClick={removeBanner} className="p-2 rounded-full bg-red-500 text-white">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {bannerSize && !isProcessingBanner && (
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium backdrop-blur-sm pointer-events-none">
                            {bannerSize}
                          </div>
                        )}
                      </>
                    ) : (
                      <label className="text-center p-4 cursor-pointer w-full h-full flex flex-col items-center justify-center">
                        {bannerUpload.isUploading ? (
                          <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: theme.accent }} />
                        ) : (
                          <Upload className="w-7 h-7 mb-2" style={{ color: theme.textMuted }} />
                        )}
                        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                          {bannerUpload.isUploading ? 'Enviando...' : 'Enviar Foto de Capa'}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>Ideal 1600×600px</p>
                        <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Identidade Visual da Marca & Studio (Spacious & Clean) */}
              <div
                className="p-6 sm:p-7 rounded-3xl border space-y-6 transition-all"
                style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-base flex items-center gap-2" style={{ color: theme.textPrimary }}>
                      <Palette className="w-5 h-5" style={{ color: theme.accent }} />
                      Identidade Visual & Cores da Marca
                    </h4>
                    <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                      Configure a atmosfera do seu salão, a cor de destaque e o estilo tipográfico com prévia em tempo real.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!engine.hasPermission('configuracoes.editar_layout')) {
                        setShowUpgradeModal('configuracoes.editar_layout');
                        return;
                      }
                      setDraftFontStyle(fontStyle);
                      setIsCustomizerOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
                    style={{
                      background: theme.btnPrimaryBg || theme.accent,
                      color: theme.btnPrimaryText,
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Personalizar Visual & Cores</span>
                  </button>
                </div>

                {/* Resumo Visual Atual com Muito Respiro */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {/* Atmosfera */}
                  <div
                    className="p-4 rounded-2xl border flex items-center gap-3.5"
                    style={{ background: theme.inputBg, borderColor: theme.border }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        background: bgMode === 'dark' ? `${customPalette?.primary || theme.accent}20` : `${theme.accent}15`,
                        color: customPalette?.primary || theme.accent,
                      }}
                    >
                      {bgMode === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Atmosfera</p>
                      <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                        {bgMode === 'dark' ? 'Modo Noturno / Escuro' : 'Modo Claro / Diurno'}
                      </p>
                    </div>
                  </div>

                  {/* Cor da Marca */}
                  <div
                    className="p-4 rounded-2xl border flex items-center gap-3.5"
                    style={{ background: theme.inputBg, borderColor: theme.border }}
                  >
                    <div
                      className="w-7 h-7 rounded-xl shadow flex items-center justify-center border border-white/20"
                      style={{ background: customPalette?.primary || theme.accent }}
                    />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Cor de Destaque</p>
                      <p className="text-xs font-mono font-bold" style={{ color: theme.textPrimary }}>
                        {(customPalette?.primary || theme.accent).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Tipografia */}
                  <div
                    className="p-4 rounded-2xl border flex items-center gap-3.5"
                    style={{ background: theme.inputBg, borderColor: theme.border }}
                  >
                    <span
                      className="text-lg font-black"
                      style={{
                        color: customPalette?.primary || theme.accent,
                        fontFamily: fontStyle === 'serif' ? "'Playfair Display', Georgia, serif" : "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      Aa
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Tipografia dos Títulos</p>
                      <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                        {fontStyle === 'serif' ? 'Playfair (Clássico)' : 'Plus Jakarta (Moderno)'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Informações da Marca */}
              <div className="p-5 rounded-2xl border space-y-4" style={{ background: theme.inputBg, borderColor: theme.border }}>
                <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: theme.textPrimary }}>
                  <Building2 className="w-4 h-4" style={{ color: theme.accent }} />
                  Informações da Marca & Idioma
                </h4>

                {/* Tipo de Negócio */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    Tipo de Negócio / Segmento
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'barbearia', label: 'Barbearia', icon: <Scissors className="w-5 h-5" />, desc: 'Cortes, barba e navalha' },
                      { id: 'salao', label: 'Salão de Beleza', icon: <Sparkles className="w-5 h-5" />, desc: 'Cabelo, estética e coloração' },
                      { id: 'esmalteria', label: 'Esmalteria / Nails', icon: <Palette className="w-5 h-5" />, desc: 'Manicure, pedicure e unhas' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBusinessType(item.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${businessType === item.id ? 'ring-2 ring-[#DE870D]' : ''
                          }`}
                        style={{
                          background: businessType === item.id ? `${theme.accent}15` : theme.inputBg,
                          borderColor: businessType === item.id ? theme.accent : theme.border,
                          color: theme.textPrimary,
                        }}
                      >
                        <span className="p-1.5 rounded-lg shrink-0" style={{ background: businessType === item.id ? `${theme.accent}25` : `${theme.accent}10`, color: theme.accent }}>
                          {item.icon}
                        </span>
                        <div>
                          <p className="text-xs font-bold">{item.label}</p>
                          <p className="text-[10px] opacity-70 leading-tight mt-0.5">{item.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={fantasyName}
                      onChange={e => setFantasyName(e.target.value)}
                      className="themed-input"
                      placeholder="Nome do seu salão"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                      Slogan / Subtítulo
                    </label>
                    <input
                      type="text"
                      value={slogan}
                      onChange={e => setSlogan(e.target.value)}
                      className="themed-input"
                      placeholder="Ex: O melhor corte e barba da cidade"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <span>Sobre o Salão</span>
                    <span style={{ color: description.length > 180 ? theme.error : theme.textMuted }}>{description.length}/180</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value.slice(0, 180))}
                    rows={3}
                    className="themed-input resize-none"
                    placeholder="Conte a história do seu espaço..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <Globe className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" style={{ color: theme.accent }} />
                    Idioma Padrão do Salão
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="themed-input w-full sm:w-auto"
                  >
                    <option value="pt">🇧🇷 Português (Brasil)</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="de">🇩🇪 Deutsch</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB 3: CONTATO ═════════════════════════════════ */}
          {activeTab === 'contato' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Phone className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Contato & Redes Sociais
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Informações exibidas na sua página pública.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      <WhatsAppIcon className="w-3.5 h-3.5" style={{ color: '#25D366' }} /> WhatsApp Agendamento
                    </label>
                    {phoneCheckStatus === 'checking' && (
                      <span className="text-[10px] text-[#DE870D] font-bold">Verificando...</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={handleWhatsappChange}
                    className={`themed-input ${phoneCheckStatus === 'valid'
                      ? 'border-green-500 text-green-800'
                      : phoneCheckStatus === 'taken' || phoneCheckStatus === 'invalid'
                        ? 'border-red-500 text-red-700'
                        : ''
                      }`}
                    placeholder="(27) 99730-3135"
                  />
                  {phoneFeedback && (
                    <p className={`text-[11px] mt-1 font-semibold flex items-center gap-1 ${phoneCheckStatus === 'valid'
                      ? 'text-green-600'
                      : 'text-red-500'
                      }`}>
                      {phoneCheckStatus === 'valid' ? <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" /> : '⚠️'} {phoneFeedback}
                    </p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <Mail className="w-3.5 h-3.5" /> E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="themed-input"
                    placeholder="contato@salao.com"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <InstagramIcon className="w-3.5 h-3.5" /> Instagram (@)
                  </label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    className="themed-input"
                    placeholder="arroba_do_salao"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <FacebookIcon className="w-3.5 h-3.5" /> Facebook
                  </label>
                  <input
                    type="text"
                    value={facebook}
                    onChange={e => setFacebook(e.target.value)}
                    className="themed-input"
                    placeholder="URL do Facebook"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <Globe className="w-3.5 h-3.5" /> Website Oficial
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    className="themed-input"
                    placeholder="https://seusite.com.br"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB NOTIFICAÇÕES ═══════════════════════════ */}
          {activeTab === 'notificacoes' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Bell className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Central de Notificações
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Configure como você deseja ser avisado sobre novos agendamentos e cancelamentos.
                </p>
              </div>

              <div className="p-4 rounded-xl border transition-colors" style={{ background: theme.inputBg, borderColor: theme.border }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Aviso Sonoro</p>
                    <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Tocar um som discreto ao receber um novo agendamento ou cancelamento na sua tela.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: soundEnabled ? theme.accent : theme.textMuted }}></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB 4: LOCALIZAÇÃO ═════════════════════════════ */}
          {activeTab === 'local' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <MapPin className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Localização do Estabelecimento
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  O endereço e mapa serão exibidos na sua página pública.
                </p>
              </div>

              {/* CEP + Rua + Número */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>CEP</label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setZipCode(val);
                      if (val.length === 8) lookupCep(val);
                    }}
                    className="themed-input"
                    placeholder="00000000"
                    maxLength={8}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Rua / Logradouro</label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    className="themed-input"
                    placeholder="Ex: Av. Paulista ou Rua das Flores"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Número</label>
                  <input
                    type="text"
                    value={streetNumber}
                    onChange={e => setStreetNumber(e.target.value)}
                    className="themed-input"
                    placeholder="123"
                  />
                </div>
              </div>

              {/* Complemento + Bairro + Cidade + Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Complemento</label>
                  <input
                    type="text"
                    value={complement}
                    onChange={e => setComplement(e.target.value)}
                    className="themed-input"
                    placeholder="Sala 2, Bloco B..."
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Bairro</label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    className="themed-input"
                    placeholder="Centro"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="themed-input"
                    placeholder="São Paulo"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Estado</label>
                  <input
                    type="text"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="themed-input"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>

              {/* Link Google Maps */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                  Link do Google Maps
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={mapLink}
                    onChange={e => setMapLink(e.target.value)}
                    className="themed-input pr-10"
                    placeholder="Cole o link curto do Google Maps aqui (opcional)"
                  />
                  {mapLinkStatus === 'resolving' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#C9963B]" />
                    </div>
                  )}
                  {mapLinkStatus === 'resolved' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                </div>
                {resolvedPlaceName && (
                  <p className="text-[11px] mt-1.5 font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Local identificado: {resolvedPlaceName} {latitude && longitude ? `(${latitude.toFixed(4)}, ${longitude.toFixed(4)})` : ''}
                  </p>
                )}
                <p className="text-[10px] mt-1 font-medium" style={{ color: theme.textMuted }}>
                  Coloque o link do Google para uma localização mais precisa (Ex: https://maps.app.goo.gl/...)
                </p>
              </div>

              {/* Map Preview */}
              {(() => {
                const queryAddress = [streetAddress, streetNumber ? `nº ${streetNumber}` : '', neighborhood, city, state, zipCode, 'Brasil'].filter(Boolean).join(', ');
                let embedUrl = '';

                // 1. If explicit iframe embed code was pasted
                if (mapLink && mapLink.includes('<iframe')) {
                  const match = mapLink.match(/src="([^"]+)"/);
                  if (match) embedUrl = match[1];
                }
                // 2. Direct embed url
                else if (mapLink && (mapLink.includes('output=embed') || mapLink.includes('google.com/maps/embed'))) {
                  embedUrl = mapLink;
                }
                // 3. Coordenadas exatas identificadas (via resolução ou GPS) -> Precisão Máxima
                else if (latitude && longitude) {
                  embedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
                }
                // 4. Extração direta de coordenadas se o link contiver @lat,lng, !3d!4d ou q=lat,lng
                else if (mapLink && (mapLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || mapLink.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/))) {
                  const coordMatch = mapLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || mapLink.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
                  if (coordMatch) {
                    embedUrl = `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
                  }
                }
                // 5. Busca de alta precisão por endereço completo com número, bairro, cidade e CEP
                else if (queryAddress) {
                  embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(queryAddress)}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
                }
                // 6. Link genérico de fallback
                else if (mapLink && mapLink.trim().startsWith('http')) {
                  embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapLink.trim())}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
                }

                if (!embedUrl) return null;

                const directLink = (mapLink && mapLink.trim().startsWith('http'))
                  ? mapLink.trim()
                  : (queryAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryAddress)}` : null);

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                        Pré-visualização do Mapa
                      </p>
                      {directLink && (
                        <a
                          href={directLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          style={{ color: theme.accent }}
                        >
                          Abrir link oficial no Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: theme.border, height: '220px' }}>
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={embedUrl}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══════════════════════════ TAB: RECEBIMENTOS & PAGAMENTOS ══════════════════════════ */}
          {activeTab === 'stripe' && (
            <div className="space-y-6">
              {/* 1. Card Principal: Stripe Connect com Selo Verde de Segurança */}
              {(() => {
                const hasStripeAccount = Boolean(stripeConnectInfo?.stripe_account_id);
                const isFullyActive = stripeConnectInfo?.charges_enabled === true;

                return (
                  <div
                    className="rounded-2xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                    style={{
                      background: hasStripeAccount ? `${theme.accent}08` : theme.inputBg,
                      borderColor: hasStripeAccount ? `${theme.accent}30` : theme.inputBorder,
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Logo Oficial do Stripe */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: '#635BFF18',
                          color: '#635BFF',
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                        </svg>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                            Conta Stripe Connect
                          </h4>
                          {/* Selo Verde de Segurança e Confiabilidade */}
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" /> 100% Seguro & Confiável
                          </span>
                          {isFullyActive ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              ✓ Conectada & Ativa
                            </span>
                          ) : hasStripeAccount ? (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              ✓ Conectada
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Não Conectada
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-1 leading-relaxed font-medium" style={{ color: theme.textSecondary }}>
                          {hasStripeAccount
                            ? `Recebimentos online com proteção antifraude e repasse direto na sua conta Stripe (${stripeConnectInfo?.stripe_account_id || ''})`
                            : 'Conecte sua conta para receber pagamentos online (Pix e cartão) direto dos clientes com total segurança.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                      {hasStripeAccount ? (
                        <>
                          <button
                            type="button"
                            onClick={() => syncConnectStatus(false)}
                            disabled={syncingConnect}
                            className="p-2.5 rounded-xl border hover:opacity-80 transition-opacity cursor-pointer"
                            style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textSecondary }}
                            title="Verificar status atualizado"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncingConnect ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={handleConnectStripe}
                            disabled={isConnectingStripe}
                            className="px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:opacity-90 flex items-center gap-1.5"
                            style={{ borderColor: theme.border, background: theme.cardBg, color: theme.textPrimary }}
                          >
                            {isConnectingStripe ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Abrindo...</span>
                              </>
                            ) : (
                              <span>Painel Stripe</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisconnectStripeModalOpen(true)}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all cursor-pointer"
                            title="Desconectar conta Stripe"
                          >
                            Desconectar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConnectStripe}
                          disabled={isConnectingStripe}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-white shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-80"
                          style={{ background: '#635BFF' }}
                        >
                          {isConnectingStripe ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Conectando ao Stripe...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>Conectar com Stripe</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Formas de Pagamento no Agendamento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm" style={{ color: theme.textPrimary }}>
                    Opções de Pagamento para o Cliente
                  </h3>
                  <span className="text-[11px]" style={{ color: theme.textMuted }}>
                    Pelo menos uma opção ativa
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(() => {
                    const hasStripeAccount = Boolean(stripeConnectInfo?.stripe_account_id);

                    return [
                      {
                        key: 'local' as const,
                        label: 'Pagar no Local',
                        desc: 'Pagamento presencial no salão após o atendimento',
                        state: allowLocal,
                        isLocked: false,
                        set: setAllowLocal,
                      },
                      {
                        key: 'deposit' as const,
                        label: 'Sinal / Entrada Online',
                        desc: 'Exige percentual antecipado para garantir o horário',
                        state: allowDeposit,
                        isLocked: !hasStripeAccount,
                        set: setAllowDeposit,
                      },
                      {
                        key: 'full' as const,
                        label: '100% Antecipado Online',
                        desc: 'Valor integral pago online na hora do agendamento',
                        state: allowFull,
                        isLocked: !hasStripeAccount,
                        set: setAllowFull,
                      },
                    ].map(m => {
                      const activeCount = [allowLocal, allowDeposit, allowFull].filter(Boolean).length;
                      const isLastActive = m.state && activeCount === 1;

                      return (
                        <div
                          key={m.key}
                          onClick={() => {
                            if (m.isLocked) {
                              setStripeRequiredModalOpen(true);
                            }
                          }}
                          className={`p-4 rounded-xl border transition-all ${m.isLocked ? 'opacity-70 cursor-pointer hover:border-amber-500/40' : ''}`}
                          style={{
                            background: m.state && !m.isLocked ? `${theme.accent}0d` : theme.inputBg,
                            borderColor: m.state && !m.isLocked ? theme.accent : theme.inputBorder,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                                  {m.label}
                                </span>
                                {m.isLocked && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Requer Stripe
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                                {m.desc}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (m.isLocked) {
                                  setStripeRequiredModalOpen(true);
                                  return;
                                }
                                if (isLastActive) return;
                                m.set(!m.state);
                              }}
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4 cursor-pointer"
                              style={{ background: m.state && !m.isLocked ? theme.accent : theme.border }}
                            >
                              <span
                                className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                style={{ transform: m.state && !m.isLocked ? 'translateX(22px)' : 'translateX(4px)' }}
                              />
                            </button>
                          </div>

                          {/* Slider for deposit percentage */}
                          <AnimatePresence>
                            {m.key === 'deposit' && m.state && !m.isLocked && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 pt-3 border-t flex flex-col gap-2"
                                style={{ borderColor: theme.inputBorder }}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span style={{ color: theme.textSecondary }}>
                                    Valor da entrada: <strong style={{ color: theme.accent }}>{depositPercentage}%</strong>
                                  </span>
                                  <span style={{ color: theme.textMuted }}>
                                    Restante ({100 - depositPercentage}%) pago no salão
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={90}
                                  step={5}
                                  value={depositPercentage}
                                  onChange={(e) => setDepositPercentage(Number(e.target.value))}
                                  className="w-full cursor-pointer"
                                  style={{ accentColor: theme.accent }}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB 6: HORÁRIOS ════════════════════════════════ */}
          {activeTab === 'horarios' && (
            <div className="space-y-6">
              <FeatureGate permission="agenda.bloquear_horario" inline>
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Clock className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Horário de Funcionamento
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Defina os dias e horários de atendimento. Clientes só poderão agendar dentro destes horários.
                </p>
              </div>

              <div className="space-y-3">
                {businessHours.map((bh, idx) => (
                  <div
                    key={bh.weekday}
                    className="rounded-2xl p-4 transition-all"
                    style={{
                      background: bh.is_open ? theme.inputBg : `${theme.inputBg}60`,
                      border: `1px solid ${bh.is_open ? (theme.id === 'elegant' ? '#E2E8F0' : theme.inputBorder) : theme.border}`,
                      opacity: bh.is_open ? 1 : 0.65,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...businessHours];
                            updated[idx].is_open = !updated[idx].is_open;
                            setBusinessHours(updated);
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer"
                          style={{
                            background: bh.is_open
                              ? (customPalette?.primary || theme.accent)
                              : (theme.id === 'elegant' ? '#CBD5E1' : '#2A2A2A')
                          }}
                        >
                          <span
                            className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                            style={{ transform: bh.is_open ? 'translateX(22px)' : 'translateX(4px)' }}
                          />
                        </button>
                        <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                          {WEEKDAY_NAMES[bh.weekday]}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border"
                        style={{
                          background: bh.is_open ? `${theme.success}15` : `${theme.error}15`,
                          borderColor: bh.is_open ? `${theme.success}30` : `${theme.error}30`,
                          color: bh.is_open ? theme.success : theme.error,
                        }}
                      >
                        {bh.is_open ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>

                    {bh.is_open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t"
                        style={{ borderColor: theme.border }}
                      >
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: theme.textSecondary }}>Abre</label>
                          <input
                            type="time"
                            value={bh.open_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].open_time = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2 px-3 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: theme.textSecondary }}>Fecha</label>
                          <input
                            type="time"
                            value={bh.close_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].close_time = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2 px-3 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: theme.textMuted }}>Almoço Início</label>
                          <input
                            type="time"
                            value={bh.lunch_start}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].lunch_start = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2 px-3 opacity-90"
                            placeholder="--:--"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: theme.textMuted }}>Almoço Fim</label>
                          <input
                            type="time"
                            value={bh.lunch_end}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].lunch_end = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2 px-3 opacity-90"
                            placeholder="--:--"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
              </FeatureGate>
            </div>
          )}

          {/* ═══════════════════════════ TAB 7: POLÍTICAS DE AGENDAMENTO ═════════════════ */}
          {activeTab === 'politicas' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Shield className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Políticas de Agendamento
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Configure as regras de atendimento, domicílio, cancelamentos e reagendamentos.
                </p>
              </div>

              {/* ─── Atendimento a Domicílio (PRIMEIRO) ──────────────────────────────────── */}
              {/* Reagendamento */}
              <div className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Permitir Reagendamento</h4>
                    <p className="text-xs" style={{ color: theme.textMuted }}>O cliente pode reagendar sozinho pelo portal?</p>
                  </div>
                  <button
                    onClick={() => setAllowReschedule(!allowReschedule)}
                    className="relative w-12 h-6 rounded-full transition-all"
                    style={{ background: allowReschedule ? theme.success : theme.border }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                      style={{ left: allowReschedule ? '26px' : '4px' }}
                    />
                  </button>
                </div>

                {allowReschedule && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                    <div>
                      <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                        Prazo máximo (Horas de antecedência)
                      </label>
                      <select
                        value={rescheduleDeadlineHours}
                        onChange={(e) => setRescheduleDeadlineHours(Number(e.target.value))}
                        className="themed-input w-full"
                      >
                        <option value={2}>Até 2 horas antes</option>
                        <option value={6}>Até 6 horas antes</option>
                        <option value={12}>Até 12 horas antes</option>
                        <option value={24}>Até 24 horas antes</option>
                        <option value={48}>Até 48 horas antes</option>
                        <option value={72}>Até 72 horas antes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancelamento, Atraso e No-Show */}
              <div className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Permitir Cancelamento Pelo Portal</h4>
                    <p className="text-xs" style={{ color: theme.textMuted }}>O cliente pode cancelar sozinho pelo portal?</p>
                  </div>
                  <button
                    onClick={() => setAllowCancel(!allowCancel)}
                    className="relative w-12 h-6 rounded-full transition-all"
                    style={{ background: allowCancel ? theme.success : theme.border }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                      style={{ left: allowCancel ? '26px' : '4px' }}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: theme.border }}>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                      Cancelamento Grátis até (Horas antes)
                    </label>
                    <select
                      value={cancelFreeHoursBefore}
                      onChange={(e) => setCancelFreeHoursBefore(Number(e.target.value))}
                      className="themed-input w-full"
                    >
                      <option value={1}>1 hora antes</option>
                      <option value={2}>2 horas antes</option>
                      <option value={6}>6 horas antes</option>
                      <option value={12}>12 horas antes</option>
                      <option value={24}>24 horas antes</option>
                      <option value={48}>48 horas antes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                      Multa de Cancelamento Tardio (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={cancelFeePercent}
                      onChange={e => setCancelFeePercent(Number(e.target.value))}
                      className="themed-input w-full"
                      placeholder="Ex: 50%"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                      Tolerância de Atraso (Minutos)
                    </label>
                    <select
                      value={delayToleranceMinutes}
                      onChange={(e) => setDelayToleranceMinutes(Number(e.target.value))}
                      className="themed-input w-full"
                    >
                      <option value={5}>5 minutos</option>
                      <option value={10}>10 minutos</option>
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                      Multa de No-Show (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={noshowFeePercent}
                      onChange={e => setNoshowFeePercent(Number(e.target.value))}
                      className="themed-input w-full"
                      placeholder="Ex: 100%"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RADIUS MAP MODAL ── */}


          {/* ═══════════════════════════ TAB: STATUS DA CONTA ════════════════════════════ */}
          {activeTab === 'conta' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <ShieldCheck className="w-5 h-5 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Status da Conta & Assinatura
                </h3>
                <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>
                  Acompanhe a situação do seu estabelecimento, plano contratado e faturamento.
                </p>
              </div>

              {/* Status Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Situação da Empresa */}
                <div className="p-5 rounded-2xl border space-y-2" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      Situação do Estabelecimento
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${tenant?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      tenant?.status === 'trial' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {tenant?.status === 'active' ? 'Ativo' : tenant?.status === 'trial' ? 'Em Período de Testes' : tenant?.status || 'Ativo'}
                    </span>
                  </div>
                  <h4 className="font-bold text-base truncate" style={{ color: theme.textPrimary }}>
                    {tenant?.name || 'Seu Estabelecimento'}
                  </h4>
                  <p className="text-xs font-mono" style={{ color: theme.textMuted }}>
                    raffros.com/{tenant?.slug}
                  </p>
                </div>

                {/* 2. Plano Contratado */}
                <div className="p-5 rounded-2xl border space-y-2" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      Plano Atual
                    </span>
                    <Crown className="w-4 h-4" style={{ color: theme.accent }} />
                  </div>
                  <h4 className="font-bold text-base uppercase" style={{ color: theme.accent }}>
                    {engine.defaultPlan?.name || 'Plano Starter'}
                  </h4>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    {engine.getPlanLimit('profissionais') === 'unlimited' ? 'Profissionais ilimitados' : `Até ${engine.getPlanLimit('profissionais')} ${engine.getPlanLimit('profissionais') === 1 ? 'profissional' : 'profissionais'}`} • {engine.hasFeature('produtos') ? 'Produtos liberados' : 'Apenas Serviços'}
                  </p>
                </div>

                {/* 3. Status da Assinatura */}
                <div className="p-5 rounded-2xl border space-y-2" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      Faturamento & Assinatura
                    </span>
                    <CreditCard className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="font-bold text-base" style={{ color: theme.textPrimary }}>
                    {subInfo?.status === 'active' ? 'Assinatura Ativa (Stripe)' :
                      subInfo?.status === 'trial' ? 'Período de Testes (Trial)' :
                        subInfo?.status === 'canceled' ? 'Cancelada (Sem novas cobranças)' :
                          'Assinatura Regularizada'}
                  </h4>
                  <p className="text-xs font-mono truncate" style={{ color: theme.textMuted }}>
                    {subInfo?.stripe_subscription_id ? `ID: ${subInfo.stripe_subscription_id}` : 'Cobrança via Stripe Billing'}
                  </p>
                </div>

                {/* 4. Ciclo e Próxima Fatura */}
                <div className="p-5 rounded-2xl border space-y-2" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      Ciclo / Próxima Fatura
                    </span>
                    <CalendarCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-base" style={{ color: theme.textPrimary }}>
                    {subInfo?.current_period_end ?
                      new Date(subInfo.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) :
                      subInfo?.trial_ends_at ?
                        `Fim do trial: ${new Date(subInfo.trial_ends_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}` :
                        'Renovação Automática'}
                  </h4>
                  <p className="text-xs text-emerald-400 font-medium">
                    {subInfo?.status === 'canceled' ? '✓ Nenhuma cobrança futura será feita' : 'Pagamento processado com segurança'}
                  </p>
                </div>

                {/* 5. Recebimento de Pagamentos Online (Stripe Connect) */}
                <div className="p-5 rounded-2xl border space-y-3 sm:col-span-2" style={{ background: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center font-bold">
                        <StripeIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#635BFF]">
                        Recebimento Online (Stripe Connect)
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${stripeConnectInfo?.charges_enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : stripeConnectInfo?.stripe_account_id
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                      }`}>
                      {stripeConnectInfo?.charges_enabled ? 'Habilitado (Ao Vivo)' : stripeConnectInfo?.stripe_account_id ? 'Em Análise / Pendente' : 'Não Conectado'}
                    </span>
                  </div>
                  <h4 className="font-bold text-base" style={{ color: theme.textPrimary }}>
                    {stripeConnectInfo?.charges_enabled
                      ? 'Conta Bancária Vinculada & Ativa'
                      : stripeConnectInfo?.stripe_account_id
                        ? 'Verificação Bancária Pendente'
                        : 'Pagamentos Online Desativados'}
                  </h4>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    {stripeConnectInfo?.charges_enabled
                      ? 'Seu salão está habilitado a receber pagamentos online (Pix, Cartão) diretamente na sua conta bancária.'
                      : stripeConnectInfo?.stripe_account_id
                        ? 'Conclua o envio dos seus documentos bancários na aba "Recebimentos & Pagamentos" para liberar cobranças online.'
                        : 'Conecte sua conta Stripe na aba "Recebimentos & Pagamentos" para cobrar reservas antecipadas dos seus clientes.'}
                  </p>
                  {!stripeConnectInfo?.charges_enabled && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('stripe')}
                        className="px-4 py-2 text-xs font-bold rounded-xl text-white transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] bg-[#635BFF] hover:bg-[#5349e4]"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        {stripeConnectInfo?.stripe_account_id ? 'Completar Verificação Stripe' : 'Conectar Conta Stripe'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção de Gerenciamento da Assinatura (Stripe Billing) */}
              <div className="p-5 rounded-2xl border space-y-4 mt-6" style={{ background: theme.cardBg, borderColor: theme.border }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center font-bold">
                        <StripeIcon className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                        Gerenciamento de Cobrança & Faturamento (Stripe)
                      </h4>
                    </div>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      Acesse o portal oficial do Stripe para atualizar cartão de crédito, baixar notas fiscais ou gerenciar sua assinatura com total segurança.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenCustomerPortal}
                      disabled={portalLoading}
                      className="px-4 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] shadow-sm disabled:opacity-50"
                      style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                    >
                      <StripeIcon className="w-3.5 h-3.5 text-[#635BFF]" />
                      {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" style={{ color: theme.accent }} />}
                      {portalLoading ? 'Abrindo...' : 'Acessar Portal do Stripe'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Seção de Encerramento de Conta */}
              <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3 mt-6">
                <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span>Encerramento da Conta</span>
                </div>
                <p className="text-xs text-[#888] leading-relaxed">
                  Caso queira encerrar sua conta definitivamente, clique no botão abaixo. <strong>O sistema cancelará imediatamente sua assinatura no Stripe</strong> para que você <strong>nunca receba novas cobranças</strong> no seu cartão de crédito, e seu estabelecimento será desativado.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setDeleteAccountModalOpen(true)}
                    className="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Minha Conta
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Cancel Subscription Modal */}
      {cancelSubModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1a1a1a]">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-center text-white mb-2">Cancelar Assinatura?</h3>
              <p className="text-sm text-[#888] text-center leading-relaxed">
                Ao cancelar, sua assinatura permanecerá ativa até o encerramento do ciclo já pago. Após esse período, seu salão será <strong>bloqueado automaticamente</strong> e você não receberá nenhuma nova cobrança.
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-bold text-[#888] mb-2">
                Para confirmar o cancelamento, digite <strong className="text-amber-400">CANCELAR</strong> abaixo:
              </label>
              <input
                type="text"
                value={cancelConfirmationText}
                onChange={(e) => setCancelConfirmationText(e.target.value)}
                className="w-full px-4 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl text-white outline-none focus:border-amber-500 transition-colors uppercase font-mono"
                placeholder="CANCELAR"
                onPaste={e => e.preventDefault()}
              />
            </div>

            <div className="border-t border-[#1a1a1a] p-4 flex justify-end gap-3 bg-[#0a0a0a]">
              <button
                type="button"
                onClick={() => {
                  setCancelSubModalOpen(false);
                  setCancelConfirmationText('');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#888] hover:text-white transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelConfirmationText !== 'CANCELAR' || cancelSubLoading}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2"
              >
                {cancelSubLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteAccountModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1a1a1a]">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center text-white mb-2">Excluir Conta Permanentemente?</h3>
              <p className="text-sm text-[#888] text-center">
                Esta ação <strong>cancelará imediatamente</strong> qualquer assinatura ativa no Stripe e revogará seu acesso ao sistema. O histórico será mantido apenas para fins de auditoria.
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-bold text-[#888] mb-2">
                Para confirmar, digite <strong className="text-white">EXCLUIR</strong> abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-4 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl text-white outline-none focus:border-red-500 transition-colors uppercase font-mono"
                placeholder="EXCLUIR"
                onPaste={e => e.preventDefault()}
              />
            </div>

            <div className="border-t border-[#1a1a1a] p-4 flex justify-end gap-3 bg-[#0a0a0a]">
              <button
                onClick={() => {
                  setDeleteAccountModalOpen(false);
                  setDeleteConfirmationText('');
                }}
                className="px-4 py-2 text-sm text-[#888] hover:text-white transition-colors"
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== 'EXCLUIR' || deleteLoading}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteLoading ? 'Excluindo...' : 'Sim, Excluir Minha Conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ STUDIO DE IDENTIDADE VISUAL (POP-UP MODAL) ════════════════════════════════ */}
      <AnimatePresence>
        {isCustomizerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 md:p-6 pb-6 pt-16 bg-black/80 backdrop-blur-md overflow-hidden touch-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl h-full sm:h-auto max-h-[85dvh] sm:max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden overscroll-contain mt-auto sm:mt-0"
              style={{
                background: theme.cardBg,
                borderColor: theme.cardBorder,
              }}
            >
              {/* Modal Header */}
              <div
                className="px-5 sm:px-6 py-4 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0"
                    style={{ background: customPalette?.primary || theme.accent, color: theme.btnPrimaryText }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold" style={{ color: theme.textPrimary }}>
                      Studio de Identidade Visual
                    </h3>
                    <p className="text-xs hidden sm:block" style={{ color: theme.textSecondary }}>
                      Personalize atmosfera, cores e tipografia com prévia ao vivo. Só muda no sistema ao clicar em salvar.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomizerOpen(false)}
                  className="p-2 rounded-xl transition-all hover:opacity-80 cursor-pointer"
                  style={{ background: theme.inputBg, color: theme.textSecondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - 2 Columns */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* ── Left Column: Controls (Spacious & Clean) ── */}
                <div className="lg:col-span-7 space-y-6">
                  {/* 1. Atmosfera */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider mb-2.5" style={{ color: theme.textSecondary }}>
                      1. Atmosfera do Salão (Fundo)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Modo Noturno */}
                      <button
                        type="button"
                        onClick={() => handleToggleBgMode('dark')}
                        className="flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] cursor-pointer"
                        style={{
                          background: bgMode === 'dark' ? '#09090B' : theme.inputBg,
                          borderColor: bgMode === 'dark' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: bgMode === 'dark' ? `0 0 18px ${(customPalette?.primary || theme.accent)}30` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{
                              background: bgMode === 'dark' ? `${customPalette?.primary || theme.accent}20` : theme.bg,
                              color: bgMode === 'dark' ? (customPalette?.primary || theme.accent) : theme.textSecondary,
                            }}
                          >
                            <Moon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: bgMode === 'dark' ? '#FFFFFF' : theme.textPrimary }}>
                              Modo Noturno / Escuro
                            </p>
                            <p className="text-[11px]" style={{ color: bgMode === 'dark' ? '#A1A1AA' : theme.textMuted }}>
                              Fundo escuro luxuoso
                            </p>
                          </div>
                        </div>
                        {bgMode === 'dark' && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow shrink-0" style={{ background: customPalette?.primary || theme.accent }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>

                      {/* Modo Claro */}
                      <button
                        type="button"
                        onClick={() => handleToggleBgMode('light')}
                        className="flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] cursor-pointer"
                        style={{
                          background: bgMode === 'light' ? '#FFFFFF' : theme.inputBg,
                          borderColor: bgMode === 'light' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: bgMode === 'light' ? `0 0 18px ${(customPalette?.primary || theme.accent)}30` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{
                              background: bgMode === 'light' ? `${customPalette?.primary || theme.accent}20` : theme.bg,
                              color: bgMode === 'light' ? (customPalette?.primary || theme.accent) : theme.textSecondary,
                            }}
                          >
                            <Sun className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: bgMode === 'light' ? '#0F172A' : theme.textPrimary }}>
                              Modo Claro / Diurno
                            </p>
                            <p className="text-[11px]" style={{ color: bgMode === 'light' ? '#64748B' : theme.textMuted }}>
                              Fundo claro acetinado
                            </p>
                          </div>
                        </div>
                        {bgMode === 'light' && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow shrink-0" style={{ background: customPalette?.primary || theme.accent }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 2. Cor de Destaque da Marca */}
                  <div className="pt-3 border-t" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                          2. Cor Principal da Marca (Destaque)
                        </label>
                        <p className="text-[11px]" style={{ color: theme.textMuted }}>
                          A cor que destaca seus botões e cartões
                        </p>
                      </div>

                      {(logoUrl || logoUpload.preview) && (
                        <button
                          type="button"
                          onClick={() => handleMagicExtract()}
                          disabled={isExtracting}
                          className="text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 cursor-pointer shadow-sm"
                          style={{ borderColor: theme.accent, color: theme.accent, background: `${theme.accent}12` }}
                        >
                          {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Re-extrair da logo
                        </button>
                      )}
                    </div>

                    {/* 2 Cores Sugeridas Inteligentes + Personalizar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Cor 1: Dourado Noir Clássico */}
                      {(() => {
                        const hex = '#C9963B';
                        const isActive = (customPalette?.primary || theme.accent).toUpperCase() === hex.toUpperCase();
                        return (
                          <button
                            key="noir-gold"
                            type="button"
                            onClick={() => handleSelectSwatchColor(hex)}
                            className="flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:scale-[1.02] cursor-pointer"
                            style={{
                              background: isActive ? `${hex}15` : theme.inputBg,
                              borderColor: isActive ? hex : theme.border,
                              boxShadow: isActive ? `0 0 16px ${hex}30` : 'none',
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full shadow flex items-center justify-center shrink-0" style={{ background: hex }}>
                                {isActive && <Check className="w-3 h-3 text-white" />}
                              </span>
                              <div>
                                <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>Dourado Noir</p>
                                <p className="text-[10px] font-mono" style={{ color: theme.textMuted }}>#C9963B</p>
                              </div>
                            </div>
                          </button>
                        );
                      })()}

                      {/* Cor 2: Azul Real / Cor da Marca */}
                      {(() => {
                        const hex = (customPalette?.primary && customPalette.primary.toUpperCase() !== '#C9963B')
                          ? customPalette.primary
                          : '#3B82F6';
                        const isCustomSelected = (customPalette?.primary || theme.accent).toUpperCase() === hex.toUpperCase() && hex.toUpperCase() !== '#C9963B';
                        return (
                          <button
                            key="brand-color"
                            type="button"
                            onClick={() => handleSelectSwatchColor(hex)}
                            className="flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:scale-[1.02] cursor-pointer"
                            style={{
                              background: isCustomSelected ? `${hex}15` : theme.inputBg,
                              borderColor: isCustomSelected ? hex : theme.border,
                              boxShadow: isCustomSelected ? `0 0 16px ${hex}30` : 'none',
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full shadow flex items-center justify-center shrink-0" style={{ background: hex }}>
                                {isCustomSelected && <Check className="w-3 h-3 text-white" />}
                              </span>
                              <div>
                                <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                                  {logoUrl || logoUpload.preview ? 'Cor da Logo' : 'Azul Moderno'}
                                </p>
                                <p className="text-[10px] font-mono" style={{ color: theme.textMuted }}>{hex}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })()}

                      {/* Cor 3: Seletor Livre */}
                      <label
                        className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                          background: theme.inputBg,
                          borderColor: theme.border,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            value={customPalette?.primary || theme.accent}
                            onChange={(e) => handleSelectSwatchColor(e.target.value)}
                            className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent shrink-0"
                          />
                          <div>
                            <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>Personalizar...</p>
                            <p className="text-[10px]" style={{ color: theme.textMuted }}>Qualquer tom</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 3. Tipografia */}
                  <div className="pt-3 border-t" style={{ borderColor: theme.border }}>
                    <label className="block text-xs font-extrabold uppercase tracking-wider mb-2.5" style={{ color: theme.textSecondary }}>
                      3. Estilo Tipográfico dos Títulos
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Playfair Display */}
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFontStyle('serif');
                          setCustomPalette((prev: any) => ({ ...(prev || {}), fontStyle: 'serif' }));
                        }}
                        className="flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:scale-[1.01]"
                        style={{
                          background: draftFontStyle === 'serif' ? (bgMode === 'dark' ? '#09090B' : '#FFFFFF') : theme.inputBg,
                          borderColor: draftFontStyle === 'serif' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: draftFontStyle === 'serif' ? `0 0 16px ${(customPalette?.primary || theme.accent)}25` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl font-serif font-bold" style={{ color: customPalette?.primary || theme.accent }}>Aa</span>
                          <div>
                            <p className="text-xs font-bold font-serif" style={{ color: theme.textPrimary }}>
                              Clássico & Elegante
                            </p>
                            <p className="text-[11px]" style={{ color: theme.textMuted }}>
                              Playfair Display refinada
                            </p>
                          </div>
                        </div>
                        {draftFontStyle === 'serif' && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow shrink-0" style={{ background: customPalette?.primary || theme.accent }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>

                      {/* Plus Jakarta Sans */}
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFontStyle('sans');
                          setCustomPalette((prev: any) => ({ ...(prev || {}), fontStyle: 'sans' }));
                        }}
                        className="flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:scale-[1.01]"
                        style={{
                          background: draftFontStyle === 'sans' ? (bgMode === 'dark' ? '#09090B' : '#FFFFFF') : theme.inputBg,
                          borderColor: draftFontStyle === 'sans' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: draftFontStyle === 'sans' ? `0 0 16px ${(customPalette?.primary || theme.accent)}25` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl font-sans font-black" style={{ color: customPalette?.primary || theme.accent }}>Aa</span>
                          <div>
                            <p className="text-xs font-bold font-sans" style={{ color: theme.textPrimary }}>
                              Moderno & Minimalista
                            </p>
                            <p className="text-[11px]" style={{ color: theme.textMuted }}>
                              Plus Jakarta Sans contemporânea
                            </p>
                          </div>
                        </div>
                        {draftFontStyle === 'sans' && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow shrink-0" style={{ background: customPalette?.primary || theme.accent }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Right Column: Interactive Live Device Preview ── */}
                <div className="lg:col-span-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: theme.textPrimary }}>
                      <Eye className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                      Prévia Ao Vivo
                    </p>

                    <div className="flex items-center p-1 rounded-xl border gap-1" style={{ background: theme.inputBg, borderColor: theme.border }}>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('public')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${previewMode === 'public' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                        style={{
                          background: previewMode === 'public' ? (customPalette?.primary || theme.accent) : 'transparent',
                          color: previewMode === 'public' ? theme.btnPrimaryText : theme.textSecondary,
                        }}
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Página
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('admin')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${previewMode === 'admin' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                        style={{
                          background: previewMode === 'admin' ? (customPalette?.primary || theme.accent) : 'transparent',
                          color: previewMode === 'admin' ? theme.btnPrimaryText : theme.textSecondary,
                        }}
                      >
                        <Laptop className="w-3.5 h-3.5" /> Painel
                      </button>
                    </div>
                  </div>

                  {/* Preview Canvas */}
                  {(() => {
                    const activeAccent = customPalette?.primary || theme.accent;
                    const isDarkPrev = bgMode === 'dark';
                    const prevBg = isDarkPrev ? '#0B0B0D' : '#F8FAFC';
                    const prevCardBg = isDarkPrev ? '#141416' : '#FFFFFF';
                    const prevBorder = isDarkPrev ? '#242427' : '#E2E8F0';
                    const prevTextPrimary = isDarkPrev ? '#FFFFFF' : '#0F172A';
                    const prevTextSecondary = isDarkPrev ? '#A1A1AA' : '#475569';
                    const prevTextMuted = isDarkPrev ? '#71717A' : '#94A3B8';
                    const prevFontFamily = draftFontStyle === 'serif' ? "'Playfair Display', Georgia, serif" : "'Plus Jakarta Sans', -apple-system, sans-serif";

                    const hex = activeAccent.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) || 201;
                    const g = parseInt(hex.substring(2, 4), 16) || 150;
                    const b = parseInt(hex.substring(4, 6), 16) || 59;
                    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    const prevBtnText = lum > 145 ? '#000000' : '#FFFFFF';

                    return (
                      <div
                        className="rounded-2xl border p-4 sm:p-5 transition-all shadow-inner overflow-hidden"
                        style={{
                          background: prevBg,
                          borderColor: prevBorder,
                        }}
                      >
                        {previewMode === 'public' ? (
                          /* Public Booking Mockup */
                          <div className="space-y-3.5">
                            <div className="rounded-2xl p-3.5 border relative overflow-hidden flex items-center justify-between gap-3"
                              style={{ background: prevCardBg, borderColor: prevBorder }}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-sm overflow-hidden"
                                  style={{
                                    background: logoUrl || logoUpload.preview ? (isDarkPrev ? '#1E1E22' : '#F1F5F9') : activeAccent,
                                    color: prevBtnText,
                                    fontFamily: prevFontFamily,
                                  }}
                                >
                                  {logoUrl || logoUpload.preview ? (
                                    <img
                                      src={logoUrl || logoUpload.preview || ''}
                                      alt="Logo"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    fantasyName ? fantasyName.charAt(0).toUpperCase() : 'N'
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h5
                                    className="font-bold text-sm truncate leading-tight"
                                    style={{
                                      color: prevTextPrimary,
                                      fontFamily: prevFontFamily,
                                    }}
                                  >
                                    {fantasyName || 'Nome da Barbearia'}
                                  </h5>
                                  <p className="text-[11px] truncate mt-0.5" style={{ color: prevTextSecondary }}>
                                    {slogan || 'O melhor atendimento da cidade'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0"
                                style={{ background: `${activeAccent}15`, borderColor: `${activeAccent}30`, color: activeAccent }}>
                                Aberto
                              </span>
                            </div>

                            <div className="rounded-2xl p-3.5 border flex items-center justify-between gap-3"
                              style={{ background: prevCardBg, borderColor: prevBorder }}>
                              <div>
                                <h6 className="font-bold text-xs leading-tight" style={{ color: prevTextPrimary, fontFamily: prevFontFamily }}>
                                  Corte Degradê & Barba
                                </h6>
                                <p className="text-[11px] mt-0.5" style={{ color: prevTextMuted }}>
                                  45 min • Individual
                                </p>
                                <p className="text-xs font-extrabold mt-1" style={{ color: activeAccent }}>
                                  R$ 65,00
                                </p>
                              </div>
                              <button
                                type="button"
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold shadow shrink-0"
                                style={{
                                  background: activeAccent,
                                  color: prevBtnText,
                                }}
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Admin Mockup */
                          <div className="space-y-3.5">
                            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: prevBorder }}>
                              <div>
                                <p className="text-[9px] uppercase font-extrabold tracking-widest" style={{ color: prevTextMuted }}>Painel do Salão</p>
                                <h5 className="font-bold text-sm mt-0.5" style={{ color: prevTextPrimary, fontFamily: prevFontFamily }}>
                                  Olá, {profile?.full_name?.split(' ')[0] || 'Dono'} 👋
                                </h5>
                              </div>
                              <div className="px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-sm"
                                style={{ background: activeAccent, color: prevBtnText }}>
                                + Agendar
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="rounded-xl p-2.5 border" style={{ background: prevCardBg, borderColor: prevBorder }}>
                                <p className="text-[9px] font-bold uppercase" style={{ color: prevTextMuted }}>Hoje</p>
                                <p className="text-base font-black mt-0.5" style={{ color: prevTextPrimary, fontFamily: prevFontFamily }}>R$ 480,00</p>
                                <p className="text-[9px] text-emerald-500 font-bold mt-0.5">+14%</p>
                              </div>
                              <div className="rounded-xl p-2.5 border" style={{ background: prevCardBg, borderColor: prevBorder }}>
                                <p className="text-[9px] font-bold uppercase" style={{ color: prevTextMuted }}>Ocupação</p>
                                <p className="text-base font-black mt-0.5" style={{ color: prevTextPrimary, fontFamily: prevFontFamily }}>85%</p>
                                <p className="text-[9px] font-bold mt-0.5" style={{ color: activeAccent }}>6 clientes</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                className="px-6 py-4 border-t flex items-center justify-between shrink-0"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <button
                  type="button"
                  onClick={() => setIsCustomizerOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border transition-all hover:opacity-80 cursor-pointer"
                  style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}
                >
                  Fechar sem Salvar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{
                    background: theme.btnPrimaryBg || theme.accent,
                    color: theme.btnPrimaryText,
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
          style={{
            background: saved ? theme.success : theme.accentGradient,
            color: saved ? '#fff' : theme.btnPrimaryText,
            boxShadow: saved ? 'none' : theme.shadowAccent,
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Salvando...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-5 h-5" /> Salvo com sucesso!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" /> Salvar Configurações
            </>
          )}
        </button>
      </div>

      {/* Stripe Connect Activation & Guided Choice Modal */}
      <StripeActivatedModal
        isOpen={showStripeActivatedModal}
        onClose={() => setShowStripeActivatedModal(false)}
        onConfirmChoice={handleStripeActivatedChoice}
      />

      {/* Modal Informativo: Stripe Necessário */}
      <AnimatePresence>
        {stripeRequiredModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setStripeRequiredModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4"
              style={{ background: theme.cardBg, borderColor: theme.border }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: '#635BFF20', color: '#635BFF' }}>
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                  Conexão com o Stripe Necessária
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                  Para habilitar pagamentos online (Pix e cartão de crédito direto dos seus clientes pelo seu site), você precisa conectar sua conta Stripe Connect.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStripeRequiredModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:opacity-80"
                  style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}
                >
                  Agora Não
                </button>
                <button
                  type="button"
                  disabled={isConnectingStripe}
                  onClick={() => {
                    setStripeRequiredModalOpen(false);
                    handleConnectStripe();
                  }}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:opacity-95 disabled:opacity-75"
                  style={{ background: '#635BFF' }}
                >
                  {isConnectingStripe ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <span>Conectar Conta</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Desconectar Stripe */}
      <AnimatePresence>
        {disconnectStripeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !disconnectingStripe && setDisconnectStripeModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-3xl p-6 border shadow-2xl z-10 space-y-4"
              style={{ background: theme.cardBg, borderColor: theme.border }}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                  Desconectar Conta Stripe?
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                  Ao desconectar, o recebimento de pagamentos online (Pix e cartão) será desativado. Seus clientes só poderão agendar com a opção <strong>"Pagar no Local"</strong>.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  disabled={disconnectingStripe}
                  onClick={() => setDisconnectStripeModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:opacity-80"
                  style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={disconnectingStripe}
                  onClick={handleDisconnectStripe}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:bg-red-700 bg-red-600 disabled:opacity-75"
                >
                  {disconnectingStripe ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Desconectando...</span>
                    </>
                  ) : (
                    <span>Sim, Desconectar</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Conta Excluída com Sucesso */}
      <AnimatePresence>
        {accountDeletedSuccess && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-md rounded-3xl p-8 border shadow-2xl z-10 text-center space-y-4"
              style={{ background: '#09090b', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto text-2xl border border-red-500/30">
                <Trash2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">
                  Conta Deletada com Sucesso!
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Seu salão, dados e assinaturas do Stripe foram permanentemente cancelados e excluídos.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>Voltando para a página inicial...</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── Modal: Upgrade Plan ── */}
      {showUpgradeModal && (
        <UpgradeModal 
          feature={showUpgradeModal}
          onClose={() => setShowUpgradeModal(null)}
        />
      )}

      {/* ── Modal: Image Cropper ── */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
        aspect={cropType === 'logo' ? 1 : 16 / 6}
        shape={cropType === 'logo' ? 'round' : 'rect'}
        title={cropType === 'logo' ? 'Ajustar Logo' : 'Ajustar Banner'}
      />
    </div>
  );
}

