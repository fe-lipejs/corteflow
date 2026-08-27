import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { processFileIfHeic } from '../lib/imageHelper';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Upload, Image, Scissors, MapPin, AtSign, Phone as PhoneIcon, FileText, Sparkles, Star, Mail, Globe, Loader2 } from 'lucide-react';
import { normalizeBrazilianPhone, formatPhoneMask } from '../lib/phoneUtils';

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
        custom_palette: { primary: '#DE870D', fontStyle: 'sans' },
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
        { tenant_id: newTenant.id, name: 'Corte Tradicional', price: 35.00, duration_minutes: 30, buffer_minutes: 0, category: 'Cortes', color: '#DE870D', active: true },
        { tenant_id: newTenant.id, name: 'Barba & Toalha Quente', price: 30.00, duration_minutes: 30, buffer_minutes: 0, category: 'Barba', color: '#DE870D', active: true },
        { tenant_id: newTenant.id, name: 'Combo Cabelo + Barba', price: 60.00, duration_minutes: 50, buffer_minutes: 0, category: 'Combos', color: '#DE870D', active: true },
      ] : data.businessType === 'salao' ? [
        { tenant_id: newTenant.id, name: 'Corte Feminino / Escova', price: 70.00, duration_minutes: 45, buffer_minutes: 0, category: 'Cabelo', color: '#DE870D', active: true },
        { tenant_id: newTenant.id, name: 'Hidratação Profunda', price: 90.00, duration_minutes: 60, buffer_minutes: 0, category: 'Tratamentos', color: '#DE870D', active: true },
      ] : [
        { tenant_id: newTenant.id, name: 'Manicure Completa', price: 35.00, duration_minutes: 40, buffer_minutes: 0, category: 'Unhas', color: '#DE870D', active: true },
        { tenant_id: newTenant.id, name: 'Pedicure Completa', price: 40.00, duration_minutes: 40, buffer_minutes: 0, category: 'Unhas', color: '#DE870D', active: true },
        { tenant_id: newTenant.id, name: 'Alongamento em Gel', price: 120.00, duration_minutes: 90, buffer_minutes: 0, category: 'Alongamento', color: '#DE870D', active: true },
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[50%] bg-[#DE870D]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[40%] h-[40%] bg-[#DE870D]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col md:flex-row border border-[#E2E8F0] shadow-2xl relative z-10 bg-white" style={{ minHeight: '660px' }}>

        {/* Sidebar Progress */}
        <div className="bg-[#F8FAFC] p-8 md:w-64 flex flex-col border-r border-[#E2E8F0]">
          <div className="flex items-center mb-10">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-10 w-auto" />
          </div>

          <div className="flex-1 space-y-6">
            {stepLabels.map((s) => (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num < step) {
                    setError(null);
                    setStep(s.num);
                  }
                }}
                className={`flex items-center gap-3.5 ${s.num < step ? 'cursor-pointer' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${step > s.num
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : step === s.num
                        ? 'bg-[#DE870D] text-white shadow-md shadow-[#DE870D]/25'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-sm font-semibold transition-colors ${step >= s.num ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs font-semibold text-slate-400">
            Passo {step} de 3
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white p-8 md:p-10 flex flex-col justify-between overflow-y-auto max-h-[85vh]">
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
              {/* Step 1: Idioma + Tipo de Negócio */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                  <h3 className="text-2xl font-black mb-1 text-[#0F172A]">Qual é o seu negócio?</h3>
                  <p className="text-sm mb-6 text-[#64748B]">Personalizaremos a plataforma para o seu segmento.</p>

                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Idioma do Sistema</label>
                    <select {...register('language')} className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium">
                      <option value="pt">Português</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'barbearia', title: 'Barbearia', desc: 'Cortes, barba e navalha', icon: Scissors },
                      { id: 'salao', title: 'Salão de Beleza', desc: 'Cabelo, coloração, tratamentos', icon: Star },
                      { id: 'esmalteria', title: 'Esmalteria', desc: 'Manicure, pedicure, nail design', icon: Sparkles },
                    ].map(type => (
                      <div
                        key={type.id}
                        onClick={() => setValue('businessType', type.id as any, { shouldValidate: true })}
                        className="p-4 rounded-2xl cursor-pointer transition-all border group hover:-translate-y-0.5"
                        style={{
                          borderColor: businessType === type.id ? '#DE870D' : '#E2E8F0',
                          background: businessType === type.id ? '#DE870D0C' : '#FFFFFF',
                          boxShadow: businessType === type.id ? '0 4px 12px rgba(222,135,13,0.12)' : 'none',
                        }}
                      >

                        <div className="flex items-center gap-3">
                          <type.icon className="w-6 h-6" style={{ color: businessType === type.id ? '#DE870D' : '#94A3B8' }} />
                          <div>
                            <div className="font-bold text-sm text-[#0F172A]">{type.title}</div>
                            <div className="text-xs mt-0.5 text-[#64748B]">{type.desc}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Nome + URL com Geração Automática e Live Check */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                  <h3 className="text-2xl font-black mb-1 text-[#0F172A]">Como os clientes vão te encontrar?</h3>
                  <p className="text-sm mb-6 text-[#64748B]">Seu link exclusivo para agendamentos online.</p>

                  <div className="space-y-5">
                    {/* Nome do Estabelecimento */}
                    <div>
                      <label className="block text-sm font-semibold text-[#334155] mb-1.5">Nome do Estabelecimento</label>
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
                        className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                      />
                    </div>

                    {/* URL Personalizada com Live Check */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-[#334155]">URL Personalizada da sua Página</label>
                        {isCheckingSlug && (
                          <span className="text-xs text-[#DE870D] flex items-center gap-1 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-[#DE870D] animate-ping" /> Verificando...
                          </span>
                        )}
                      </div>

                      <div className="flex items-center">
                        <span className="px-3.5 py-3 bg-[#F1F5F9] border border-[#CBD5E1] border-r-0 rounded-l-xl text-[#64748B] text-xs font-mono font-medium select-none">
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
                          className={`w-full px-4 py-3 bg-[#F8FAFC] border rounded-r-xl text-[#0F172A] placeholder-[#94A3B8] font-mono text-sm outline-none transition-all font-semibold ${slugStatus === 'available'
                              ? 'border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-green-700'
                              : slugStatus === 'taken'
                                ? 'border-amber-500 focus:border-amber-500 text-amber-700'
                                : 'border-[#CBD5E1] focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20'
                            }`}
                        />
                      </div>

                      {/* Status Feedback */}
                      {slugStatus === 'available' && !isCheckingSlug && (
                        <p className="text-green-600 text-xs mt-2 flex items-center gap-1.5 font-bold">
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
                            <div className="p-3 bg-[#FFFBEB] rounded-xl border border-amber-200">
                              <p className="text-[11px] font-bold text-[#DE870D] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
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
                                    className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-white hover:bg-[#DE870D] text-[#DE870D] hover:text-white border border-[#DE870D]/40 hover:border-[#DE870D] transition-all active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
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

              {/* Step 3: Identidade, Contato & Localização Detalhada */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 space-y-6">
                  <div>
                    <h3 className="text-2xl font-black mb-1 text-[#0F172A]">Onde você fica?</h3>
                    <p className="text-slate-500 font-medium">Os clientes precisam saber como chegar até você.</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/60 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Imagens da Marca</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#334155] mb-1.5">Logo (Perfil)</label>
                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        <div
                          onClick={() => !isProcessingLogo && logoInputRef.current?.click()}
                          className="h-28 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#DE870D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-white relative"
                        >
                          {isProcessingLogo ? (
                            <div className="flex flex-col items-center gap-2 text-[#DE870D]">
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="text-[10px] font-bold">PROCESSANDO...</span>
                            </div>
                          ) : logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[#94A3B8]">
                              <Upload className="w-5 h-5" />
                              <span className="text-xs font-medium">Enviar Logo</span>
                            </div>
                          )}
                          {logoSize && !isProcessingLogo && (
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                              {logoSize}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#334155] mb-1.5">Banner (Capa Superior)</label>
                        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                        <div
                          onClick={() => !isProcessingBanner && bannerInputRef.current?.click()}
                          className="h-28 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#DE870D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-white relative"
                        >
                          {isProcessingBanner ? (
                            <div className="flex flex-col items-center gap-2 text-[#DE870D]">
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="text-[10px] font-bold">PROCESSANDO...</span>
                            </div>
                          ) : bannerPreview ? (
                            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[#94A3B8]">
                              <Image className="w-5 h-5" />
                              <span className="text-xs font-medium">Enviar Capa</span>
                            </div>
                          )}
                          {bannerSize && !isProcessingBanner && (
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                              {bannerSize}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#334155] mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Descrição curta</span>
                        <span className="text-[11px] text-[#94A3B8]">{shortDescription.length}/180</span>
                      </label>
                      <textarea
                        {...register('shortDescription')}
                        rows={2}
                        placeholder="Ex: Cortes modernos, atendimento exclusivo e ambiente climatizado."
                        className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all resize-none text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Bloco 2: Contato & Redes */}
                  <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/60 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Contato</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-[#334155] flex items-center gap-1">
                            <PhoneIcon className="w-3 h-3 text-emerald-500" /> Telefone / WhatsApp do estabelecimento
                          </label>
                          {phoneCheckStatus === 'checking' && (
                            <span className="text-[10px] text-[#DE870D] font-bold">Verificando...</span>
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
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all text-xs font-medium ${phoneCheckStatus === 'valid'
                              ? 'border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-green-800'
                              : phoneCheckStatus === 'taken' || phoneCheckStatus === 'invalid'
                                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-red-700'
                                : 'border-[#CBD5E1] focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20'
                            }`}
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
                        <label className="block text-xs font-semibold text-[#334155] mb-1 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-blue-500" /> E-mail
                        </label>
                        <input
                          {...register('contactEmail')}
                          placeholder="contato@salao.com"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#334155] mb-1 flex items-center gap-1">
                          <AtSign className="w-3 h-3 text-pink-500" /> Instagram (@)
                        </label>
                        <input
                          {...register('instagramHandle')}
                          placeholder="arroba_do_salao"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Localização com cada dado em um input */}
                  <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/60 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#DE870D]" /> Localização do Estabelecimento
                    </h4>

                    {/* CEP + Rua + Número */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">CEP</label>
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
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Rua / Logradouro</label>
                        <input
                          {...register('street')}
                          placeholder="Ex: Av. Paulista ou Rua das Flores"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Número</label>
                        <input
                          {...register('streetNumber')}
                          placeholder="123"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Complemento + Bairro + Cidade + Estado */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Complemento</label>
                        <input
                          {...register('complement')}
                          placeholder="Sala 2, Bloco B..."
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Bairro</label>
                        <input
                          {...register('neighborhood')}
                          placeholder="Centro"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Cidade</label>
                        <input
                          {...register('city')}
                          placeholder="São Paulo"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[#334155] mb-1">Estado</label>
                        <input
                          {...register('state')}
                          placeholder="SP"
                          maxLength={2}
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Google Maps Link */}
                    <div>
                      <label className="block text-xs font-semibold text-[#334155] mb-1">
                        Link do Google Maps (Opcional)
                      </label>
                      <input
                        {...register('googleMapsUrl')}
                        placeholder="Cole o link curto do Google Maps aqui"
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] text-xs font-medium"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-[#DE870D]/10 rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-[#DE870D]" />
                  </div>
                  
                  <h3 className="text-3xl font-black mb-3 text-[#0F172A]">Tudo pronto!</h3>
                  <p className="text-slate-500 text-lg mb-8 max-w-sm mx-auto">
                    Seu espaço está configurado. Ative sua assinatura agora para desbloquear sua agenda e começar a receber clientes.
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 w-full max-w-sm mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Recomendado</div>
                    <div className="flex items-center justify-center gap-2 mb-2 text-[#0F172A] font-black text-2xl">
                      <Star className="w-6 h-6 text-[#DE870D] fill-[#DE870D]" />
                      Escolha seu plano ideal
                    </div>
                    <p className="text-slate-600 font-medium text-sm mb-4 text-center">Teste grátis por 7 dias. Você só será cobrado depois e pode cancelar a qualquer momento.</p>
                    
                    <button
                      type="button"
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                          await refreshProfile();
                          window.location.href = '/admin/assinatura';
                        } catch(e) {
                          alert('Erro ao concluir cadastro');
                          setLoading(false);
                        }
                      }}
                      className="w-full bg-[#0F172A] text-white h-14 rounded-xl font-bold flex items-center justify-center hover:bg-[#1E293B] transition-colors shadow-lg"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Escolher Meu Plano'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                      await refreshProfile();
                      window.location.href = '/admin'; // Dashboard/Visão Geral
                    }}
                    className="text-slate-500 font-semibold text-sm hover:text-slate-800 transition-colors"
                  >
                    Pular para Visão Geral
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          {/* Bottom Fixed Navigation */}
          {step < 4 && (
            <div className="p-6 border-t border-slate-100 bg-white/50 backdrop-blur-md sticky bottom-0 z-20 shrink-0">
            {error && (
              <div className="mt-4 p-3 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-600">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[#E2E8F0] flex justify-between items-center">
              {step > 1 ? (
                <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="flex items-center px-4 py-2 text-[#64748B] hover:text-[#0F172A] font-semibold text-xs transition-colors cursor-pointer">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </button>
              ) : (
                <div></div>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  <span>Continuar</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={loading}
                  className="px-7 py-3 rounded-xl font-bold text-xs text-white shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Configurando seu Salão...</span>
                    </>
                  ) : (
                    <>
                      <span>Concluir e Acessar Painel</span>
                      <ChevronRight className="w-4 h-4" />
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

