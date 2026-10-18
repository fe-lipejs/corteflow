import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { processFileIfHeic } from '../lib/imageHelper';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Upload, Image, Scissors, MapPin, AtSign, Phone as PhoneIcon, FileText, Sparkles, Star, Mail, Loader2, ArrowRight } from 'lucide-react';
import { normalizeBrazilianPhone, formatPhoneMask } from '../lib/phoneUtils';

const ACCENT = '#FC761D';
const ACCENT_HOVER = '#FF8738';

const onboardingSchema = z.object({
  language: z.enum(['pt', 'en', 'es', 'fr', 'de']),
  businessType: z.enum(['barbearia', 'salao', 'esmalteria']).optional(),
  businessName: z.string().min(1, "Informe o nome do estabelecimento").optional(),
  slug: z.string().regex(/^[a-z0-9-_]+$/, "Apenas letras minúsculas, números, hífens e sublinhados").optional(),
  themePreset: z.string().optional(),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  googleMapsUrl: z.string().optional().or(z.literal('')),
  instagramHandle: z.string().optional(),
  contactEmail: z.string().email("E-mail inválido").optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  shortDescription: z.string().max(180, "Máximo 180 caracteres").optional(),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

export const formatSlug = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
};

export const formatSlugWhileTyping = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-');
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoSize, setLogoSize] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [bannerSize, setBannerSize] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, profile, tenant, loading: authLoading, refreshProfile } = useAuth();

  // ── Live URL Verification States ──
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [userManuallyEditedSlug, setUserManuallyEditedSlug] = useState(false);

  // ── Live Phone Verification States (SSOT) ──
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
          p_exclude_user_id: user?.id
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

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      if (profile?.role === 'super_admin') {
        navigate('/platform', { replace: true });
        return;
      }

      if (profile?.onboarding_completed) {
        navigate('/admin', { replace: true });
        return;
      }

      if (profile?.tenant_id || tenant?.id) {
        setStep(4);
      }

      // Verificação direta no banco para garantir que salões já criados não acessem o onboarding
      const verifyTenant = async () => {
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('owner_user_id', user.id)
          .maybeSingle();

        if (existingTenant?.id) {
          if (!profile?.onboarding_completed) {
            setStep(4);
          } else {
            navigate('/admin', { replace: true });
          }
        }
      };

      verifyTenant();
    }
  }, [user, profile, tenant, authLoading, navigate]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      language: 'pt',
      themePreset: 'elegant',
      businessType: 'barbearia',
      businessName: '',
      slug: '',
      zipCode: '',
      street: '',
      streetNumber: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      googleMapsUrl: '',
      instagramHandle: '',
      contactEmail: '',
      phoneNumber: '',
      shortDescription: '',
    }
  });

  const businessName = watch('businessName') || '';
  const businessType = watch('businessType');
  const themePreset = watch('themePreset') || 'elegant';
  const slug = watch('slug') || '';
  const shortDescription = watch('shortDescription') || '';
  const zipCodeVal = watch('zipCode') || '';

  // Auto fill phone and email from logged in user if empty
  useEffect(() => {
    if (user) {
      if (user.email) setValue('contactEmail', user.email);
      const userPhone = user.user_metadata?.phone;
      if (userPhone) setValue('phoneNumber', userPhone);
    }
  }, [user, setValue]);

  // ── Live Slug Availability Checker (Debounced) ──
  useEffect(() => {
    if (!slug || slug.trim().length < 2) {
      setSlugStatus('idle');
      setSlugSuggestions([]);
      return;
    }

    setIsCheckingSlug(true);
    const timer = setTimeout(async () => {
      try {
        const cleanSlug = formatSlug(slug);

        // Check exact slug uniqueness
        const { data: slugMatch } = await supabase
          .from('tenants')
          .select('id, name, slug')
          .eq('slug', cleanSlug)
          .maybeSingle();

        if (slugMatch) {
          setSlugStatus('taken');
          // Generate dynamic available suggestions
          const typeSuffix = businessType === 'barbearia' ? 'barber' : businessType === 'salao' ? 'beauty' : 'nails';
          const candidates = [
            `${cleanSlug}-studio`,
            `${cleanSlug}-oficial`,
            `${cleanSlug}-vip`,
            `${cleanSlug}-${typeSuffix}`,
            `${cleanSlug}-1`,
          ];
          setSlugSuggestions(candidates.slice(0, 4));
        } else {
          setSlugStatus('available');
          setSlugSuggestions([]);
        }

      } catch (err) {
        console.error('Erro ao verificar slug:', err);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [slug, businessType]);

  // ── ViaCEP Auto Lookup ──
  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setValue('street', data.logradouro, { shouldValidate: true });
        if (data.bairro) setValue('neighborhood', data.bairro, { shouldValidate: true });
        if (data.localidade) setValue('city', data.localidade, { shouldValidate: true });
        if (data.uf) setValue('state', data.uf, { shouldValidate: true });
      }
    } catch (err) {
      console.error('ViaCEP error:', err);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (file) {
      file = await processFileIfHeic(file);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (file) {
      file = await processFileIfHeic(file);
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const compressImageToBlob = (file: File, maxWidth: number, maxHeight: number, quality = 0.85): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/webp', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const uploadFile = async (file: File, tenantId: string, type: 'logo' | 'banner'): Promise<string | null> => {
    try {
      const compressed = await compressImageToBlob(file, type === 'logo' ? 800 : 1600, type === 'logo' ? 800 : 600);
      const fileName = `${tenantId}/${type}-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('public_assets').upload(fileName, compressed, {
        contentType: 'image/webp',
        upsert: true,
      });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError);
        // Fallback Base64 so preview and images are preserved
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data } = supabase.storage.from('public_assets').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) {
      console.warn('Erro ao processar imagem:', e);
      return null;
    }
  };

  const onSubmit = async (data: OnboardingForm) => {
    // STRICT GUARD: Nunca submeter nem concluir o onboarding se não estiver no Passo 3!
    if (step !== 3) {
      handleNextStep();
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);

    // 0. Validação do Telefone com SSOT se preenchido
    let normalizedPhone: string | null = null;
    if (data.phoneNumber && data.phoneNumber.trim()) {
      const phoneValidation = normalizeBrazilianPhone(data.phoneNumber);
      if (!phoneValidation.isValid || !phoneValidation.normalized) {
        setError(phoneValidation.error || 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.');
        setLoading(false);
        return;
      }
      normalizedPhone = phoneValidation.normalized;

      // Checa unicidade no banco de dados
      try {
        const { data: avail, error: availErr } = await supabase.rpc('check_phone_availability', {
          p_phone: normalizedPhone,
          p_exclude_user_id: user.id
        });

        if (!availErr && avail && !avail.available) {
          setError(avail.error || 'Este número de telefone já está cadastrado em outra conta.');
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Check phone availability error:', checkErr);
      }
    }

    try {
      // 0.1. Double check existing tenant
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (existingTenant) {
        await supabase.from('profiles').upsert({
          id: user.id,
          tenant_id: existingTenant.id,
          role: 'admin',
          full_name: user.user_metadata?.full_name || 'Dono do Salão',
          phone: normalizedPhone || user.user_metadata?.phone || '',
          phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || '',
        } as any);
        await refreshProfile();
        setStep(4);
        setLoading(false);
        return;
      }

      const finalBusinessName = data.businessName?.trim() || 'Meu Estabelecimento';
      const finalSlug = formatSlug(data.slug?.trim() || finalBusinessName);

      // 1. Create Tenant
      const { data: tenantData, error: tenantError } = await supabase.from('tenants').insert({
        owner_user_id: user.id,
        business_type: data.businessType || 'barbearia',
        name: finalBusinessName,
        slug: finalSlug,
        language: data.language || 'pt',
        status: 'trial',
        has_used_trial: true,
      } as any).select('id').single();

      if (tenantError) {
        throw new Error(tenantError.message || 'Erro ao criar estabelecimento. Verifique se o link já existe.');
      }
      const newTenant = tenantData as any;

      // 2. Update Profile with role 'admin', phone and onboarding_completed: true
      await supabase.from('profiles').upsert({
        id: user.id,
        tenant_id: newTenant.id,
        role: 'admin',
        full_name: user.user_metadata?.full_name || 'Dono do Salão',
        phone: normalizedPhone || user.user_metadata?.phone || '',
        phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || '',
      } as any);

      // 3. Upload logo & banner (fail-safe)
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;

      if (logoFile) {
        logoUrl = await uploadFile(logoFile, newTenant.id, 'logo');
      }
      if (bannerFile) {
        bannerUrl = await uploadFile(bannerFile, newTenant.id, 'banner');
      }

      const computedFullAddress = [data.street, data.streetNumber, data.neighborhood, data.city, data.state].filter(Boolean).join(', ');

      // 4. Create tenant_settings with complete contact and address breakdown
      const { error: settingsError } = await supabase.from('tenant_settings').insert({
        tenant_id: newTenant.id,
        fantasy_name: finalBusinessName,
        theme_preset: data.themePreset || 'elegant',
        custom_palette: { primary: ACCENT, fontStyle: 'sans', btnTextColor: '#FFFFFF' },
        logo_url: logoUrl,
        banner_url: bannerUrl,
        short_description: data.shortDescription || '',
        description: data.shortDescription || '',
        phone: data.phoneNumber || user.user_metadata?.phone || '',
        whatsapp_number: data.phoneNumber || user.user_metadata?.phone || '',
        instagram: data.instagramHandle ? data.instagramHandle.replace(/^@/, '') : '',
        email: data.contactEmail || user.email || '',
        zip_code: data.zipCode || '',
        address: data.street || '',
        street_number: data.streetNumber || '',
        complement: data.complement || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        country: 'Brasil',
        full_address: computedFullAddress,
        map_link: data.googleMapsUrl || '',
        booking_payment_mode: 'local',
        accept_online_payment: false,
        accept_local_payment: true,
        payment_methods: { pay_local: true, partial_50: false, full_100: false },
      } as any);

      if (settingsError) {
        console.error('Erro ao criar configurações:', settingsError);
        throw new Error(`Erro ao salvar configurações do salão: ${settingsError.message}`);
      }

      // 5. Create default business hours (Monday to Saturday: 09:00 - 19:00)
      const defaultHours = [
        { tenant_id: newTenant.id, weekday: 0, is_open: false, open_time: '09:00:00', close_time: '18:00:00' },
        { tenant_id: newTenant.id, weekday: 1, is_open: true, open_time: '09:00:00', close_time: '19:00:00' },
        { tenant_id: newTenant.id, weekday: 2, is_open: true, open_time: '09:00:00', close_time: '19:00:00' },
        { tenant_id: newTenant.id, weekday: 3, is_open: true, open_time: '09:00:00', close_time: '19:00:00' },
        { tenant_id: newTenant.id, weekday: 4, is_open: true, open_time: '09:00:00', close_time: '19:00:00' },
        { tenant_id: newTenant.id, weekday: 5, is_open: true, open_time: '09:00:00', close_time: '19:00:00' },
        { tenant_id: newTenant.id, weekday: 6, is_open: true, open_time: '09:00:00', close_time: '17:00:00' },
      ];
      await supabase.from('business_hours').insert(defaultHours as any);

      // 6. Create default starter professional (the owner)
      const { data: ownerProf } = await supabase.from('professionals').insert({
        tenant_id: newTenant.id,
        name: user.user_metadata?.full_name || 'Profissional Principal',
        role_title: data.businessType === 'barbearia' ? 'Barbeiro Master' : data.businessType === 'salao' ? 'Cabeleireiro(a) Master' : 'Designer de Unhas',
        active: true,
      } as any).select('id').single();

      // 7. Create template services tailored to the business type
      const defaultServices = data.businessType === 'barbearia' ? [
        { tenant_id: newTenant.id, name: 'Corte Tradicional', price: 35.00, duration_minutes: 30, buffer_minutes: 0, category: 'Cortes', color: ACCENT, active: true },
        { tenant_id: newTenant.id, name: 'Barba & Toalha Quente', price: 30.00, duration_minutes: 30, buffer_minutes: 0, category: 'Barba', color: ACCENT, active: true },
        { tenant_id: newTenant.id, name: 'Combo Cabelo + Barba', price: 60.00, duration_minutes: 50, buffer_minutes: 0, category: 'Combos', color: ACCENT, active: true },
      ] : data.businessType === 'salao' ? [
        { tenant_id: newTenant.id, name: 'Corte Feminino / Escova', price: 70.00, duration_minutes: 45, buffer_minutes: 0, category: 'Cabelo', color: ACCENT, active: true },
        { tenant_id: newTenant.id, name: 'Hidratação Profunda', price: 90.00, duration_minutes: 60, buffer_minutes: 0, category: 'Tratamentos', color: ACCENT, active: true },
      ] : [
        { tenant_id: newTenant.id, name: 'Manicure Completa', price: 35.00, duration_minutes: 40, buffer_minutes: 0, category: 'Unhas', color: ACCENT, active: true },
        { tenant_id: newTenant.id, name: 'Pedicure Completa', price: 40.00, duration_minutes: 40, buffer_minutes: 0, category: 'Unhas', color: ACCENT, active: true },
        { tenant_id: newTenant.id, name: 'Alongamento em Gel', price: 120.00, duration_minutes: 90, buffer_minutes: 0, category: 'Alongamento', color: ACCENT, active: true },
      ];

      const { data: insertedServices } = await supabase.from('services').insert(defaultServices as any).select('id');

      // 8. Link professional to services
      if (ownerProf && insertedServices) {
        const links = insertedServices.map((s: any) => ({
          professional_id: ownerProf.id,
          service_id: s.id,
        }));
        await supabase.from('professional_services').insert(links as any);
      }

      // 9. Refresh context and go to Payment Step
      await refreshProfile();
      setStep(4);
      setLoading(false);

    } catch (err: any) {
      console.error('Erro no onboarding:', err);
      setError(err.message || 'Ocorreu um erro ao salvar os dados. Tente novamente.');
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!businessName || businessName.trim().length === 0) {
        setError('Informe o nome do estabelecimento.');
        return;
      }
      if (!slug || slug.trim().length === 0) {
        setError('Defina o link exclusivo do seu salão.');
        return;
      }
      if (slugStatus === 'taken') {
        setError('A URL escolhida já está em uso. Escolha outra opção ou clique em uma das sugestões.');
        return;
      }
      setStep(3);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step < 3) {
        handleNextStep();
      }
    }
  };

  const stepLabels = [
    { num: 1, label: 'Tipo de Negócio' },
    { num: 2, label: 'Nome & Link' },
    { num: 3, label: 'Identidade & Contato' },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        WebkitFontSmoothing: 'antialiased',
        background: 'radial-gradient(circle at 85% 10%, rgba(252, 118, 29, 0.05), transparent 45%), radial-gradient(circle at 10% 90%, rgba(15, 23, 42, 0.03), transparent 50%), #F8FAFC',
      }}
    >
      {/* Brilhos sutis e quentes de fundo (sem azul) */}
      <div
        aria-hidden="true"
        className="absolute top-[-20%] right-[-15%] w-[45%] h-[45%] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(252, 118, 29, 0.08), transparent 70%)',
          filter: 'blur(120px)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-15%] left-[-15%] w-[35%] h-[35%] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(252, 118, 29, 0.04), transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Card Principal de Onboarding */}
      <div
        className="w-full max-w-4xl rounded-[32px] overflow-hidden flex flex-col md:flex-row border border-[#E2E8F0] shadow-2xl relative z-10 bg-white"
        style={{
          minHeight: '680px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 0 40px rgba(252, 118, 29, 0.03)',
        }}
      >

        {/* Sidebar Lateral de Progresso */}
        <div className="bg-[#F8FAFC] p-8 md:w-68 flex flex-col justify-between border-r border-[#E2E8F0] shrink-0">
          <div>
            {/* Logo Oficial Raffros */}
            <div className="flex items-center gap-3 mb-10">
              <img
                src="/logo.svg"
                alt="Raffros"
                className="h-8 w-8 rounded-lg object-contain shadow-sm"
              />
              <span className="font-black text-lg text-[#0F172A] tracking-[-0.04em]">
                RAFFROS<span style={{ color: ACCENT }}>.</span>
              </span>
            </div>

            {/* Lista de Passos */}
            <div className="space-y-6">
              {stepLabels.map((s) => (
                <div
                  key={s.num}
                  onClick={() => {
                    if (s.num < step) {
                      setError(null);
                      setStep(s.num);
                    }
                  }}
                  className={`flex items-center gap-3.5 transition-all ${s.num < step ? 'cursor-pointer hover:opacity-80' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${step > s.num
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
                      : step === s.num
                        ? 'text-white shadow-md'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    style={step === s.num ? {
                      background: ACCENT,
                      boxShadow: '0 4px 14px rgba(252, 118, 29, 0.35)',
                    } : undefined}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-sm font-bold tracking-tight transition-colors ${step >= s.num ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200/60 mt-8">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-400">
              Passo {step} de 3
            </span>
          </div>
        </div>

        {/* Área de Conteúdo do Formulário */}
        <div className="flex-1 bg-white p-6 sm:p-9 md:p-11 flex flex-col justify-between overflow-y-auto max-h-[90vh]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 3) {
                handleSubmit(onSubmit)(e);
              } else {
                handleNextStep();
              }
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 flex flex-col justify-between"
          >
            <AnimatePresence mode="wait">
              {/* Passo 1: Idioma + Tipo de Negócio */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1"
                >
                  <h3 className="text-2xl sm:text-[28px] font-black mb-1.5 text-[#0F172A] tracking-[-0.035em] leading-tight">
                    Qual é o seu negócio?
                  </h3>
                  <p className="text-sm mb-7 text-[#64748B] font-normal leading-relaxed">
                    Personalizaremos a plataforma e os serviços sugeridos para o seu segmento.
                  </p>

                  <div className="mb-6">
                    <label className="block text-xs sm:text-[13px] font-bold text-[#334155] mb-2 tracking-[-0.01em]">
                      Idioma do Sistema
                    </label>
                    <select
                      {...register('language')}
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl text-[#0F172A] outline-none transition-all font-semibold text-sm cursor-pointer"
                      style={{
                        outline: 'none',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = ACCENT;
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(252, 118, 29, 0.15)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = '#CBD5E1';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <option value="pt">Português (Brasil)</option>
                      <option value="en">English (US)</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {[
                      { id: 'barbearia', title: 'Barbearia', desc: 'Cortes, barba, navalha e combos masculinos', icon: Scissors },
                      { id: 'salao', title: 'Salão de Beleza', desc: 'Cabelo, escova, coloração e tratamentos', icon: Star },
                      { id: 'esmalteria', title: 'Esmalteria & Nails', desc: 'Manicure, pedicure, alongamento em gel e nail design', icon: Sparkles },
                    ].map(type => {
                      const isSelected = businessType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => setValue('businessType', type.id as any, { shouldValidate: true })}
                          className="p-4.5 rounded-2xl cursor-pointer transition-all border group hover:-translate-y-0.5"
                          style={{
                            borderColor: isSelected ? ACCENT : '#E2E8F0',
                            background: isSelected ? 'rgba(252, 118, 29, 0.05)' : '#FFFFFF',
                            boxShadow: isSelected ? '0 8px 24px rgba(252, 118, 29, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0"
                              style={{
                                background: isSelected ? ACCENT : '#F1F5F9',
                                color: isSelected ? '#FFFFFF' : '#64748B',
                                boxShadow: isSelected ? '0 4px 14px rgba(252, 118, 29, 0.30)' : 'none',
                              }}
                            >
                              <type.icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-sm sm:text-[15px] text-[#0F172A] tracking-tight">
                                {type.title}
                              </div>
                              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">
                                {type.desc}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Passo 2: Nome + URL com Geração Automática e Live Check */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1"
                >
                  <h3 className="text-2xl sm:text-[28px] font-black mb-1.5 text-[#0F172A] tracking-[-0.035em] leading-tight">
                    Como os clientes vão te encontrar?
                  </h3>
                  <p className="text-sm mb-7 text-[#64748B] font-normal leading-relaxed">
                    Defina o nome do seu salão e seu link exclusivo para agendamentos online.
                  </p>

                  <div className="space-y-6">
                    {/* Nome do Estabelecimento */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-bold text-[#334155] mb-2 tracking-[-0.01em]">
                        Nome do Estabelecimento
                      </label>
                      <input
                        {...register('businessName')}
                        placeholder="Ex: Maria Manicure ou Studio Barber"
                        value={businessName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setValue('businessName', val, { shouldValidate: true });
                          if (!userManuallyEditedSlug) {
                            setValue('slug', formatSlug(val), { shouldValidate: true });
                          }
                          setError(null);
                        }}
                        className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all font-semibold text-sm"
                        onFocus={e => {
                          e.currentTarget.style.borderColor = ACCENT;
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(252, 118, 29, 0.15)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = '#CBD5E1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* URL Personalizada com Live Check */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs sm:text-[13px] font-bold text-[#334155] tracking-[-0.01em]">
                          URL Personalizada da sua Página
                        </label>
                        {isCheckingSlug && (
                          <span className="text-xs flex items-center gap-1 font-bold" style={{ color: ACCENT }}>
                            <span className="w-2 h-2 rounded-full animate-ping" style={{ background: ACCENT }} /> Verificando...
                          </span>
                        )}
                      </div>

                      <div className="flex items-center">
                        <span className="px-4 py-3 bg-[#F1F5F9] border border-[#CBD5E1] border-r-0 rounded-l-2xl text-[#64748B] text-xs font-mono font-bold select-none">
                          raffros.com/
                        </span>
                        <input
                          {...register('slug')}
                          placeholder="sua-url"
                          value={slug || ''}
                          onChange={(e) => {
                            setUserManuallyEditedSlug(true);
                            const formatted = formatSlugWhileTyping(e.target.value);
                            setValue('slug', formatted, { shouldValidate: true });
                            setError(null);
                          }}
                          onBlur={() => {
                            if (slug) {
                              setValue('slug', formatSlug(slug), { shouldValidate: true });
                            }
                          }}
                          className={`w-full px-4 py-3 bg-[#F8FAFC] border rounded-r-2xl text-[#0F172A] placeholder-[#94A3B8] font-mono text-sm outline-none transition-all font-bold ${slugStatus === 'available'
                            ? 'border-emerald-500 focus:border-emerald-500 text-emerald-700'
                            : slugStatus === 'taken'
                              ? 'border-amber-500 focus:border-amber-500 text-amber-700'
                              : 'border-[#CBD5E1]'
                            }`}
                        />
                      </div>

                      {/* Status Feedback */}
                      {slugStatus === 'available' && !isCheckingSlug && (
                        <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> URL exclusiva e disponível!
                        </p>
                      )}

                      {slugStatus === 'taken' && !isCheckingSlug && (
                        <div className="mt-2 space-y-2">
                          <p className="text-amber-600 text-xs font-semibold flex items-center gap-1.5">
                            ⚠️ A URL <strong className="font-mono">"{slug}"</strong> já está em uso por outro salão.
                          </p>

                          {/* Sugestões Inteligentes com 1 Clique */}
                          {slugSuggestions.length > 0 && (
                            <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80">
                              <p className="text-[11px] font-extrabold mb-2 flex items-center gap-1.5 uppercase tracking-wider" style={{ color: ACCENT }}>
                                <Sparkles className="w-3.5 h-3.5" /> Sugestões disponíveis com 1 clique:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {slugSuggestions.map((sug) => (
                                  <button
                                    key={sug}
                                    type="button"
                                    onClick={() => {
                                      setValue('slug', sug, { shouldValidate: true });
                                      setUserManuallyEditedSlug(true);
                                    }}
                                    className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-white text-[#FC761D] hover:bg-[#FC761D] hover:text-white border border-[#FC761D]/35 hover:border-[#FC761D] transition-all active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
                                  >
                                    <span>{sug}</span>
                                    <span className="text-[10px] opacity-70">+</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {errors.slug && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.slug.message}</p>}
                      {error && step === 2 && <p className="text-red-500 text-sm mt-2 font-semibold">⚠️ {error}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Passo 3: Identidade, Contato & Localização Detalhada */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 space-y-6"
                >
                  <div>
                    <h3 className="text-2xl sm:text-[28px] font-black mb-1.5 text-[#0F172A] tracking-[-0.035em] leading-tight">
                      Onde você fica e como te contatam?
                    </h3>
                    <p className="text-sm text-[#64748B] font-normal leading-relaxed">
                      Os clientes precisam saber como chegar até seu estabelecimento e falar com você.
                    </p>
                  </div>

                  {/* Bloco 1: Imagens da Marca */}
                  <div className="p-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
                      Identidade Visual
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Logo (Perfil)</label>
                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        <div
                          onClick={() => !isProcessingLogo && logoInputRef.current?.click()}
                          className="h-28 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#FC761D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-white relative hover:bg-[#FC761D]/5"
                        >
                          {isProcessingLogo ? (
                            <div className="flex flex-col items-center gap-2" style={{ color: ACCENT }}>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="text-[10px] font-bold">PROCESSANDO...</span>
                            </div>
                          ) : logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[#94A3B8]">
                              <Upload className="w-5 h-5" />
                              <span className="text-xs font-semibold">Enviar Logo</span>
                            </div>
                          )}
                          {logoSize && !isProcessingLogo && (
                            <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                              {logoSize}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Banner (Capa Superior)</label>
                        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                        <div
                          onClick={() => !isProcessingBanner && bannerInputRef.current?.click()}
                          className="h-28 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#FC761D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-white relative hover:bg-[#FC761D]/5"
                        >
                          {isProcessingBanner ? (
                            <div className="flex flex-col items-center gap-2" style={{ color: ACCENT }}>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="text-[10px] font-bold">PROCESSANDO...</span>
                            </div>
                          ) : bannerPreview ? (
                            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[#94A3B8]">
                              <Image className="w-5 h-5" />
                              <span className="text-xs font-semibold">Enviar Capa</span>
                            </div>
                          )}
                          {bannerSize && !isProcessingBanner && (
                            <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                              {bannerSize}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Descrição curta</span>
                        <span className="text-[11px] text-[#94A3B8]">{shortDescription.length}/180</span>
                      </label>
                      <textarea
                        {...register('shortDescription')}
                        rows={2}
                        placeholder="Ex: Cortes modernos, atendimento exclusivo e ambiente climatizado."
                        className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all resize-none text-xs font-medium"
                        onFocus={e => {
                          e.currentTarget.style.borderColor = ACCENT;
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = '#CBD5E1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>

                  {/* Bloco 2: Contato & Redes */}
                  <div className="p-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
                      Canais de Contato
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-[#334155] flex items-center gap-1">
                            <PhoneIcon className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Oficial
                          </label>
                          {phoneCheckStatus === 'checking' && (
                            <span className="text-[10px] font-bold" style={{ color: ACCENT }}>Verificando...</span>
                          )}
                        </div>
                        <input
                          {...register('phoneNumber')}
                          placeholder="(27) 99730-3135"
                          onChange={(e) => {
                            const masked = formatPhoneMask(e.target.value);
                            setValue('phoneNumber', masked, { shouldValidate: true });
                            setError(null);
                            validatePhoneLive(masked);
                          }}
                          className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all text-xs font-medium ${phoneCheckStatus === 'valid'
                            ? 'border-emerald-500 text-emerald-800'
                            : phoneCheckStatus === 'taken' || phoneCheckStatus === 'invalid'
                              ? 'border-red-500 text-red-700'
                              : 'border-[#CBD5E1]'
                            }`}
                        />
                        {phoneFeedback && (
                          <p className={`text-[11px] mt-1 font-semibold flex items-center gap-1 ${phoneCheckStatus === 'valid'
                            ? 'text-emerald-600'
                            : 'text-red-500'
                            }`}>
                            {phoneCheckStatus === 'valid' ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : '⚠️'} {phoneFeedback}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1.5 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-blue-500" /> E-mail
                        </label>
                        <input
                          {...register('contactEmail')}
                          placeholder="contato@salao.com"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#334155] mb-1.5 flex items-center gap-1">
                          <AtSign className="w-3.5 h-3.5 text-pink-500" /> Instagram (@)
                        </label>
                        <input
                          {...register('instagramHandle')}
                          placeholder="arroba_do_salao"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Localização com cada dado em um input */}
                  <div className="p-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: ACCENT }} /> Localização do Estabelecimento
                    </h4>

                    {/* CEP + Rua + Número */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">CEP</label>
                        <input
                          {...register('zipCode', {
                            onChange: (e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                              setValue('zipCode', val);
                              if (val.length === 8) lookupCep(val);
                            }
                          })}
                          placeholder="00000000"
                          maxLength={8}
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Rua / Logradouro</label>
                        <input
                          {...register('street')}
                          placeholder="Ex: Av. Paulista ou Rua das Flores"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Número</label>
                        <input
                          {...register('streetNumber')}
                          placeholder="123"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    </div>

                    {/* Complemento + Bairro + Cidade + Estado */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Complemento</label>
                        <input
                          {...register('complement')}
                          placeholder="Sala 2, Bloco B..."
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Bairro</label>
                        <input
                          {...register('neighborhood')}
                          placeholder="Centro"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Cidade</label>
                        <input
                          {...register('city')}
                          placeholder="São Paulo"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-bold text-[#334155] mb-1.5">Estado (UF)</label>
                        <input
                          {...register('state')}
                          placeholder="SP"
                          maxLength={2}
                          className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium uppercase"
                          onFocus={e => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    </div>

                    {/* Google Maps Link */}
                    <div>
                      <label className="block text-xs font-bold text-[#334155] mb-1.5">
                        Link do Google Maps (Opcional)
                      </label>
                      <input
                        {...register('googleMapsUrl')}
                        placeholder="Cole o link do Google Maps aqui"
                        className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none text-xs font-medium"
                        onFocus={e => {
                          e.currentTarget.style.borderColor = ACCENT;
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(252, 118, 29, 0.15)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = '#CBD5E1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Passo 4: Conclusão & Trial 7 Dias */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full"
                >
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mb-4 shrink-0 shadow-sm">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black mb-2 text-[#0F172A] tracking-tight shrink-0">
                    Tudo pronto!
                  </h3>
                  <p className="text-[#64748B] text-sm mb-6 max-w-[320px] mx-auto leading-relaxed shrink-0">
                    Seu espaço foi configurado com sucesso e seus 7 dias grátis já estão valendo.
                  </p>

                  <div
                    className="bg-white border rounded-[28px] p-6 w-full max-w-[300px] mb-4 relative shadow-sm shrink-0 flex flex-col items-center mt-3"
                    style={{
                      borderColor: 'rgba(252, 118, 29, 0.25)',
                      boxShadow: '0 8px 30px rgba(252, 118, 29, 0.08)',
                    }}
                  >
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shadow-sm"
                      style={{ background: ACCENT }}
                    >
                      <Star className="w-3 h-3 text-white fill-current" /> Recomendado
                    </div>

                    <h4 className="text-[#0F172A] font-black text-xl mb-1.5 mt-2 text-center leading-tight">
                      🎁 7 dias grátis liberados!
                    </h4>
                    <p className="text-[#64748B] font-medium text-xs mb-5 text-center leading-relaxed">
                      Sua agenda, clientes e equipe organizados em um só lugar.
                      <br />
                      Sem compromisso, sem burocracia.
                    </p>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                          await refreshProfile();
                          window.location.href = '/admin/assinatura';
                        } catch (e) {
                          alert('Erro ao concluir cadastro');
                          setLoading(false);
                        }
                      }}
                      className="w-full text-white h-12 rounded-full font-extrabold flex items-center justify-center transition-all shadow-md text-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                      style={{
                        background: ACCENT,
                        boxShadow: '0 8px 24px rgba(252, 118, 29, 0.30)',
                      }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Começar grátis →'}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                        await refreshProfile();
                        window.location.href = '/admin'; // Dashboard
                      } catch (e) {
                        alert('Erro ao concluir cadastro');
                        setLoading(false);
                      }
                    }}
                    className="text-[#64748B] font-bold text-xs hover:text-[#0F172A] transition-colors underline underline-offset-4 shrink-0 mt-2 cursor-pointer"
                  >
                    Decidir depois (ir para o painel)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Navigation com Botões Pill no estilo Landing Page */}
            {step < 4 && (
              <div className="pt-6 mt-8 border-t border-[#E2E8F0] shrink-0">
                {error && (
                  <div className="mb-4 p-3.5 rounded-2xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-600">
                    ⚠️ {error}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => { setError(null); setStep(step - 1); }}
                      className="flex items-center px-5 py-2.5 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="h-12 px-8 rounded-full font-extrabold text-xs sm:text-sm text-white transition-all flex items-center gap-2 cursor-pointer ml-auto hover:-translate-y-0.5 active:translate-y-0"
                      style={{
                        background: ACCENT,
                        boxShadow: '0 8px 24px rgba(252, 118, 29, 0.28)',
                      }}
                    >
                      <span>Continuar</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit(onSubmit)}
                      disabled={loading}
                      className="h-12 px-8 rounded-full font-extrabold text-xs sm:text-sm text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 ml-auto hover:-translate-y-0.5 active:translate-y-0"
                      style={{
                        background: ACCENT,
                        boxShadow: '0 8px 24px rgba(252, 118, 29, 0.28)',
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Configurando seu Salão...</span>
                        </>
                      ) : (
                        <>
                          <span>Concluir e Acessar Painel</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
