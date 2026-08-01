import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { usePhoneFormat } from '../../hooks/usePhoneFormat';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Check, Link as LinkIcon, Copy, ExternalLink, Image as ImageIcon,
  MapPin, Phone, Globe, Mail, Palette, Clock, CreditCard, Upload,
  Trash2, Eye, Settings2, Sparkles, Building2, X, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Shield, Bell
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
  { id: 'geral', label: 'Geral & Tema', icon: Palette },
  { id: 'branding', label: 'Branding', icon: ImageIcon },
  { id: 'contato', label: 'Contato', icon: Phone },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'local', label: 'Localização', icon: MapPin },
  { id: 'stripe', label: 'Recebimentos', icon: CreditCard },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'politicas', label: 'Políticas', icon: Shield },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Configuracoes() {
  const { tenant } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setThemeId, themeId } = useTheme();
  const phoneFormat = usePhoneFormat(tenant?.language || 'pt');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // ─── Form State ───────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>('pt');
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [paymentMode, setPaymentMode] = useState('local');
  const [depositPercentage, setDepositPercentage] = useState(50);

  // Branding
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

  // Policies
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [rescheduleDeadlineHours, setRescheduleDeadlineHours] = useState(24);
  const [maxReschedules, setMaxReschedules] = useState(1);
  const [allowCancel, setAllowCancel] = useState(true);
  const [cancelDeadlineHours, setCancelDeadlineHours] = useState(24);

  // Financial Policies (Sprint 3.9)
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  const [paymentOptions, setPaymentOptions] = useState('both'); // online_only, local_only, both
  const [allowRefunds, setAllowRefunds] = useState(true);
  const [refundPolicy, setRefundPolicy] = useState('full_refund_only'); // full_refund_only, partial_refund, credit_only, no_refund
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
        setSelectedTheme(data.theme_preset || 'classic');
        setPaymentMode(data.booking_payment_mode || 'local');
        setDepositPercentage(data.deposit_percentage || 50);
        setFantasyName(data.fantasy_name || '');
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
        setMaxReschedules(data.max_reschedules ?? 1);
        setAllowCancel(data.allow_cancel ?? true);
        setCancelDeadlineHours(data.cancel_deadline_hours ?? 24);
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

  // ─── Handle Image Upload ──────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !tenant) return;
    const url = await logoUpload.upload(e.target.files[0], `${tenant.id}/logo`);
    if (url) setLogoUrl(url);
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

  // ─── Handle Theme Change ──────────────────────────────────────────────────
  const handleThemeChange = (id: string) => {
    setSelectedTheme(id);
    setThemeId(id); // Apply immediately for preview
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tenant) return;
    setLoading(true);

    try {
      // Update tenant language
      await (supabase as any).from('tenants').update({ language }).eq('id', tenant.id);
      i18n.changeLanguage(language);

      // Build payload
      const payload: Record<string, any> = {
        tenant_id: tenant.id,
        theme_preset: selectedTheme,
        booking_payment_mode: paymentMode,
        deposit_percentage: paymentMode === 'deposit' ? depositPercentage : null,
        fantasy_name: fantasyName,
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
        max_reschedules: maxReschedules,
        allow_cancel: allowCancel,
        cancel_deadline_hours: cancelDeadlineHours,
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

      // Apply theme
      setThemeId(selectedTheme);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setLoading(false);
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

      {/* Public Link Card */}
      <div className="glass-card p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: theme.textPrimary }}>
          <LinkIcon className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
          Sua página pública
        </h2>
        <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>Compartilhe este link com seus clientes.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center rounded-xl px-4 py-3 text-sm"
            style={{ background: theme.inputBg, color: theme.textSecondary, border: `1px solid ${theme.inputBorder}` }}
          >
            <LinkIcon className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: theme.accent }} />
            {publicUrl}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: theme.inputBg, color: copied ? theme.success : theme.textSecondary, border: `1px solid ${theme.inputBorder}` }}
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={() => window.open(`/${tenant?.slug}`, '_blank')}
            className="flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}
          >
            <ExternalLink className="w-4 h-4" /> Ver página
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 pb-2 overflow-x-auto scrollbar-none" style={{ borderBottom: `1px solid ${theme.border}` }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all shrink-0"
              style={{
                background: isActive ? theme.accentMuted : 'transparent',
                color: isActive ? theme.accent : theme.textSecondary,
                borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
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

          {/* ═══════════════════════════ TAB 1: GERAL & TEMA ═══════════════════════════ */}
          {activeTab === 'geral' && (
            <div className="space-y-8">
              {/* Theme Selection */}
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Palette className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Tema da Página
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  O tema afeta o painel inteiro e a página pública dos seus clientes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.values(THEMES).map(t => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1"
                        style={{
                          border: `2px solid ${isSelected ? t.accent : t.border}`,
                          boxShadow: isSelected ? `0 0 20px ${t.accent}30` : 'none',
                        }}
                      >
                        <div className="relative p-4 flex flex-col justify-end" style={{ background: t.bg, minHeight: '110px' }}>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.accent }}>
                              <Check className="w-3 h-3" style={{ color: t.textInverse }} />
                            </div>
                          )}
                          <p className="font-serif text-xl font-bold mb-3" style={{ color: t.textPrimary }}>Salão</p>
                          <span className="text-[11px] font-semibold px-3 py-1 rounded-full w-max" style={{ background: t.accent, color: t.btnPrimaryText }}>
                            Agendar
                          </span>
                        </div>
                        <div className="p-3" style={{ background: t.bgCard }}>
                          <p className="font-semibold text-sm" style={{ color: t.textPrimary }}>{t.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: t.accent }}>{t.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Language */}
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Globe className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Idioma do Salão
                </h3>
                <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                  Afeta todo o painel admin e a página pública de agendamento.
                </p>
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

              {/* Payment Mode */}
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <CreditCard className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Modo de Pagamento
                </h3>
                <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                  Como seus clientes pagam ao agendar na sua página pública.
                </p>
                <div className="space-y-3 mt-3">
                  {[
                    { id: 'local', label: 'Pagar no local', desc: 'Cliente paga quando chegar ao salão' },
                    { id: 'deposit', label: 'Sinal Obrigatório', desc: 'Cliente paga um percentual adiantado' },
                    { id: 'full', label: 'Pagamento 100% antecipado', desc: 'Cliente paga o valor total online' },
                    { id: 'client_choice', label: 'Cliente Escolhe', desc: 'O cliente decide a forma de pagamento' },
                  ].map(m => (
                    <label
                      key={m.id}
                      className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: paymentMode === m.id ? theme.accentMuted : theme.inputBg,
                        border: `1px solid ${paymentMode === m.id ? theme.accent : theme.inputBorder}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="payMode"
                        value={m.id}
                        checked={paymentMode === m.id}
                        onChange={e => setPaymentMode(e.target.value)}
                        className="mt-0.5"
                        style={{ accentColor: theme.accent }}
                      />
                      <div>
                        <span className="text-sm font-medium" style={{ color: theme.textPrimary }}>{m.label}</span>
                        <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Deposit Percentage Slider */}
                {paymentMode === 'deposit' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 rounded-xl"
                    style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}
                  >
                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                      Percentual do Sinal: <span style={{ color: theme.accent }}>{depositPercentage}%</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={depositPercentage}
                      onChange={(e) => setDepositPercentage(Number(e.target.value))}
                      className="w-full mt-2"
                      style={{ accentColor: theme.accent }}
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: theme.textMuted }}>
                      <span>10%</span>
                      <span>50%</span>
                      <span>90%</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════ TAB 2: BRANDING ═══════════════════════════════ */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <Sparkles className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Identidade Visual
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Logo e banner aparecem automaticamente na sua página pública.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    Logo do Salão
                  </label>
                  <div
                    className="relative h-44 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all"
                    style={{
                      borderColor: logoUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {logoUrl || logoUpload.preview ? (
                      <>
                        <img src={logoUrl || logoUpload.preview || ''} alt="Logo" className="w-full h-full object-contain p-4" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
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
                          <Loader2 className="w-8 h-8 animate-spin mb-2" style={{ color: theme.accent }} />
                        ) : (
                          <Upload className="w-8 h-8 mb-2" style={{ color: theme.textMuted }} />
                        )}
                        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                          {logoUpload.isUploading ? 'Enviando...' : 'Clique para enviar Logo'}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: theme.textMuted }}>Mínimo 400×400px</p>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                    Banner (Capa)
                  </label>
                  <div
                    className="relative h-44 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all"
                    style={{
                      borderColor: bannerUpload.isUploading ? theme.accent : theme.inputBorder,
                      background: theme.inputBg,
                    }}
                  >
                    {bannerUrl || bannerUpload.preview ? (
                      <>
                        <img src={bannerUrl || bannerUpload.preview || ''} alt="Banner" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
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
                          <Loader2 className="w-8 h-8 animate-spin mb-2" style={{ color: theme.accent }} />
                        ) : (
                          <Upload className="w-8 h-8 mb-2" style={{ color: theme.textMuted }} />
                        )}
                        <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
                          {bannerUpload.isUploading ? 'Enviando...' : 'Clique para enviar Capa'}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: theme.textMuted }}>Ideal 1600×600px</p>
                        <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Fields */}
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
                  placeholder="Ex: O melhor corte da cidade"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>
                  <span>Sobre o Salão</span>
                  <span style={{ color: description.length > 180 ? theme.error : theme.textMuted }}>{description.length}/180</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 180))}
                  rows={4}
                  className="themed-input resize-none"
                  placeholder="Conte a história do seu espaço..."
                />
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

          {/* ═══════════════════════════ TAB 5: STRIPE CONNECT ══════════════════════════ */}
          {activeTab === 'stripe' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                  <CreditCard className="w-4 h-4 inline mr-2 -mt-0.5" style={{ color: theme.accent }} />
                  Recebimentos via Stripe
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                  Conecte sua conta Stripe para receber pagamentos dos clientes.
                </p>
              </div>

              {/* Status Card */}
              <div
                className="rounded-2xl p-6 flex items-start gap-4"
                style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: theme.accentMuted }}
                >
                  <Shield className="w-6 h-6" style={{ color: theme.accent }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Status da Conta</h4>
                    <span
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{ background: `${theme.warning}20`, color: theme.warning }}
                    >
                      Não conectada
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    Conecte sua conta Stripe para começar a receber pagamentos online dos seus clientes.
                  </p>
                </div>
              </div>

              {/* Connect Button */}
              <button
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-sm transition-all"
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
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: `${theme.info}10`, border: `1px solid ${theme.info}30` }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.info }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: theme.info }}>Como funciona?</p>
                  <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                    Ao conectar, você será redirecionado ao Stripe para verificar sua identidade e conta bancária.
                    Após a verificação, os pagamentos dos seus clientes serão depositados diretamente na sua conta.
                    Saques são gerenciados no painel do Stripe.
                  </p>
                </div>
              </div>

              {/* Opções de Pagamento */}
              <div className="pt-6 border-t mt-6" style={{ borderColor: theme.border }}>
                <h4 className="font-bold text-sm mb-4" style={{ color: theme.textPrimary }}>Opções de Cobrança</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}>
                    <div>
                      <p className="font-bold text-sm" style={{ color: theme.textPrimary }}>Aceitar Pagamentos Online</p>
                      <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Habilita a opção de pagar pelo site no momento do agendamento.</p>
                    </div>
                    <button
                      onClick={() => setOnlinePaymentEnabled(!onlinePaymentEnabled)}
                      className="relative w-10 h-5 rounded-full transition-all"
                      style={{ background: onlinePaymentEnabled ? theme.accent : theme.border }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all"
                        style={{ transform: onlinePaymentEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>

                  {onlinePaymentEnabled && (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Disponibilidade de Pagamento</label>
                        <select
                          value={paymentOptions}
                          onChange={e => setPaymentOptions(e.target.value)}
                          className="themed-input"
                        >
                          <option value="both">Online e Presencial (Cliente escolhe)</option>
                          <option value="online_only">Apenas Online (Obrigatório)</option>
                          <option value="local_only">Apenas Presencial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Momento da Cobrança Online</label>
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          className="themed-input"
                        >
                          <option value="full">Cobrar 100% no Agendamento</option>
                          <option value="deposit">Cobrar apenas um Sinal (Garantia)</option>
                          <option value="local">Nenhuma cobrança antecipada</option>
                        </select>
                      </div>

                      {paymentMode === 'deposit' && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Percentual do Sinal (%)</label>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={depositPercentage}
                            onChange={e => setDepositPercentage(Number(e.target.value))}
                            className="themed-input"
                          />
                        </div>
                      )}
                      
                      {/* Políticas de Reembolso */}
                      <div className="pt-4 border-t" style={{ borderColor: theme.border }}>
                        <h4 className="font-bold text-sm mb-4" style={{ color: theme.textPrimary }}>Políticas de Reembolso e Cancelamento</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}>
                            <div>
                              <p className="font-bold text-sm" style={{ color: theme.textPrimary }}>Permitir Reembolso Automático</p>
                              <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Faz estorno no cartão via Stripe se o cliente cancelar dentro do prazo.</p>
                            </div>
                            <button
                              onClick={() => setAllowRefunds(!allowRefunds)}
                              className="relative w-10 h-5 rounded-full transition-all"
                              style={{ background: allowRefunds ? theme.accent : theme.border }}
                            >
                              <span
                                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all"
                                style={{ transform: allowRefunds ? 'translateX(20px)' : 'translateX(0)' }}
                              />
                            </button>
                          </div>
                          
                          {allowRefunds && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Política de Reembolso</label>
                              <select
                                value={refundPolicy}
                                onChange={e => setRefundPolicy(e.target.value)}
                                className="themed-input"
                              >
                                <option value="full_refund_only">Estorno Integral</option>
                                <option value="credit_only">Gerar Crédito na Loja (sem estorno)</option>
                                <option value="no_refund">Sem Reembolso (Não Reembolsável)</option>
                              </select>
                            </div>
                          )}
                          
                          {allowRefunds && refundPolicy === 'credit_only' && (
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Validade do Crédito (Dias)</label>
                              <input
                                type="number"
                                min="1"
                                max="365"
                                value={creditValidityDays}
                                onChange={e => setCreditValidityDays(Number(e.target.value))}
                                className="themed-input"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: bh.is_open ? theme.inputBg : `${theme.inputBg}80`,
                      border: `1px solid ${bh.is_open ? theme.inputBorder : theme.border}`,
                      opacity: bh.is_open ? 1 : 0.6,
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const updated = [...businessHours];
                            updated[idx].is_open = !updated[idx].is_open;
                            setBusinessHours(updated);
                          }}
                          className="relative w-10 h-5 rounded-full transition-all"
                          style={{ background: bh.is_open ? theme.accent : theme.border }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                            style={{
                              background: theme.textPrimary,
                              left: bh.is_open ? '22px' : '2px',
                            }}
                          />
                        </button>
                        <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                          {WEEKDAY_NAMES[bh.weekday]}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background: bh.is_open ? `${theme.success}20` : `${theme.error}20`,
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
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                      >
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: theme.textMuted }}>Abre</label>
                          <input
                            type="time"
                            value={bh.open_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].open_time = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: theme.textMuted }}>Fecha</label>
                          <input
                            type="time"
                            value={bh.close_time}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].close_time = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: theme.textMuted }}>Almoço início</label>
                          <input
                            type="time"
                            value={bh.lunch_start}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].lunch_start = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2"
                            placeholder="--:--"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: theme.textMuted }}>Almoço fim</label>
                          <input
                            type="time"
                            value={bh.lunch_end}
                            onChange={(e) => {
                              const updated = [...businessHours];
                              updated[idx].lunch_end = e.target.value;
                              setBusinessHours(updated);
                            }}
                            className="themed-input text-sm py-2"
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
                    <div>
                      <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                        Quantidade máxima
                      </label>
                      <select
                        value={maxReschedules}
                        onChange={(e) => setMaxReschedules(Number(e.target.value))}
                        className="themed-input w-full"
                      >
                        <option value={1}>1 vez</option>
                        <option value={2}>2 vezes</option>
                        <option value={3}>3 vezes</option>
                        <option value={999}>Ilimitado</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancelamento */}
              <div className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>Permitir Cancelamento</h4>
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

                {allowCancel && (
                  <div className="pt-4 border-t" style={{ borderColor: theme.border }}>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: theme.textMuted }}>
                      Prazo máximo (Horas de antecedência)
                    </label>
                    <select
                      value={cancelDeadlineHours}
                      onChange={(e) => setCancelDeadlineHours(Number(e.target.value))}
                      className="themed-input w-full md:w-1/2"
                    >
                      <option value={2}>Até 2 horas antes</option>
                      <option value={6}>Até 6 horas antes</option>
                      <option value={12}>Até 12 horas antes</option>
                      <option value={24}>Até 24 horas antes</option>
                      <option value={48}>Até 48 horas antes</option>
                      <option value={72}>Até 72 horas antes</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
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
