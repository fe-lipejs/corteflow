import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Eye, EyeOff, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { normalizeBrazilianPhone, formatPhoneMask } from '../lib/phoneUtils';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackEvent } from '../lib/analytics';

const cadastroSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  phone: z.string().min(1, "Informe o telefone com DDD. Ex.: (27) 99730-3135."),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export default function Cadastro() {
  usePageTracking();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorList, setErrorList] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email Sent Confirmation Screen
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isValid } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    mode: 'onChange',
  });

  // Countdown timer for resend
  useEffect(() => {
    let interval: any = null;
    if (emailSent && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailSent, resendTimer]);

  const onSubmit = async (data: CadastroForm) => {
    setLoading(true);
    setLoadingStep('Validando informações...');
    setErrorList([]);

    // 1. Validação estrita de senha e confirmação de senha
    if (data.password !== data.confirmPassword) {
      setErrorList(['As senhas não coincidem.']);
      setLoading(false);
      return;
    }

    // 2. Validação e normalização arquitetural do telefone brasileiro (SSOT)
    const phoneValidation = normalizeBrazilianPhone(data.phone);
    if (!phoneValidation.isValid || !phoneValidation.normalized) {
      setErrorList([phoneValidation.error || 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.']);
      setLoading(false);
      return;
    }

    const cleanPhone = phoneValidation.normalized;
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      // 3. Verificação rápida de duplicidade com timeout tolerante de 3.5s
      setLoadingStep('Verificando disponibilidade...');
      try {
        const availabilityPromise = supabase.rpc('check_registration_availability', {
          p_email: cleanEmail,
          p_phone: cleanPhone
        });

        const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3500)
        );

        const { data: availability, error: availError } = await Promise.race([
          availabilityPromise,
          timeoutPromise
        ]);

        if (!availError && availability) {
          const foundErrors: string[] = [];

          if (availability.email_exists) {
            foundErrors.push('Este e-mail já está cadastrado.');
          }

          if (availability.phone_exists) {
            foundErrors.push('Este número de telefone já está cadastrado.');
          }

          if (availability.phone_invalid) {
            foundErrors.push('Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.');
          }

          if (foundErrors.length > 0) {
            setErrorList(foundErrors);
            setLoading(false);
            return;
          }
        }
      } catch (checkErr) {
        console.warn('Pre-check availability ignorado ou timeout:', checkErr);
      }

      // 4. Criação de conta no Supabase Auth com telefone normalizado
      setLoadingStep('Criando conta e preparando ativação...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName.trim(),
            phone: cleanPhone,
            phone_normalized: cleanPhone,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (authError) throw authError;

      // 5. Checagem de segurança do Supabase Auth: identities vazio indica e-mail já existente
      if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setErrorList(['Este e-mail já está cadastrado.']);
        setLoading(false);
        return;
      }

      // 6. Se não exigir confirmação por e-mail ou já estiver ativo, vai direto para onboarding
      if (authData.session || (authData.user && authData.user.email_confirmed_at)) {
        trackEvent('cadastro_sucesso', { metadata: { email: cleanEmail } });
        navigate('/onboarding');
        return;
      }

      // 7. Se exigir confirmação de e-mail (fluxo padrão), exibe a tela de instrução
      setSubmittedEmail(cleanEmail);
      setEmailSent(true);
      trackEvent('cadastro_aguardando_confirmacao', { metadata: { email: cleanEmail } });
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      const msg = err?.message || 'Erro inesperado ao criar conta. Tente novamente.';
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setErrorList(['Este e-mail já está cadastrado. Faça login para continuar.']);
      } else {
        setErrorList([msg]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail || resending) return;
    setResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (error) throw error;
      setResendMessage('Link de ativação reenviado com sucesso para sua caixa de entrada.');
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setResendError(err?.message || 'Erro ao reenviar e-mail. Aguarde alguns instantes.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 86% 14%, rgba(217, 70, 239, 0.11), rgba(129, 140, 248, 0.18) 35%, transparent 55%), radial-gradient(circle at 12% 85%, rgba(29, 94, 255, 0.36), transparent 52%), linear-gradient(165deg, #040E2D 0%, #071C56 32%, #0C287A 58%, #1A206C 80%, #113EB8 100%)',
      }}
    >
      <style>{`
        .rf-auth-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.035;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
        }
        .rf-auth-light-sweep {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 70%;
          height: 200%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.015) 25%,
            rgba(147, 197, 253, 0.08) 48%,
            rgba(216, 180, 254, 0.06) 55%,
            rgba(255, 255, 255, 0.015) 75%,
            transparent 100%
          );
          filter: blur(55px);
          animation: rfAuthSweep 24s cubic-bezier(.45,.05,.55,.95) infinite;
          will-change: transform;
          pointer-events: none;
          z-index: 1;
        }
        @keyframes rfAuthSweep {
          0%   { transform: translateX(0) rotate(18deg); }
          100% { transform: translateX(380%) rotate(18deg); }
        }
      `}</style>

      {/* Noise, Feixes de Luz e Grid Lines */}
      <div className="rf-auth-noise" aria-hidden="true" />
      <div className="rf-auth-light-sweep" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 z-0" aria-hidden="true">
        {[8, 25, 50, 75, 92].map((left, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-white/10"
            style={{ left: `${left}%` }}
          />
        ))}
      </div>

      {/* Botão de voltar ao site */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 text-xs font-semibold text-white/75 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/15"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Início</span>
      </Link>

      <div className="w-full max-w-[460px] relative z-10 py-6">
        {/* Logo Oficial com filtro branco no fundo azul */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            <img
              src="/logo.svg"
              alt="Raffros Corteflow"
              className="h-11 md:h-12 w-auto filter invert brightness-200 drop-shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            />
          </Link>
        </div>

        {/* Card em White Glassmorphism */}
        <div
          className="rounded-[28px] p-7 sm:p-9"
          style={{
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.90))',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 30px 80px rgba(4, 18, 48, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
          }}
        >
          <AnimatePresence mode="wait">
            {emailSent ? (
              /* ── TELA DE CONFIRMAÇÃO POR LINK ENVIADO NO EMAIL ── */
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center py-2"
              >
                <div className="w-16 h-16 bg-[#FC761D]/10 border border-[#FC761D]/25 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <Mail className="w-8 h-8 text-[#FC761D]" />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                    Conta Criada com Sucesso
                  </span>
                </div>

                <h3 className="text-2xl font-black text-[#0F172A] tracking-tight mb-2">
                  Verifique seu E-mail!
                </h3>
                <p className="text-[#5B6478] text-xs sm:text-sm leading-relaxed mb-4">
                  Enviamos o link de ativação da sua conta para:
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#FC761D] font-mono break-all mb-5 px-3.5 py-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  {submittedEmail}
                </p>

                <p className="text-xs text-[#5B6478] leading-relaxed mb-5">
                  Abra o e-mail no celular ou computador e clique em <strong className="text-[#0F172A]">"Ativar Minha Conta"</strong> para iniciar a configuração do seu estabelecimento.
                </p>

                {/* Aviso Destacado de SPAM / Lixo Eletrônico */}
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-left flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 text-sm font-bold">
                    📬
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-950 mb-0.5">Não encontrou na Caixa de Entrada?</h4>
                    <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                      Verifique sua <strong>pasta de Spam ou Lixo Eletrônico</strong>. Alguns provedores podem filtrar o primeiro e-mail de ativação.
                    </p>
                  </div>
                </div>

                {resendMessage && (
                  <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 text-xs rounded-2xl font-medium">
                    {resendMessage}
                  </div>
                )}

                {resendError && (
                  <div className="mb-5 p-3 bg-red-500/10 border border-red-500/25 text-red-700 text-xs rounded-2xl font-medium">
                    {resendError}
                  </div>
                )}

                {/* Resend & Actions */}
                <div className="pt-4 border-t border-slate-200/80 flex flex-col items-center gap-3.5 text-xs text-[#5B6478]">
                  <div>
                    Não recebeu o e-mail?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-[#FC761D] font-mono font-bold">
                        Reenviar em {resendTimer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="text-[#FC761D] font-bold hover:underline cursor-pointer"
                      >
                        {resending ? 'Reenviando...' : 'Reenviar link de ativação'}
                      </button>
                    )}
                  </div>

                  <Link
                    to="/login"
                    className="w-full h-[46px] rounded-full font-bold text-xs text-[#0F172A] bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                  >
                    <span>Já confirmou? Fazer Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* ── FORMULÁRIO DE CADASTRO ── */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                onSubmit={handleSubmit(onSubmit)}
              >
                {/* Eyebrow & Headline */}
                <div className="text-center mb-6">

                  <h2 className="text-2xl sm:text-[26px] font-black text-[#0F172A] tracking-[-0.035em] leading-tight">
                    Crie sua conta
                  </h2>
                  <p className="text-[#5B6478] mt-1.5 text-xs sm:text-sm font-normal">
                    Sem cartão de crédito. Configure seu salão em minutos.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Nome */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      {...register('fullName')}
                      className="w-full px-4 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                      placeholder="João da Silva"
                    />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.fullName.message}</p>}
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      Telefone (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      {...register('phone')}
                      onChange={(e) => {
                        const masked = formatPhoneMask(e.target.value);
                        setValue('phone', masked, { shouldValidate: true });
                        if (errorList.length > 0) setErrorList([]);
                      }}
                      className="w-full px-4 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                      placeholder="(27) 99730-3135"
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.phone.message}</p>}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      E-mail profissional
                    </label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full px-4 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                      placeholder="joao@seusalao.com.br"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      Senha de acesso
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        className="w-full px-4 py-3.5 pr-12 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>}
                  </div>

                  {/* Confirmar Senha */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...register('confirmPassword')}
                        className="w-full px-4 py-3.5 pr-12 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        placeholder="Repita sua senha"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.confirmPassword.message}</p>}
                  </div>
                </div>

                {errorList.length > 0 && (
                  <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl space-y-1">
                    {errorList.map((errItem, idx) => (
                      <p key={idx} className="text-red-700 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                        <span>{errItem}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Botão no estilo pílula oficial da Landing Page */}
                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full h-[52px] mt-6 rounded-full font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_14px_30px_rgba(255,135,56,0.35)] hover:brightness-105 active:scale-[0.98]"
                  style={{ background: '#FC761D' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
                      <span>{loadingStep || 'Criando conta...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Começar 7 dias grátis</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="mt-6 text-center text-xs sm:text-sm text-[#5B6478]">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="text-[#0F172A] font-bold hover:text-[#FC761D] underline decoration-[#FC761D]/50 hover:decoration-[#FC761D] transition-colors">
                    Fazer Login
                  </Link>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
