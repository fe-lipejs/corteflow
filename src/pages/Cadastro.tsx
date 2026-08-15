import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Mail, Eye, EyeOff, CheckCircle2, RefreshCw } from 'lucide-react';
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

      // 4. If email confirmation is disabled or session exists, go straight to onboarding!
      if (authData.session || (authData.user && authData.user.email_confirmed_at)) {
        navigate('/onboarding', { replace: true });
        return;
      }

      // 5. Show clean Email Confirmation Screen
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

  const handleResend = async () => {
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

      setResendMessage('E-mail reenviado com sucesso! Verifique sua caixa de entrada ou spam.');
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro ao reenviar e-mail. Aguarde alguns instantes.');
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

                {error && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs rounded-xl font-medium">
                    {error}
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
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-sm rounded-xl font-medium">
                    {error}
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
