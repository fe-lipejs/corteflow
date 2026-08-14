import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { usePhoneFormat } from '../../hooks/usePhoneFormat';
import { motion, AnimatePresence } from 'framer-motion';
import { generateSmartPaletteFromLogo, generatePaletteFromAccent } from '../../lib/colorExtractor';
import { useQueryClient } from '@tanstack/react-query';
import { PUBLIC_STORE_QUERY_KEY } from '../../hooks/usePublicStore';
import {
  Save, Check, Link as LinkIcon, Copy, ExternalLink, Image as ImageIcon,
  MapPin, Phone, Globe, Mail, Palette, Clock, CreditCard, Upload,
  Trash2, Eye, Settings2, Sparkles, Building2, X, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Shield, Bell, Wand2, RotateCcw,
  Sun, Moon, Smartphone, Laptop
} from 'lucide-react';

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const WhatsAppIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const TABS = [
  { id: 'aparencia', label: 'Aparência & Marca', icon: Palette },
  { id: 'stripe', label: 'Recebimentos & Pagamentos', icon: CreditCard },
  { id: 'contato', label: 'Contato', icon: Phone },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'politicas', label: 'Políticas', icon: Shield },
  { id: 'local', label: 'Localização', icon: MapPin },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Configuracoes() {
  const { tenant, profile, signOut, refreshProfile } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId, themeId, fontStyle, setFontStyle, setCustomPalette: setContextCustomPalette } = useTheme();
  const phoneFormat = usePhoneFormat(tenant?.language || 'pt');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('aparencia');
  
  // Danger Zone
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // ─── Form State ───────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>('pt');
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [customPalette, setCustomPalette] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState('local');
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

  // Financial Policies
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  const [paymentOptions, setPaymentOptions] = useState('both');
  const [allowRefunds, setAllowRefunds] = useState(true);
  const [refundPolicy, setRefundPolicy] = useState('full_refund_only');
  const [creditValidityDays, setCreditValidityDays] = useState(90);

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

  // Extracted palette & atmosphere states
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [bgMode, setBgMode] = useState<'dark' | 'light'>('dark');
  const [isExtracting, setIsExtracting] = useState(false);

  const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // ─── Load Settings ────────────────────────────────────────────────────────
  useEffect(() => {
    if (tenant) {
      setLanguage(tenant.language || 'pt');
      loadSettings();
    }
  }, [tenant]);

  const loadSettings = async () => {
    if (!tenant) return;
    setInitialLoading(true);

    try {
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
        setSlogan(data.slogan || '');
        setDescription(data.description || data.short_description || '');
        setLogoUrl(data.logo_url || '');
        setBannerUrl(data.banner_url || '');
        if (data.logo_url) logoUpload.setPreview(data.logo_url);
        if (data.banner_url) bannerUpload.setPreview(data.banner_url);
        setWhatsapp(data.whatsapp_number || '');
        setInstagram(data.instagram || '');
        setFacebook(data.facebook || '');
        setWebsite(data.website || '');
        setEmail(data.email || '');
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

        // Financial Policies
        setOnlinePaymentEnabled(data.online_payment_enabled ?? true);
        setPaymentOptions(data.payment_options || 'both');
        setAllowRefunds(data.allow_refunds ?? true);
        setRefundPolicy(data.refund_policy || 'full_refund_only');
        setCreditValidityDays(data.credit_validity_days ?? 90);
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
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  // ─── Slug Formatter & Real-Time Availability Checker ──────────────────────
  const formatSlug = (raw: string) => {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9-_]/g, '-')    // Converte caracteres inválidos em hífen
      .replace(/[-_]+/g, (m) => m[0])  // Remove duplicados mantendo o caractere
      .replace(/^[-_]+|[-_]+$/g, '');  // Remove no início e fim
  };

  const formatSlugWhileTyping = (raw: string) => {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-_]/g, '-');
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSlugWhileTyping(e.target.value);
    setSlug(formatted);
  };

  useEffect(() => {
    if (!tenant) return;
    const cleanSlug = slug.trim();
    if (!cleanSlug) {
      setSlugStatus('invalid');
      setSlugMessage('O link não pode ficar em branco.');
      return;
    }

    if (cleanSlug.length < 3) {
      setSlugStatus('invalid');
      setSlugMessage('O link deve ter no mínimo 3 caracteres alfanuméricos.');
      return;
    }

    if (cleanSlug === tenant.slug) {
      setSlugStatus('available');
      setSlugMessage('Este é o link oficial atual do seu salão.');
      return;
    }

    setSlugStatus('checking');
    setSlugMessage('Verificando se o link está disponível...');

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', cleanSlug)
          .neq('id', tenant.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSlugStatus('unavailable');
          setSlugMessage('Este link já está em uso por outro salão.');
        } else {
          setSlugStatus('available');
          setSlugMessage('Link disponível para uso imediato!');
        }
      } catch (err) {
        console.error('Erro ao verificar disponibilidade do link:', err);
        setSlugStatus('idle');
        setSlugMessage('');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [slug, tenant?.id, tenant?.slug]);

  // ─── Handle Image Upload ──────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !tenant) return;
    const url = await logoUpload.upload(e.target.files[0], `${tenant.id}/logo`);
    if (url) {
      setLogoUrl(url);
      // Auto-extract colors on upload
      handleMagicExtract(url, bgMode);
    }
  };

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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !tenant) return;
    const url = await bannerUpload.upload(e.target.files[0], `${tenant.id}/banner`);
    if (url) setBannerUrl(url);
  };

  const removeLogo = () => {
    setLogoUrl('');
    logoUpload.clearPreview();
  };

  const removeBanner = () => {
    setBannerUrl('');
    bannerUpload.clearPreview();
  };

  // ─── CEP Lookup (Brazil) ──────────────────────────────────────────────────
  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFullAddress(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`);
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
        setCountry('Brasil');
      }
    } catch (err) {
      console.error('ViaCEP error:', err);
    }
  };

  // ─── Handle Phone Formatting ──────────────────────────────────────────────
  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = phoneFormat.format(e.target.value);
    setWhatsapp(formatted);
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

      const cleanSlug = slug.trim() || tenant.slug;
      const cleanName = tenantName.trim() || fantasyName.trim() || tenant.name;

      // Update tenant name, slug and language
      const { error: tenantErr } = await (supabase as any)
        .from('tenants')
        .update({
          name: cleanName,
          slug: cleanSlug,
          language,
        })
        .eq('id', tenant.id);

      if (tenantErr) {
        if (tenantErr.code === '23505') {
          alert('Este link já está em uso por outro salão. Por favor, escolha outro link.');
          setLoading(false);
          return;
        }
        console.error('Erro ao atualizar dados do salão:', tenantErr);
      }

      i18n.changeLanguage(language);

      // Fix #2: Serialize individual payment toggles as JSON and validate
      const activeOptions = [allowLocal, allowDeposit, allowFull].filter(Boolean).length;
      if (activeOptions === 0) {
        alert('Pelo menos uma forma de pagamento deve estar ativa!');
        setLoading(false);
        return;
      }
      const paymentModeJson = { pay_local: allowLocal, partial_50: allowDeposit, full_100: allowFull };

      const finalPalette = customPalette ? { ...customPalette, fontStyle } : { fontStyle };

      // Build payload
      const payload: Record<string, any> = {
        tenant_id: tenant.id,
        theme_preset: selectedTheme,
        custom_palette: finalPalette,
        payment_methods: paymentModeJson,
        deposit_percentage: allowDeposit ? depositPercentage : null,
        fantasy_name: cleanName,
        slogan,
        description,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        whatsapp_number: whatsapp,
        instagram,
        facebook,
        website,
        email,
        full_address: fullAddress,
        zip_code: zipCode,
        street_number: streetNumber,
        complement,
        neighborhood,
        city,
        state,
        country,
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
        await supabase.from('tenant_settings').update(payload).eq('id', settingsId);
      } else {
        const { data } = await supabase.from('tenant_settings').insert([payload]).select().single();
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

        const { data: existing } = await supabase
          .from('business_hours')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('weekday', bh.weekday)
          .maybeSingle();

        if (existing) {
          await supabase.from('business_hours').update(hourPayload).eq('id', existing.id);
        } else {
          await supabase.from('business_hours').insert([hourPayload]);
        }
      }

      // Save notification settings
      const { data: notifData } = await supabase.from('notification_settings').select('id').eq('tenant_id', tenant.id).maybeSingle();
      if (notifData) {
        await supabase.from('notification_settings').update({ sound_enabled: soundEnabled }).eq('id', notifData.id);
      } else {
        await supabase.from('notification_settings').insert([{ tenant_id: tenant.id, sound_enabled: soundEnabled }]);
      }

      // Apply theme locally & globally across the whole admin
      setThemeId(selectedTheme);
      if (customPalette) {
        setContextCustomPalette(customPalette);
      } else {
        setContextCustomPalette(undefined);
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
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'EXCLUIR') return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao excluir conta');
      }

      await signOut();
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
      setDeleteLoading(false);
    }
  };

  const publicUrl = `navalha.app/${tenant?.slug || ''}`;

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
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>
          <Settings2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Personalização
        </p>
        <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>
          Configurações do Salão
        </h1>
      </div>

      {/* ── Identidade & Link da Barbearia ── */}
      <div className="glass-card p-6 rounded-2xl border space-y-5" style={{ borderColor: theme.border }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: theme.cardBorder }}>
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <Building2 className="w-5 h-5" style={{ color: theme.accent }} />
              Identidade & Link da sua Barbearia
            </h2>
            <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
              Personalize o nome do seu estabelecimento e a URL exclusiva compartilhada com seus clientes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const currentFullUrl = `navalha.app/${slug || tenant?.slug || ''}`;
                navigator.clipboard.writeText(currentFullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border"
              style={{ background: theme.inputBg, color: copied ? theme.success : theme.textSecondary, borderColor: theme.border }}
              title="Copiar link da página"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
            <button
              onClick={() => window.open(`/${slug || tenant?.slug}`, '_blank')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver Página
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Campo 1: Nome da Barbearia */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold flex items-center justify-between" style={{ color: theme.textPrimary }}>
              <span>Nome do Estabelecimento</span>
              <span className="text-[10px] font-normal" style={{ color: theme.textSecondary }}>Aparece no topo e na agenda</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  setFantasyName(e.target.value);
                }}
                placeholder="Ex: Barbearia Raffros Maria"
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border themed-input focus:outline-none"
                style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
              />
            </div>
          </div>

          {/* Campo 2: Slug / Link Personalizado com Verificação em Tempo Real */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                Link Exclusivo (URL)
              </label>
              {/* Status Badge em Tempo Real */}
              <div className="flex items-center gap-1 text-[11px] font-semibold">
                {slugStatus === 'checking' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-amber-500 bg-amber-500/10 border-amber-500/20">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </span>
                )}
                {slugStatus === 'available' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-emerald-500 bg-emerald-500/10 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Disponível!
                  </span>
                )}
                {slugStatus === 'unavailable' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-rose-500 bg-rose-500/10 border-rose-500/20">
                    <AlertCircle className="w-3 h-3" /> Já em uso!
                  </span>
                )}
                {slugStatus === 'invalid' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-amber-400 bg-amber-400/10 border-amber-400/20">
                    <AlertCircle className="w-3 h-3" /> Mín. 3 letras
                  </span>
                )}
              </div>
            </div>

            {/* Input com Prefixo navalha.app/ */}
            <div className="flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[var(--theme-accent)]"
              style={{
                background: theme.inputBg,
                borderColor: slugStatus === 'unavailable' ? '#f43f5e' : slugStatus === 'available' ? '#10b981' : theme.border
              }}>
              <span className="px-3.5 py-2.5 text-xs font-bold select-none border-r shrink-0 flex items-center gap-1"
                style={{ background: theme.bgHover, borderColor: theme.border, color: theme.textSecondary }}>
                <LinkIcon className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                navalha.app/
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
            {slugMessage && (
              <p className="text-[11px] font-medium"
                style={{
                  color: slugStatus === 'unavailable' ? '#f43f5e' : slugStatus === 'available' ? '#10b981' : theme.textSecondary
                }}>
                {slugMessage}
              </p>
            )}
          </div>
        </div>

        {/* ── Aviso Importante sobre Alteração de Link ── */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl text-xs border"
          style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)', color: theme.textPrimary }}>
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-500">Recomendação importante ao alterar o link:</p>
            <p className="leading-relaxed opacity-90" style={{ color: theme.textSecondary }}>
              Evite alterar o link com frequência após já tê-lo divulgado. Clientes frequentes que salvaram o link anterior nos favoritos, no WhatsApp ou na tela de início do celular podem não conseguir acessar a agenda se a URL mudar.
            </p>
          </div>
        </div>

        {/* ── Botão de Ação Salvar Identidade & Link ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: theme.cardBorder }}>
          <p className="text-xs" style={{ color: theme.textSecondary }}>
            O novo nome e link serão atualizados instantaneamente no seu painel e na página pública.
          </p>
          <button
            onClick={handleSaveIdentity}
            disabled={identitySaving || slugStatus === 'checking' || slugStatus === 'unavailable' || slugStatus === 'invalid'}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: identitySaved ? '#10b981' : theme.accentGradient,
              color: identitySaved ? '#FFFFFF' : theme.btnPrimaryText,
              boxShadow: identitySaved ? '0 0 20px rgba(16, 185, 129, 0.4)' : theme.shadowAccent,
            }}
          >
            {identitySaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando alterações...
              </>
            ) : identitySaved ? (
              <>
                <Check className="w-4 h-4" />
                Identidade Salva com Sucesso!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Nome & Link
              </>
            )}
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
          className="glass-card p-6"
        >

          {/* ═══════════════════════════ TAB: APARÊNCIA & MARCA (UNIFICADO) ═══════════════════════════ */}
          {activeTab === 'aparencia' && (
            <div className="space-y-6">
              {/* Header com Botão Salvar Direto */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: theme.border }}>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2" style={{ color: theme.textPrimary }}>
                    <Sparkles className="w-4 h-4" style={{ color: theme.accent }} />
                    Aparência & Identidade Visual
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                    Cores, logo e capa sincronizadas em tempo real com seu painel e sua página pública de agendamento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-md shrink-0 self-start sm:self-auto"
                  style={{
                    background: theme.btnPrimaryBg || theme.accent,
                    color: theme.btnPrimaryText,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Salvo com Sucesso!
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>

              {/* 1. Imagens: Logo & Capa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Logo */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    Logo do Salão (Perfil)
                  </label>
                  <div
                    className="relative h-40 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all"
                    style={{
                      borderColor: logoUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {logoUrl || logoUpload.preview ? (
                      <>
                        <img src={logoUrl || logoUpload.preview || ''} alt="Logo" className="w-full h-full object-contain p-3" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <label className="p-2 rounded-full cursor-pointer" style={{ background: theme.accent, color: theme.textInverse }}>
                            <Upload className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          </label>
                          <button onClick={removeLogo} className="p-2 rounded-full bg-red-500 text-white">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="text-center p-4 cursor-pointer w-full h-full flex flex-col items-center justify-center">
                        {logoUpload.isUploading ? (
                          <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: theme.accent }} />
                        ) : (
                          <Upload className="w-7 h-7 mb-2" style={{ color: theme.textMuted }} />
                        )}
                        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                          {logoUpload.isUploading ? 'Enviando...' : 'Enviar Logo do Salão'}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>Mínimo 400×400px</p>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Banner Capa */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    Banner (Capa Superior)
                  </label>
                  <div
                    className="relative h-40 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all"
                    style={{
                      borderColor: bannerUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {bannerUrl || bannerUpload.preview ? (
                      <>
                        <img src={bannerUrl || bannerUpload.preview || ''} alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <label className="p-2 rounded-full cursor-pointer" style={{ background: theme.accent, color: theme.textInverse }}>
                            <Upload className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                          </label>
                          <button onClick={removeBanner} className="p-2 rounded-full bg-red-500 text-white">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                        <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
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
                    onClick={() => setIsCustomizerOpen(true)}
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
                    <span className="text-2xl">{bgMode === 'dark' ? '🌙' : '☀️'}</span>
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
                    <span className="text-lg font-black" style={{ color: customPalette?.primary || theme.accent, fontFamily: draftFontStyle === 'serif' ? "'Playfair Display', serif" : "'Plus Jakarta Sans', sans-serif" }}>
                      Aa
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>Tipografia dos Títulos</p>
                      <p className="text-xs font-bold" style={{ color: theme.textPrimary }}>
                        {draftFontStyle === 'serif' ? 'Playfair (Clássico)' : 'Plus Jakarta (Moderno)'}
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
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    <WhatsAppIcon className="w-3.5 h-3.5" style={{ color: '#25D366' }} /> WhatsApp Agendamento
                  </label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={handleWhatsappChange}
                    className="themed-input"
                    placeholder={phoneFormat.placeholder}
                    maxLength={phoneFormat.maxLength}
                  />
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

              {/* CEP + Number row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-1">
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
                <div className="col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Número</label>
                  <input
                    type="text"
                    value={streetNumber}
                    onChange={e => setStreetNumber(e.target.value)}
                    className="themed-input"
                    placeholder="123"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Complemento</label>
                  <input
                    type="text"
                    value={complement}
                    onChange={e => setComplement(e.target.value)}
                    className="themed-input"
                    placeholder="Sala 2, Bloco B..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Bairro</label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                    className="themed-input"
                    placeholder="Centro"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="themed-input"
                    placeholder="São Paulo"
                  />
                </div>
                <div>
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                  <MapPin className="w-3 h-3 inline mr-1 -mt-0.5" /> Endereço Completo
                </label>
                <input
                  type="text"
                  value={fullAddress}
                  onChange={e => setFullAddress(e.target.value)}
                  className="themed-input"
                  placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                />
                <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
                  Preenchido automaticamente pelo CEP. Edite se necessário.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                  Link do Google Maps
                </label>
                <input
                  type="text"
                  value={mapLink}
                  onChange={e => setMapLink(e.target.value)}
                  className="themed-input"
                  placeholder="Cole o link curto do Google Maps aqui (opcional)"
                />
              </div>

              {/* Map Preview */}
              {(latitude && longitude) && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.inputBorder}`, height: '200px' }}>
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005},${latitude - 0.003},${longitude + 0.005},${latitude + 0.003}&layer=mapnik&marker=${latitude},${longitude}`}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════ TAB: RECEBIMENTOS & PAGAMENTOS ══════════════════════════ */}
          {activeTab === 'stripe' && (
            <div className="space-y-8">
              {/* Formas de Pagamento Aceitas no Agendamento */}
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <CreditCard className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Formas de Pagamento no Agendamento
                </h3>
                <p className="text-xs mb-4" style={{ color: theme.textMuted }}>
                  Ative as formas de cobrança disponíveis para seus clientes na hora de agendar. Pelo menos uma deve estar ativa.
                </p>
                <div className="space-y-3">
                  {[
                    { key: 'local' as const, label: 'Pagar no local', desc: 'Cliente agenda e realiza o pagamento presencialmente após o serviço', state: allowLocal, set: setAllowLocal },
                    { key: 'deposit' as const, label: 'Exigir Entrada / Depósito (Online)', desc: 'Cliente paga um percentual antecipado via cartão/Pix para garantir o horário', state: allowDeposit, set: setAllowDeposit },
                    { key: 'full' as const, label: 'Pagamento 100% Antecipado (Online)', desc: 'Cliente paga o valor integral do serviço online no ato do agendamento', state: allowFull, set: setAllowFull },
                  ].map(m => {
                    const activeCount = [allowLocal, allowDeposit, allowFull].filter(Boolean).length;
                    const isLastActive = m.state && activeCount === 1;
                    return (
                      <div key={m.key} className="flex flex-col p-4 rounded-2xl transition-colors" style={{ background: m.state ? `${theme.accent}12` : theme.inputBg, border: `1px solid ${m.state ? theme.accent : theme.inputBorder}` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>{m.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{m.desc}</p>
                            {isLastActive && (
                              <p className="text-xs mt-1 font-semibold" style={{ color: '#f59e0b' }}>⚠ Pelo menos uma forma de pagamento deve permanecer ativa</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isLastActive) return; // prevent disabling last option
                              m.set(!m.state);
                            }}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4"
                            style={{ background: m.state ? theme.accent : theme.border }}
                            title={isLastActive ? 'Pelo menos uma opção deve estar ativa' : ''}
                          >
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform" style={{ transform: m.state ? 'translateX(22px)' : 'translateX(4px)' }} />
                          </button>
                        </div>

                        {/* Slider for deposit percentage */}
                        <AnimatePresence>
                          {m.key === 'deposit' && m.state && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 pt-4 border-t"
                              style={{ borderColor: theme.inputBorder }}
                            >
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: theme.textSecondary }}>
                                  Percentual de Entrada: <span className="font-extrabold" style={{ color: theme.accent }}>{depositPercentage}%</span>
                                </label>
                                <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>
                                  O saldo restante ({100 - depositPercentage}%) será pago no salão.
                                </span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={90}
                                step={5}
                                value={depositPercentage}
                                onChange={(e) => setDepositPercentage(Number(e.target.value))}
                                className="w-full mt-3"
                                style={{ accentColor: theme.accent }}
                              />
                              <div className="flex justify-between text-xs mt-1 font-medium" style={{ color: theme.textMuted }}>
                                <span>10% (mínimo)</span>
                                <span>50% (recomendado)</span>
                                <span>90%</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Conexão Stripe Connect */}
              <div className="pt-6 border-t" style={{ borderColor: theme.border }}>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Shield className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Recebimentos Online (Stripe Connect)
                </h3>
                <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>
                  Conecte sua conta bancária/Stripe para receber pagamentos online direto na sua conta.
                </p>

                {/* Status Card */}
                <div
                  className="rounded-2xl p-5 flex items-start gap-4 mb-4"
                  style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${theme.accent}15` }}
                  >
                    <Shield className="w-5 h-5" style={{ color: theme.accent }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Conta Bancária de Recebimento</h4>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `${theme.warning}20`, color: theme.warning }}
                      >
                        Não conectada
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: theme.textMuted }}>
                      Conecte sua conta Stripe para receber as entradas e pagamentos integrais automaticamente.
                    </p>
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={handleConnectStripe}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: '#635BFF',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 14px rgba(99, 91, 255, 0.3)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                  </svg>
                  Conectar com Stripe
                </button>

                <div
                  className="rounded-xl p-4 flex items-start gap-3 mt-4"
                  style={{ background: `${theme.info}10`, border: `1px solid ${theme.info}30` }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.info }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: theme.info }}>Como funciona a transferência?</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.textMuted }}>
                      Ao conectar, você será direcionado ao Stripe para cadastrar sua chave Pix ou conta bancária.
                      Os valores pagos pelos clientes caem diretamente na sua conta com segurança bancária.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB 6: HORÁRIOS ════════════════════════════════ */}
          {activeTab === 'horarios' && (
            <div className="space-y-6">
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
            </div>
          )}

          {/* ═══════════════════════════ TAB 7: POLÍTICAS ════════════════════════════════ */}
          {activeTab === 'politicas' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Shield className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Políticas de Agendamento
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Configure as regras para cancelamentos e reagendamentos realizados pelos clientes no portal.
                </p>
              </div>

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
        </motion.div>
      </AnimatePresence>

      {/* Danger Zone (Only for owners) */}
      {profile?.role === 'owner' && (
        <div className="mt-12 p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-500 mb-1">Zona de Perigo</h3>
              <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                A exclusão da conta é irreversível. Ao excluir sua conta, todas as suas assinaturas ativas serão canceladas imediatamente e seu acesso será revogado.
              </p>
              <button
                onClick={() => setDeleteAccountModalOpen(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Excluir Minha Conta
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl rounded-3xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
              style={{
                background: theme.cardBg,
                borderColor: theme.cardBorder,
              }}
            >
              {/* Modal Header */}
              <div
                className="px-6 py-5 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: theme.border, background: theme.bg }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
                    style={{ background: customPalette?.primary || theme.accent, color: theme.btnPrimaryText }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                      Studio de Identidade Visual
                    </h3>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
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
              <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── Left Column: Controls (Spacious & Clean) ── */}
                <div className="lg:col-span-7 space-y-7">
                  {/* 1. Atmosfera */}
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
                      1. Atmosfera do Salão (Fundo)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Modo Noturno */}
                      <button
                        type="button"
                        onClick={() => handleToggleBgMode('dark')}
                        className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] cursor-pointer"
                        style={{
                          background: bgMode === 'dark' ? '#09090B' : theme.inputBg,
                          borderColor: bgMode === 'dark' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: bgMode === 'dark' ? `0 0 18px ${(customPalette?.primary || theme.accent)}30` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🌙</span>
                          <div>
                            <p className="text-xs font-bold" style={{ color: bgMode === 'dark' ? '#FFFFFF' : theme.textPrimary }}>
                              Modo Noturno / Escuro
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: bgMode === 'dark' ? '#A1A1AA' : theme.textMuted }}>
                              Fundo escuro luxuoso com detalhes na sua cor
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
                        className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] cursor-pointer"
                        style={{
                          background: bgMode === 'light' ? '#FFFFFF' : theme.inputBg,
                          borderColor: bgMode === 'light' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: bgMode === 'light' ? `0 0 18px ${(customPalette?.primary || theme.accent)}30` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">☀️</span>
                          <div>
                            <p className="text-xs font-bold" style={{ color: bgMode === 'light' ? '#0F172A' : theme.textPrimary }}>
                              Modo Claro / Diurno
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: bgMode === 'light' ? '#64748B' : theme.textMuted }}>
                              Fundo claro acetinado e limpo
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
                  <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-xs font-extrabold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                        2. Cor Principal da Marca (Destaque)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetToNoir}
                          className="text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:scale-105"
                          style={{ borderColor: theme.border, color: theme.textSecondary, background: theme.inputBg }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurar Noir Padrão
                        </button>
                        {(logoUrl || logoUpload.preview) && (
                          <button
                            type="button"
                            onClick={() => handleMagicExtract()}
                            disabled={isExtracting}
                            className="text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:scale-105"
                            style={{ borderColor: theme.accent, color: theme.accent, background: `${theme.accent}10` }}
                          >
                            {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Re-extrair da Logo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {['#C9963B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#F97316'].map((hex) => {
                        const isActive = (customPalette?.primary || theme.accent).toUpperCase() === hex.toUpperCase();
                        return (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => handleSelectSwatchColor(hex)}
                            className="group flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all hover:scale-105 shadow-sm cursor-pointer"
                            style={{
                              background: isActive ? `${hex}20` : theme.inputBg,
                              borderColor: isActive ? hex : theme.border,
                              boxShadow: isActive ? `0 0 16px ${hex}35` : 'none',
                            }}
                          >
                            <span
                              className="w-5 h-5 rounded-full shadow flex items-center justify-center"
                              style={{ background: hex }}
                            >
                              {isActive && <Check className="w-3 h-3 text-white drop-shadow" />}
                            </span>
                            <span className="text-xs font-mono font-bold" style={{ color: theme.textPrimary }}>
                              {hex}
                            </span>
                          </button>
                        );
                      })}

                      {/* Custom Color Picker */}
                      <label
                        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all hover:scale-105"
                        style={{ background: theme.inputBg, borderColor: theme.border }}
                      >
                        <input
                          type="color"
                          value={customPalette?.primary || theme.accent}
                          onChange={(e) => handleSelectSwatchColor(e.target.value)}
                          className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-xs font-bold" style={{ color: theme.textSecondary }}>Personalizar...</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Tipografia */}
                  <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
                    <label className="block text-xs font-extrabold uppercase tracking-wider mb-3" style={{ color: theme.textSecondary }}>
                      3. Estilo Tipográfico dos Títulos
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Playfair Display */}
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFontStyle('serif');
                          setCustomPalette((prev: any) => ({ ...(prev || {}), fontStyle: 'serif' }));
                        }}
                        className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer hover:scale-[1.01]"
                        style={{
                          background: draftFontStyle === 'serif' ? (bgMode === 'dark' ? '#09090B' : '#FFFFFF') : theme.inputBg,
                          borderColor: draftFontStyle === 'serif' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: draftFontStyle === 'serif' ? `0 0 16px ${(customPalette?.primary || theme.accent)}25` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-serif font-bold" style={{ color: customPalette?.primary || theme.accent }}>Aa</span>
                          <div>
                            <p className="text-xs font-bold font-serif" style={{ color: theme.textPrimary }}>
                              Clássico & Elegante
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                              Playfair Display refinada para títulos e números
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
                        className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer hover:scale-[1.01]"
                        style={{
                          background: draftFontStyle === 'sans' ? (bgMode === 'dark' ? '#09090B' : '#FFFFFF') : theme.inputBg,
                          borderColor: draftFontStyle === 'sans' ? (customPalette?.primary || theme.accent) : theme.border,
                          boxShadow: draftFontStyle === 'sans' ? `0 0 16px ${(customPalette?.primary || theme.accent)}25` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-sans font-black" style={{ color: customPalette?.primary || theme.accent }}>Aa</span>
                          <div>
                            <p className="text-xs font-bold font-sans" style={{ color: theme.textPrimary }}>
                              Moderno & Minimalista
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                              Plus Jakarta Sans direta, limpa e contemporânea
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
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${previewMode === 'public' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                        style={{
                          background: previewMode === 'public' ? (customPalette?.primary || theme.accent) : 'transparent',
                          color: previewMode === 'public' ? theme.btnPrimaryText : theme.textSecondary,
                        }}
                      >
                        📱 Página
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('admin')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${previewMode === 'admin' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                        style={{
                          background: previewMode === 'admin' ? (customPalette?.primary || theme.accent) : 'transparent',
                          color: previewMode === 'admin' ? theme.btnPrimaryText : theme.textSecondary,
                        }}
                      >
                        💻 Painel
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
                                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-sm"
                                  style={{
                                    background: activeAccent,
                                    color: prevBtnText,
                                    fontFamily: prevFontFamily,
                                  }}
                                >
                                  {fantasyName ? fantasyName.charAt(0).toUpperCase() : 'N'}
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
    </div>
  );
}
