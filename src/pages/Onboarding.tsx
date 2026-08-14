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
  businessName: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens").optional(),
  themePreset: z.string().optional(),
  address: z.string().optional(),
  instagramHandle: z.string().optional(),
  phoneNumber: z.string().optional(),
  shortDescription: z.string().max(180, "Máximo 180 caracteres").optional(),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

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

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (tenant || profile?.tenant_id || profile?.role === 'owner' || profile?.role === 'super_admin') {
        navigate('/app', { replace: true });
      }
    }
  }, [user, profile, tenant, authLoading, navigate]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      language: 'pt',
      themePreset: 'noir'
    }
  });

  const businessType = watch('businessType');
  const themePreset = watch('themePreset');
  const slug = watch('slug');
  const shortDescription = watch('shortDescription') || '';

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
    const ext = file.name.split('.').pop();
    const path = `${tenantId}/${type}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }
    const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const onSubmit = async (data: OnboardingForm) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create Tenant
      const { data: tenantData, error: tenantError } = await supabase.from('tenants').insert({
        owner_user_id: user.id,
        business_type: data.businessType || 'barbearia',
        name: data.businessName!,
        slug: data.slug!,
        language: data.language,
        status: 'trial'
      } as any).select('id').single();
      const tenant = tenantData as any;

      if (tenantError) throw tenantError;

      // 2. Update Profile
      await supabase.from('profiles').upsert({
        id: user.id,
        tenant_id: tenant.id,
        role: 'owner',
        full_name: user.user_metadata?.full_name || 'Owner'
      } as any);

      // 3. Upload logo & banner
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;
      
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, tenant.id, 'logo');
      }
      if (bannerFile) {
        bannerUrl = await uploadFile(bannerFile, tenant.id, 'banner');
      }

      // 4. Create tenant_settings with all info
      await supabase.from('tenant_settings').insert({
        tenant_id: tenant.id,
        theme_preset: data.themePreset || 'noir',
        logo_url: logoUrl,
        banner_url: bannerUrl,
        short_description: data.shortDescription || '',
        phone: data.phoneNumber || user.user_metadata?.phone || '',
        address: data.address || '',
        instagram: data.instagramHandle || '',
      } as any);

      // 5. Create Subscription Trial — uses trial_days configured in the plan by Super Admin
      const { data: planData } = await supabase
        .from('plans')
        .select('id, trial_days')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      const plan = planData as any;
      
      if (plan) {
        const trialDays = plan.trial_days ?? 7; // fallback to 7 if not set
        const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('subscriptions').insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          status: 'trial',
          trial_ends_at: trialEndsAt,
          current_period_end: trialEndsAt,
        } as any);
      }

      await refreshProfile();
      navigate('/app');

    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  const nextDisabled = () => {
    if (step === 1) return !businessType;
    if (step === 2) return !watch('businessName') || !watch('slug') || !!errors.slug;
    return false;
  };

  const handleNextStep = async () => {
    if (step === 2) {
      setLoading(true);
      setError(null);
      try {
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', watch('slug')!)
          .maybeSingle();

        if (existingTenant) {
          setError('Essa URL já está em uso por outro salão. Por favor, escolha outra.');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error(err);
      }
      setLoading(false);
    }
    setStep(step + 1);
  };

  if (!user) return null;

  const stepLabels = [
    { num: 1, label: 'Negócio' },
    { num: 2, label: 'Endereço' },
    { num: 3, label: 'Identidade' },
    { num: 4, label: 'Visual' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#000000] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[50%] bg-[#C9963B]/5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col md:flex-row border border-[#222222] shadow-2xl relative z-10" style={{ minHeight: '600px' }}>
        
        {/* Sidebar Progress */}
        <div className="bg-[#050505] p-8 md:w-60 flex flex-col border-r border-[#222222]">
          <div className="flex items-center mb-10">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-10 w-auto" />
          </div>
          <div className="space-y-5 flex-1">
            {stepLabels.map((s) => (
              <div key={s.num} className={`flex items-center gap-3 transition-all ${step >= s.num ? 'text-white' : 'text-[#555]'}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all" style={{
                  background: step > s.num ? '#22c55e' : step === s.num ? 'linear-gradient(135deg, #C9963B, #E8B960)' : '#0A0A0A',
                  color: step === s.num ? '#000000' : step > s.num ? 'white' : '#555',
                  border: step < s.num ? '1px solid #222222' : 'none',
                }}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="font-medium text-sm">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#555] mt-auto">Passo {step} de 4</p>
        </div>

        {/* Form Content */}
        <div className="p-8 flex-1 flex flex-col bg-[#0A0A0A]">
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
            <AnimatePresence mode="wait">

              {/* Step 1: Tipo de Negócio + Idioma */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                  <h3 className="text-2xl font-bold mb-1 text-white">Qual é o seu negócio?</h3>
                  <p className="text-sm mb-6 text-[#A1A1AA]">Escolha o tipo para personalizar sua experiência.</p>
                  
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
                        onClick={() => setValue('businessType', type.id as any)}
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

              {/* Step 2: Nome + URL */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                  <h3 className="text-2xl font-bold mb-1 text-white">Como os clientes vão te encontrar?</h3>
                  <p className="text-sm mb-6 text-[#A1A1AA]">Você poderá alterar depois nas configurações.</p>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Nome do Estabelecimento</label>
                      <input 
                        {...register('businessName')} 
                        placeholder="Ex: Studio VIP"
                        onChange={(e) => {
                           setValue('businessName', e.target.value);
                           if (!slug || slug === '') {
                             setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                           }
                        }}
                        className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">URL Personalizada</label>
                      <div className="flex items-center">
                        <span className="px-4 py-3 bg-[#050505] border border-[#222222] border-r-0 rounded-l-xl text-[#555] text-sm font-medium">navalha.app/</span>
                        <input 
                          {...register('slug')} 
                          onChange={(e) => {
                            setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                            setError(null);
                          }}
                          className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-r-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 transition-all" 
                        />
                      </div>
                      {errors.slug && <p className="text-red-400 text-xs mt-1.5">{errors.slug.message}</p>}
                      {error && step === 2 && <p className="text-red-400 text-sm mt-2 font-medium">⚠️ {error}</p>}
                      {(!error || step !== 2) && !errors.slug && (
                        <p className="text-[#555] text-xs mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> A disponibilidade da URL será verificada ao avançar.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Identidade — Logo, Banner, Instagram, Endereço, Telefone, Descrição */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto">
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

                    {/* Telefone do salão */}
                    <div>
                      <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5 flex items-center gap-1">
                        <PhoneIcon className="w-3.5 h-3.5" /> Telefone do salão (para agendamentos)
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

              {/* Step 4: Theme */}
              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                  <h3 className="text-2xl font-bold mb-1 text-white">Escolha o estilo</h3>
                  <p className="text-sm mb-6 text-[#A1A1AA]">O tema define a aparência da sua página pública. Personalizável depois.</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'classic', title: 'Clássica', previewBg: '#1A1A1A', btnBg: '#C9963B', btnText: '#111', textC: '#fff' },
                      { id: 'noir', title: 'Noir', previewBg: '#000', btnBg: '#FFEE00', btnText: '#000', textC: '#fff' },
                      { id: 'elegant', title: 'Elegant', previewBg: '#FAF7F4', btnBg: '#D4927A', btnText: 'white', textC: '#3D2B1F' },
                    ].map(theme => (
                      <div
                        key={theme.id}
                        onClick={() => setValue('themePreset', theme.id)}
                        className="rounded-xl cursor-pointer transition-all overflow-hidden border-2 hover:-translate-y-0.5"
                        style={{ borderColor: themePreset === theme.id ? '#C9963B' : '#222222', boxShadow: themePreset === theme.id ? '0 0 15px rgba(201,150,59,0.15)' : 'none' }}
                      >
                        <div className="p-4 flex flex-col gap-2" style={{ background: theme.previewBg, minHeight: '90px' }}>
                          <span className="font-serif font-bold text-sm" style={{ color: theme.textC }}>Salão</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full self-start" style={{ background: theme.btnBg, color: theme.btnText }}>Agendar</span>
                        </div>
                        <div className="p-3 bg-[#0A0A0A]">
                          <p className="font-bold text-xs text-white">{theme.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="mt-6 p-4 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400">
                      ⚠️ {error}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-[#222222] flex justify-between">
              {step > 1 ? (
                <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="flex items-center px-4 py-2 text-[#A1A1AA] hover:text-white font-medium transition-colors">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </button>
              ) : (
                <div></div>
              )}
              
              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={nextDisabled() || loading}
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(201,150,59,0.2)]"
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
                >
                  {loading ? 'Verificando...' : 'Próximo'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(201,150,59,0.2)]"
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
