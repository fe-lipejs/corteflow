import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Mail, Eye, EyeOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const cadastroSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  phone: z.string().min(10, "Telefone inválido (informe DDD + número)"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export default function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorList, setErrorList] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Email Sent Confirmation Screen
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<CadastroForm>({
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
    setErrorList([]);

    const cleanPhone = data.phone.replace(/\D/g, '');
    const cleanEmail = data.email.trim().toLowerCase();

    // 1. Validação estrita de senha e confirmação de senha
    if (data.password !== data.confirmPassword) {
      setErrorList(['As senhas não coincidem.']);
      setLoading(false);
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorList(['Telefone inválido. Informe DDD + número (ex: 27999999999).']);
      setLoading(false);
      return;
    }

    try {
      // 2. Verificação de duplicidade de e-mail e telefone no banco de dados via RPC
      const { data: availability, error: availError } = await supabase.rpc('check_registration_availability', {
        p_email: cleanEmail,
        p_phone: cleanPhone
      });

      if (!availError && availability) {
        const foundErrors: string[] = [];

        if (availability.email_exists) {
          foundErrors.push('Este e-mail já está cadastrado.');
        }

        if (availability.phone_exists) {
          foundErrors.push('Este número de telefone já está cadastrado.');
        }

        if (foundErrors.length > 0) {
          setErrorList(foundErrors);
          setLoading(false);
          return;
        }
      }

      // 3. Criação de conta no Supabase Auth
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

      // 4. Checagem de segurança do Supabase Auth: identities vazio indica e-mail já existente
      if (authData.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setErrorList(['Este e-mail já está cadastrado no sistema. Por favor, faça login.']);
        setLoading(false);
        return;
      }

      // 5. Se não exigir confirmação por e-mail ou já estiver ativo, vai direto para onboarding
      if (authData.session || (authData.user && authData.user.email_confirmed_at)) {
        navigate('/onboarding', { replace: true });
        return;
      }

      // 6. Exibe tela de confirmação de e-mail
      setSubmittedEmail(cleanEmail);
      setEmailSent(true);
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
        setErrorList(['Este e-mail já está cadastrado. Por favor, faça login.']);
      } else if (msg.includes('security purposes') || msg.includes('only request this after')) {
        const match = msg.match(/(\d+) second/);
        const secs = match ? match[1] : 'alguns';
        setErrorList([`Por segurança, aguarde ${secs} segundos antes de tentar novamente.`]);
      } else if (msg.includes('Password should be')) {
        setErrorList(['A senha deve ter no mínimo 8 caracteres.']);
      } else {
        setErrorList([msg || 'Ocorreu um erro ao criar a conta.']);
      }
    } finally {
      setLoading(false);
    }
  };

  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setResendError(null);
    setResendMessage(null);

    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (err) throw err;

      setResendMessage('E-mail reenviado com sucesso! Verifique sua caixa de entrada ou spam.');
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setResendError(err?.message || 'Erro ao reenviar e-mail. Aguarde alguns instantes.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#DE870D]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-[#DE870D]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center mb-4">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-20 md:h-24 w-auto" />
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-xl">
          
          <AnimatePresence mode="wait">
            {emailSent ? (
              /* ── TELA DE CONFIRMAÇÃO POR LINK ENVIADO NO EMAIL ── */
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center py-4"
              >
                <div className="w-20 h-20 bg-[#DE870D]/10 border border-[#DE870D]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-10 h-10 text-[#DE870D]" />
                </div>
                
                <h3 className="text-2xl font-black text-[#0F172A] mb-2">Verifique seu E-mail!</h3>
                <p className="text-[#64748B] text-sm leading-relaxed mb-4">
                  Enviamos um link de ativação para:
                </p>
                <p className="text-sm font-bold text-[#DE870D] font-mono break-all mb-6 px-3 py-2 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  {submittedEmail}
                </p>
                
                <p className="text-xs text-[#64748B] leading-relaxed mb-8">
                  Basta abrir o e-mail no seu celular ou computador e clicar no botão <strong className="text-[#0F172A]">"Ativar Minha Conta"</strong> para começar a configurar seu estabelecimento.
                </p>

                {resendMessage && (
                  <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 text-green-700 text-xs rounded-xl font-medium">
                    {resendMessage}
                  </div>
                )}

                {resendError && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs rounded-xl font-medium">
                    {resendError}
                  </div>
                )}

                {/* Resend & Actions */}
                <div className="pt-4 border-t border-[#E2E8F0] flex flex-col items-center gap-4 text-xs text-[#64748B]">
                  <div>
                    Não recebeu o e-mail?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-[#DE870D] font-mono font-semibold">
                        Reenviar em {resendTimer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="text-[#DE870D] font-bold hover:underline"
                      >
                        {resending ? 'Reenviando...' : 'Reenviar e-mail'}
                      </button>
                    )}
                  </div>

                  <Link to="/login" className="text-[#64748B] hover:text-[#0F172A] transition-colors font-medium">
                    Já confirmou? Fazer Login →
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* ── FORMULÁRIO DE CADASTRO ── */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-[#0F172A]">Crie sua conta</h2>
                  <p className="text-[#64748B] mt-2 text-sm">7 dias grátis. Sem cartão de crédito.</p>
                </div>

                <div className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Nome completo</label>
                    <input
                      type="text"
                      {...register('fullName')}
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                      placeholder="João da Silva"
                    />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1.5">{errors.fullName.message}</p>}
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Telefone (WhatsApp)</label>
                    <input
                      type="tel"
                      {...register('phone')}
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                      placeholder="11999999999"
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1.5">{errors.phone.message}</p>}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">E-mail</label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                      placeholder="joao@exemplo.com"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
                  </div>

                  {/* Confirmar Senha */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1.5">Confirmar senha</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...register('confirmPassword')}
                        className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                        placeholder="Repita sua senha"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1.5">{errors.confirmPassword.message}</p>}
                  </div>
                </div>

                {errorList.length > 0 && (
                  <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
                    {errorList.map((errItem, idx) => (
                      <p key={idx} className="text-red-600 text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                        {errItem}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full mt-6 flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  {loading ? 'Criando conta...' : 'Criar Conta'}
                  {!loading && <ChevronRight className="w-4 h-4 ml-1" />}
                </button>

                <div className="mt-6 text-center text-sm text-[#64748B]">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="text-[#DE870D] font-bold hover:underline">
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
