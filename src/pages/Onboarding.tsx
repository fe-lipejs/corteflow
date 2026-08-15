import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Upload, Image, Scissors, MapPin, AtSign, Phone as PhoneIcon, FileText, Sparkles, Star } from 'lucide-react';

const onboardingSchema = z.object({
  language: z.enum(['pt', 'en', 'es', 'fr', 'de']),
  businessType: z.enum(['barbearia', 'salao', 'esmalteria']).optional(),
  businessName: z.string().min(1, "Informe o nome do estabelecimento").optional(),
  slug: z.string().regex(/^[a-z0-9-_]+$/, "Apenas letras minúsculas, números, hífens e sublinhados").optional(),
  themePreset: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().optional().or(z.literal('')),
  instagramHandle: z.string().optional(),
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
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, profile, tenant, loading: authLoading, refreshProfile } = useAuth();

  // ── Live URL Verification States ──
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [userManuallyEditedSlug, setUserManuallyEditedSlug] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (profile?.onboarding_completed || profile?.role === 'super_admin') {
        navigate('/app', { replace: true });
      }
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
      address: '',
      googleMapsUrl: '',
      instagramHandle: '',
      phoneNumber: '',
      shortDescription: '',
    }
  });

  const businessName = watch('businessName') || '';
  const businessType = watch('businessType');
  const themePreset = watch('themePreset') || 'elegant';
  const slug = watch('slug') || '';
  const shortDescription = watch('shortDescription') || '';

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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, tenantId: string, type: 'logo' | 'banner'): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${tenantId}/${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('public_assets').upload(path, file, { upsert: true });
      if (uploadError) {
        console.warn('Upload error:', uploadError);
        return null;
      }
      const { data } = supabase.storage.from('public_assets').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.warn('Erro ao processar imagem:', e);
      return null;
    }
  };

  const onSubmit = async (data: OnboardingForm) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 0. Double check existing tenant
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
          onboarding_completed: true,
        } as any);
        await refreshProfile();
        window.location.href = '/app';
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

      // 2. Update Profile with role 'admin' and onboarding_completed: true
      await supabase.from('profiles').upsert({
        id: user.id,
        tenant_id: newTenant.id,
        role: 'admin',
        full_name: user.user_metadata?.full_name || 'Dono do Salão',
        onboarding_completed: true,
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

      // 4. Create tenant_settings with initial local-only payments
      const { error: settingsError } = await supabase.from('tenant_settings').insert({
        tenant_id: newTenant.id,
        theme_preset: data.themePreset || 'elegant',
        custom_palette: { primary: '#DE870D', fontStyle: 'sans' },
        logo_url: logoUrl,
        banner_url: bannerUrl,
        short_description: data.shortDescription || '',
        description: data.shortDescription || '',
        phone: data.phoneNumber || user.user_metadata?.phone || '',
        whatsapp_number: data.phoneNumber || user.user_metadata?.phone || '',
        address: data.address || '',
        full_address: data.address || '',
        instagram: data.instagramHandle ? data.instagramHandle.replace(/^@/, '') : '',
        map_link: data.googleMapsUrl || '',
        booking_payment_mode: 'local',
        online_payment_enabled: false,
        payment_methods: { pay_local: true, partial_50: false, full_100: false },
      } as any);

      if (settingsError) {
        console.warn('Erro ao salvar settings (prosseguindo):', settingsError);
      }

      // 5. Create default business hours
      const defaultHours = [
        { tenant_id: newTenant.id, weekday: 0, is_open: false, open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 1, is_open: true,  open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 2, is_open: true,  open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 3, is_open: true,  open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 4, is_open: true,  open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 5, is_open: true,  open_time: '09:00', close_time: '19:00' },
        { tenant_id: newTenant.id, weekday: 6, is_open: true,  open_time: '09:00', close_time: '18:00' },
      ];
      await supabase.from('business_hours').insert(defaultHours as any);

      // 6. Create default starter professional (the owner)
      await supabase.from('professionals').insert({
        tenant_id: newTenant.id,
        name: user.user_metadata?.full_name || 'Profissional Principal',
        role_title: data.businessType === 'barbearia' ? 'Barbeiro' : data.businessType === 'salao' ? 'Cabeleireiro' : 'Nail Designer',
        active: true,
      } as any);

      // 7. Create default starter service
      await supabase.from('services').insert({
        tenant_id: newTenant.id,
        name: data.businessType === 'barbearia' ? 'Corte de Cabelo' : data.businessType === 'salao' ? 'Corte & Escova' : 'Manicure Completa',
        price: 35.00,
        duration_minutes: 45,
        buffer_minutes: 10,
        active: true,
        category: 'Geral',
        color: '#DE870D',
      } as any);

      // 8. Associate trial plan subscription
      const { data: planData } = await supabase
        .from('plans')
        .select('id, trial_days')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      const plan = planData as any;
      
      if (plan) {
        const trialDays = plan.trial_days ?? 7;
        const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('subscriptions').insert({
          tenant_id: newTenant.id,
          plan_id: plan.id,
          status: 'trial',
          trial_ends_at: trialEndsAt,
          current_period_end: trialEndsAt,
        } as any);
      }

      await refreshProfile();
      // Direct hard redirect to ensure state is clean
      window.location.href = '/app';

    } catch (err: any) {
      console.error('Onboarding submission error:', err);
      setError(err?.message || 'Erro inesperado ao salvar. Tente novamente.');
      setLoading(false);
    }
  };

  const nextDisabled = () => {
    if (step === 1) return !businessType;
    if (step === 2) return !businessName.trim() || !slug?.trim() || slugStatus === 'taken' || isCheckingSlug;
    return false;
  };

  const handleNextStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);
    if (step === 2) {
      if (slugStatus === 'taken') {
        setError('Essa URL já está em uso por outro salão. Escolha uma das sugestões ou digite outra.');
        return;
      }
    }
    if (step < 3) {
      setStep(prev => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'TEXTAREA') {
        return; // Allow newlines in textarea
      }
      e.preventDefault();
      if (step < 3) {
        if (!nextDisabled() && !loading) {
          handleNextStep();
        }
      } else {
        handleSubmit(onSubmit)();
      }
    }
  };

  if (!user) return null;

  const stepLabels = [
    { num: 1, label: 'Negócio' },
    { num: 2, label: 'Identidade' },
    { num: 3, label: 'Detalhes' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[50%] bg-[#DE870D]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[40%] h-[40%] bg-[#DE870D]/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col md:flex-row border border-[#E2E8F0] shadow-2xl relative z-10 bg-white" style={{ minHeight: '620px' }}>
        
        {/* Sidebar Progress */}
        <div className="bg-[#F8FAFC] p-8 md:w-60 flex flex-col border-r border-[#E2E8F0]">
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
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                    step > s.num 
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
        <div className="flex-1 bg-white p-8 md:p-10 flex flex-col justify-between">
          <form 
            onSubmit={handleSubmit(onSubmit)} 
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
                          placeholder="Ex: Maria Manic ou Studio Barber"
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
                            corteflow.com/
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
                            className={`w-full px-4 py-3 bg-[#F8FAFC] border rounded-r-xl text-[#0F172A] placeholder-[#94A3B8] font-mono text-sm outline-none transition-all font-semibold ${
                              slugStatus === 'available' 
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
                                      className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-white hover:bg-[#DE870D] text-[#DE870D] hover:text-white border border-[#DE870D]/40 hover:border-[#DE870D] transition-all active:scale-95 flex items-center gap-1 shadow-sm"
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

                {/* Step 3: Identidade — Logo, Banner, Instagram, Endereço, Telefone, Descrição, Google Maps */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto pr-1">
                    <h3 className="text-2xl font-black mb-1 text-[#0F172A]">Identidade do seu estabelecimento</h3>
                    <p className="text-sm mb-6 text-[#64748B]">Faça sua página se destacar. Tudo editável depois.</p>
                    
                    <div className="space-y-5">
                      {/* Logo Upload */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5">Logo (quadrado, mínimo 400x400)</label>
                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        <div 
                          onClick={() => logoInputRef.current?.click()} 
                          className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#DE870D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-[#F8FAFC]"
                        >
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-6 h-6 text-[#94A3B8]" />
                          )}
                        </div>
                      </div>

                      {/* Banner Upload */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5">Banner (1600x600 ideal)</label>
                        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                        <div 
                          onClick={() => bannerInputRef.current?.click()} 
                          className="w-full h-28 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#DE870D] cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-[#F8FAFC]"
                        >
                          {bannerPreview ? (
                            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center gap-2 text-[#94A3B8]">
                              <Image className="w-5 h-5" />
                              <span className="text-sm font-medium">Clique para enviar</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Descrição curta */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Descrição curta</span>
                          <span className="text-xs text-[#94A3B8]">{shortDescription.length}/180</span>
                        </label>
                        <textarea
                          {...register('shortDescription')}
                          rows={2}
                          placeholder="Ex: Cortes modernos, atendimento exclusivo e ambiente climatizado."
                          className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all resize-none text-sm font-medium"
                        />
                      </div>

                      {/* Instagram */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5 flex items-center gap-1">
                          <AtSign className="w-3.5 h-3.5" /> Instagram
                        </label>
                        <div className="flex items-center">
                          <span className="px-3.5 py-3 bg-[#F1F5F9] border border-[#CBD5E1] border-r-0 rounded-l-xl text-[#64748B] text-sm font-semibold">@</span>
                          <input 
                            {...register('instagramHandle')} 
                            placeholder="seuestabelecimento"
                            className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-r-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium" 
                          />
                        </div>
                      </div>

                      {/* Endereço */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Endereço
                        </label>
                        <input 
                          {...register('address')} 
                          placeholder="Rua Exemplo, 123 — Bairro, Cidade"
                          className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium" 
                        />
                      </div>

                      {/* Google Maps Link */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#DE870D]" /> Link do Google Maps (Localização Exata)
                        </label>
                        <input 
                          {...register('googleMapsUrl')} 
                          placeholder="https://maps.app.goo.gl/... ou link do Google Maps"
                          className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all text-sm font-medium" 
                        />
                      </div>

                      {/* Telefone do salão */}
                      <div>
                        <label className="block text-sm font-semibold text-[#334155] mb-1.5 flex items-center gap-1">
                          <PhoneIcon className="w-3.5 h-3.5" /> Telefone / WhatsApp do estabelecimento
                        </label>
                        <input 
                          {...register('phoneNumber')} 
                          placeholder="11999999999"
                          className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            {error && (
              <div className="mt-4 p-3 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-600">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[#E2E8F0] flex justify-between">
              {step > 1 ? (
                <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="flex items-center px-4 py-2 text-[#64748B] hover:text-[#0F172A] font-semibold transition-colors">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </button>
              ) : (
                <div></div>
              )}
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={nextDisabled() || loading}
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  {loading ? 'Verificando...' : 'Próximo'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  {loading ? 'Salvando...' : 'Finalizar e Acessar'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
