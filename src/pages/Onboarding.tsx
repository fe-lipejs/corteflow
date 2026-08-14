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
      themePreset: 'noir',
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
  const themePreset = watch('themePreset') || 'noir';
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
        status: 'trial'
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

      // 4. Create tenant_settings with ALL fields (including Google Maps)
      const { error: settingsError } = await supabase.from('tenant_settings').insert({
        tenant_id: newTenant.id,
        theme_preset: data.themePreset || 'noir',
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
        color: '#C9963B',
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#000000] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[50%] bg-[#C9963B]/5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col md:flex-row border border-[#222222] shadow-2xl relative z-10" style={{ minHeight: '620px' }}>
        
        {/* Sidebar Progress */}
        <div className="bg-[#050505] p-8 md:w-60 flex flex-col border-r border-[#222222]">
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
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : step === s.num 
                        ? 'bg-[#C9963B] text-black shadow-[0_0_15px_rgba(201,150,59,0.3)]' 
                        : 'bg-[#111111] text-[#555] border border-[#222222]'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-sm font-medium transition-colors ${step >= s.num ? 'text-white' : 'text-[#555]'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs text-[#555]">
            Passo {step} de 3
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#0A0A0A] p-8 md:p-10 flex flex-col justify-between">
          <form 
            onSubmit={handleSubmit(onSubmit)} 
            onKeyDown={handleKeyDown}
            className="flex-1 flex flex-col justify-between"
          >
              <AnimatePresence mode="wait">
                {/* Step 1: Idioma + Tipo de Negócio */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                    <h3 className="text-2xl font-bold mb-1 text-white">Qual é o seu negócio?</h3>
                    <p className="text-sm mb-6 text-[#A1A1AA]">Personalizaremos a plataforma para o seu segmento.</p>

                    <div className="mb-5">
                      <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Idioma do Sistema</label>
                      <select {...register('language')} className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white outline-none focus:border-[#C9963B]/50 transition-all">
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
                          className="p-4 rounded-xl cursor-pointer transition-all border group hover:-translate-y-0.5"
                          style={{
                            borderColor: businessType === type.id ? '#C9963B' : '#222222',
                            background: businessType === type.id ? '#C9963B10' : '#050505',
                            boxShadow: businessType === type.id ? '0 0 15px rgba(201,150,59,0.1)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <type.icon className="w-6 h-6" style={{ color: businessType === type.id ? '#C9963B' : '#A1A1AA' }} />
                            <div>
                              <div className="font-bold text-sm text-white">{type.title}</div>
                              <div className="text-xs mt-0.5 text-[#A1A1AA]">{type.desc}</div>
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
                    <h3 className="text-2xl font-bold mb-1 text-white">Como os clientes vão te encontrar?</h3>
                    <p className="text-sm mb-6 text-[#A1A1AA]">Seu link exclusivo para agendamentos online.</p>
                    
                    <div className="space-y-5">
                      {/* Nome do Estabelecimento */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Nome do Estabelecimento</label>
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
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all font-medium" 
                        />
                      </div>

                      {/* URL Personalizada com Live Check */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-medium text-[#A1A1AA]">URL Personalizada da sua Página</label>
                          {isCheckingSlug && (
                            <span className="text-xs text-[#A1A1AA] flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-[#C9963B] animate-ping" /> Verificando...
                            </span>
                          )}
                        </div>

                        <div className="flex items-center">
                          <span className="px-3.5 py-3 bg-[#050505] border border-[#222222] border-r-0 rounded-l-xl text-[#666] text-xs font-mono font-medium select-none">
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
                            className={`w-full px-4 py-3 bg-[#050505] border rounded-r-xl text-white placeholder-[#555] font-mono text-sm outline-none transition-all ${
                              slugStatus === 'available' 
                                ? 'border-green-500/50 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 text-green-400' 
                                : slugStatus === 'taken' 
                                  ? 'border-amber-500/50 focus:border-amber-500 text-amber-400' 
                                  : 'border-[#222222] focus:border-[#C9963B]/50'
                            }`}
                          />
                        </div>

                        {/* Status Feedback */}
                        {slugStatus === 'available' && !isCheckingSlug && (
                          <p className="text-green-400 text-xs mt-2 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> URL exclusiva e disponível!
                          </p>
                        )}

                        {slugStatus === 'taken' && !isCheckingSlug && (
                          <div className="mt-2 space-y-2">
                            <p className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
                              ⚠️ A URL <strong className="font-mono">"{slug}"</strong> já está em uso por outro salão.
                            </p>

                            {/* Sugestões Inteligentes com 1 Clique */}
                            {slugSuggestions.length > 0 && (
                              <div className="p-3 bg-[#111111] rounded-xl border border-[#222222]">
                                <p className="text-[11px] font-bold text-[#C9963B] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
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
                                      className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#050505] hover:bg-[#C9963B] text-[#C9963B] hover:text-black border border-[#C9963B]/30 hover:border-[#C9963B] transition-all active:scale-95 flex items-center gap-1"
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

                        {errors.slug && <p className="text-red-400 text-xs mt-1.5">{errors.slug.message}</p>}
                        {error && step === 2 && <p className="text-red-400 text-sm mt-2 font-medium">⚠️ {error}</p>}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Identidade — Logo, Banner, Instagram, Endereço, Telefone, Descrição, Google Maps */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto pr-1">
                    <h3 className="text-2xl font-bold mb-1 text-white">Identidade do seu salão</h3>
                    <p className="text-sm mb-6 text-[#A1A1AA]">Faça sua página se destacar. Tudo editável depois.</p>
                    
                    <div className="space-y-5">
                      {/* Logo Upload */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Logo (quadrado, mínimo 400x400)</label>
                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        <div 
                          onClick={() => logoInputRef.current?.click()} 
                          className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#222222] hover:border-[#C9963B]/50 cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-[#050505]"
                        >
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-6 h-6 text-[#555]" />
                          )}
                        </div>
                      </div>

                      {/* Banner Upload */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Banner (1600x600 ideal)</label>
                        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                        <div 
                          onClick={() => bannerInputRef.current?.click()} 
                          className="w-full h-28 rounded-2xl border-2 border-dashed border-[#222222] hover:border-[#C9963B]/50 cursor-pointer flex items-center justify-center overflow-hidden transition-all bg-[#050505]"
                        >
                          {bannerPreview ? (
                            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center gap-2 text-[#555]">
                              <Image className="w-5 h-5" />
                              <span className="text-sm">Clique para enviar</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Descrição curta */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Descrição curta</span>
                          <span className="text-xs text-[#555]">{shortDescription.length}/180</span>
                        </label>
                        <textarea
                          {...register('shortDescription')}
                          rows={2}
                          placeholder="Ex: A melhor barbearia do bairro. Cortes modernos e ambiente exclusivo."
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all resize-none text-sm"
                        />
                      </div>

                      {/* Instagram */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center gap-1">
                          <AtSign className="w-3.5 h-3.5" /> Instagram
                        </label>
                        <div className="flex items-center">
                          <span className="px-3 py-3 bg-[#050505] border border-[#222222] border-r-0 rounded-l-xl text-[#555] text-sm">@</span>
                          <input 
                            {...register('instagramHandle')} 
                            placeholder="seusalao"
                            className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-r-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all" 
                          />
                        </div>
                      </div>

                      {/* Endereço */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Endereço
                        </label>
                        <input 
                          {...register('address')} 
                          placeholder="Rua Exemplo, 123 — Bairro, Cidade"
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all" 
                        />
                      </div>

                      {/* Google Maps Link */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#C9963B]" /> Link do Google Maps (Localização Exata)
                        </label>
                        <input 
                          {...register('googleMapsUrl')} 
                          placeholder="https://maps.app.goo.gl/... ou link do Google Maps"
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all text-sm" 
                        />
                      </div>

                      {/* Telefone do salão */}
                      <div>
                        <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center gap-1">
                          <PhoneIcon className="w-3.5 h-3.5" /> Telefone / WhatsApp do salão
                        </label>
                        <input 
                          {...register('phoneNumber')} 
                          placeholder="11999999999"
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            {error && (
              <div className="mt-4 p-3 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-[#222222] flex justify-between">
              {step > 1 ? (
                <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="flex items-center px-4 py-2 text-[#A1A1AA] hover:text-white font-medium transition-colors">
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
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(201,150,59,0.2)] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
                >
                  {loading ? 'Verificando...' : 'Próximo'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(201,150,59,0.2)] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
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
