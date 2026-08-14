import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Mail, Eye, EyeOff, ShieldCheck, RefreshCw, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const cadastroSchema = z.object({
  fullName: z.string().min(3, "Nome muito curto"),
  phone: z.string().min(10, "Telefone inválido (mínimo 10 dígitos)").regex(/^[0-9]+$/, "Apenas números"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export default function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP Verification Step
  const [otpStep, setOtpStep] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedFullName, setSubmittedFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    mode: 'onChange',
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (otpStep && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, resendTimer]);

  const onSubmit = async (data: CadastroForm) => {
    setLoading(true);
    setError(null);
    try {
      const cleanPhone = data.phone.replace(/\D/g, '');
      const cleanEmail = data.email.trim().toLowerCase();

      // 1. Proactive check if phone is already registered in tenant_settings
      const { data: existingSettings } = await supabase
        .from('tenant_settings')
        .select('id, phone')
        .eq('phone', cleanPhone)
        .limit(1)
        .maybeSingle();

      if (existingSettings) {
        setError('Este número de telefone/WhatsApp já está vinculado a uma conta existente. Faça login para continuar.');
        setLoading(false);
        return;
      }

      // 2. Perform Supabase Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName.trim(),
            phone: cleanPhone,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (authError) throw authError;

      // 3. Supabase Auth Security Check: If email is already registered, identities will be empty
      if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setError('Este e-mail já está cadastrado no sistema. Por favor, faça login para acessar sua conta.');
        setLoading(false);
        return;
      }

      // Save email for OTP and transition to OTP screen
      setSubmittedEmail(cleanEmail);
      setSubmittedFullName(data.fullName.trim());
      setOtpStep(true);
      setResendTimer(60);
      
    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message || '';
      if (
        msg.includes('already registered') || 
        msg.includes('User already registered') ||
        msg.includes('user_already_exists') ||
        msg.includes('already exists')
      ) {
        setError('Este e-mail já está cadastrado. Por favor, faça login.');
      } else if (msg.includes('security purposes') || msg.includes('only request this after')) {
        const match = msg.match(/(\d+) second/);
        const secs = match ? match[1] : 'alguns';
        setError(`Por segurança, aguarde ${secs} segundos antes de tentar novamente.`);
      } else if (msg.includes('Password should be')) {
        setError('A senha deve ter no mínimo 8 caracteres.');
      } else {
        setError(msg || "Ocorreu um erro ao criar a conta.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = otpCode.replace(/\D/g, '');
    if (cleanToken.length !== 6) {
      setError('Por favor, digite o código de 6 dígitos completo.');
      return;
    }

    setOtpLoading(true);
    setError(null);
    setResendMessage(null);

    try {
      // 1. Verify OTP with Supabase Auth
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: submittedEmail,
        token: cleanToken,
        type: 'signup'
      });

      if (verifyError) {
        // Try fallback type 'email' if 'signup' doesn't match
        const { data: fallbackData, error: fallbackError } = await supabase.auth.verifyOtp({
          email: submittedEmail,
          token: cleanToken,
          type: 'email'
        });

        if (fallbackError) {
          throw verifyError;
        }
      }

      setOtpSuccess(true);

      // Redirect smoothly to onboarding
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1200);

    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message || '';
      if (msg.includes('Token has expired') || msg.includes('expired')) {
        setError('Este código expirou. Clique em "Reenviar código" abaixo para receber um novo.');
      } else if (msg.includes('invalid') || msg.includes('Token is invalid')) {
        setError('Código incorreto. Verifique os 6 dígitos recebidos no seu e-mail.');
      } else {
        setError('Código inválido ou expirado. Tente novamente.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError(null);
    setResendMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (resendError) throw resendError;

      setResendMessage('Novo código enviado com sucesso! Verifique sua caixa de entrada ou spam.');
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro ao reenviar o código. Aguarde alguns instantes.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#000000] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#C9963B]/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-[#C9963B]/3 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center mb-8">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-20 md:h-24 w-auto" />
          </Link>
        </div>

        <div className="bg-[#0A0A0A] rounded-2xl border border-[#222222] p-8 shadow-2xl">
          
          <AnimatePresence mode="wait">
            {otpStep ? (
              /* ── STEP 2: DIGITAR CÓDIGO OTP DE 6 DÍGITOS ── */
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {otpSuccess ? (
                  <div className="py-6 text-center space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-2xl flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white">Conta Confirmada!</h3>
                    <p className="text-sm text-[#A1A1AA]">
                      Preparando seu painel de configuração...
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="w-16 h-16 bg-[#C9963B]/10 border border-[#C9963B]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <KeyRound className="w-8 h-8 text-[#C9963B]" />
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1.5">Código de Confirmação</h2>
                      <p className="text-xs text-[#A1A1AA] leading-relaxed">
                        Enviamos um código de <strong className="text-white">6 dígitos</strong> para:
                      </p>
                      <p className="text-sm font-semibold text-[#C9963B] font-mono mt-0.5 break-all">
                        {submittedEmail}
                      </p>
                    </div>

                    {resendMessage && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl">
                        {resendMessage}
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                        {error}
                      </div>
                    )}

                    {/* Input do Código de 6 Dígitos */}
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[#A1A1AA] font-bold mb-2">
                        Digite o código de 6 dígitos
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full px-4 py-3.5 bg-[#050505] border-2 border-[#222222] rounded-xl text-center text-3xl font-mono tracking-[0.35em] text-[#C9963B] placeholder-[#333] outline-none focus:border-[#C9963B] focus:ring-2 focus:ring-[#C9963B]/20 transition-all font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={otpCode.length !== 6 || otpLoading}
                      className="w-full flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)] active:scale-[0.99]"
                      style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
                    >
                      {otpLoading ? 'Verificando código...' : 'Confirmar e Continuar'}
                      {!otpLoading && <ChevronRight className="w-4 h-4 ml-1" />}
                    </button>

                    {/* Resend & Change email options */}
                    <div className="pt-2 border-t border-[#1a1a1a] flex flex-col items-center gap-3 text-xs text-[#888]">
                      <div>
                        Não recebeu o código?{' '}
                        {resendTimer > 0 ? (
                          <span className="text-[#C9963B] font-mono font-semibold">
                            Aguarde {resendTimer}s
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resending}
                            className="text-[#C9963B] font-bold hover:underline"
                          >
                            {resending ? 'Enviando...' : 'Reenviar código'}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => { setOtpStep(false); setOtpCode(''); setError(null); }}
                        className="flex items-center gap-1 text-[#666] hover:text-[#A1A1AA] transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Corrigir e-mail de cadastro
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            ) : (
              /* ── STEP 1: FORMULÁRIO DE CADASTRO ── */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white">Crie sua conta</h2>
                  <p className="text-[#A1A1AA] mt-2 text-sm">7 dias grátis. Sem cartão de crédito.</p>
                </div>

                <div className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Nome completo</label>
                    <input
                      type="text"
                      {...register('fullName')}
                      className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="João da Silva"
                    />
                    {errors.fullName && <p className="text-red-400 text-xs mt-1.5">{errors.fullName.message}</p>}
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Telefone (WhatsApp)</label>
                    <input
                      type="tel"
                      {...register('phone')}
                      className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="11999999999"
                    />
                    {errors.phone && <p className="text-red-400 text-xs mt-1.5">{errors.phone.message}</p>}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">E-mail</label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full px-4 py-3 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="joao@exemplo.com"
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="block text-sm font-medium text-[#A1A1AA] mb-1.5">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        className="w-full px-4 py-3 pr-12 bg-[#050505] border border-[#222222] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A1A1AA] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full mt-6 flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)]"
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#000000' }}
                >
                  {loading ? 'Criando conta...' : 'Criar Conta'}
                  {!loading && <ChevronRight className="w-4 h-4 ml-1" />}
                </button>

                <div className="mt-6 text-center text-sm text-[#666]">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="text-[#C9963B] font-medium hover:underline">
                    Entrar
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
