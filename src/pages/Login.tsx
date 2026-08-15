import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, Eye, EyeOff, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Super Admin Mode state
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSuperAdminMode) return;
    
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    
    // Toggle on 5 fast clicks
    if (newClicks >= 5) {
      setIsSuperAdminMode(true);
      setLogoClicks(0);
      setEmail('');
      setPassword('');
      setError(null);
    }
    
    // Reset clicks after 2 seconds to require fast clicking
    setTimeout(() => {
      setLogoClicks((prev) => Math.max(0, prev - 1));
    }, 2000);
  };

  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Digite seu e-mail para reenviar a confirmação.');
      return;
    }
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });
      if (error) throw error;
      setResendSuccess(true);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Não foi possível reenviar o e-mail no momento. Tente novamente em alguns instantes.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResendSuccess(false);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('E-mail ou senha incorretos.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Você precisa confirmar seu e-mail antes de entrar. Verifique sua caixa de entrada ou spam.');
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      // ── Security Guard: Enforce email confirmation ──
      const user = signInData.user;
      if (user && !user.email_confirmed_at && !user.confirmed_at) {
        await supabase.auth.signOut();
        setError('Você ainda não confirmou seu e-mail. Por favor, clique no link de ativação enviado para o seu e-mail antes de fazer login.');
        setLoading(false);
        return;
      }

      // Check if user already has completed onboarding in database to route accurately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, tenant_id, onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData?.tenant_id && profileData?.role !== 'super_admin') {
        const { data: tenantCheck } = await supabase
          .from('tenants')
          .select('id, status, deleted_at')
          .eq('id', profileData.tenant_id)
          .maybeSingle();

        // If tenant is soft-deleted or RLS filtered out because of deletion
        if (!tenantCheck || tenantCheck.deleted_at) {
          await supabase.auth.signOut();
          setError('Esta conta/empresa foi desativada ou excluída pelo administrador. Entre em contato com o suporte para reativação.');
          setLoading(false);
          return;
        }
      }

      const isCompleted = profileData?.onboarding_completed || Boolean(profileData?.tenant_id);

      if (isSuperAdminMode || profileData?.role === 'super_admin') {
        navigate('/admin');
      } else if (isCompleted) {
        navigate('/app');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-700 relative overflow-hidden ${isSuperAdminMode ? 'bg-[#000000]' : 'bg-[#F8FAFC]'}`}>
      
      {/* Background glow (only in normal mode) */}
      <AnimatePresence>
        {!isSuperAdminMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#DE870D]/10 blur-[150px] rounded-full pointer-events-none" 
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {!isSuperAdminMode ? (
            /* ========================================================
               MODO EMPRESA (Light Theme Default)
               ======================================================== */
            <motion.div
              key="empresa-mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Logo */}
              <div className="text-center mb-8">
                <button 
                  onClick={handleLogoClick}
                  className="inline-flex items-center justify-center mb-4 cursor-pointer focus:outline-none"
                >
                  <img src="/logo.svg" alt="Raffros Corteflow" className="h-20 md:h-24 w-auto" />
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-xl">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-[#0F172A]">{t('login.title')}</h2>
                  <p className="text-[#64748B] mt-2 text-sm">Acesse o painel do seu estabelecimento</p>
                </div>
                
                {resendSuccess && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-700 text-sm flex items-center justify-between">
                    <span>Link de confirmação reenviado com sucesso! Verifique seu e-mail.</span>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm space-y-2">
                    <p>{error}</p>
                    {error.includes('confirmar seu e-mail') && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendingEmail}
                        className="text-xs font-bold text-[#DE870D] hover:underline flex items-center gap-1"
                      >
                        {resendingEmail ? 'Reenviando...' : 'Clique aqui para reenviar o e-mail de confirmação →'}
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-[#334155]">
                      {t('login.email')}
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="joao@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-[#334155]">
                      {t('login.password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button type="button" className="text-sm text-[#DE870D] font-semibold hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 font-bold text-sm text-white rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg shadow-[#DE870D]/20 hover:brightness-105 active:scale-[0.99] cursor-pointer mt-2"
                    style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                  >
                    {loading ? 'Entrando...' : t('login.submit')}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-[#64748B]">
                  Não tem uma conta?{' '}
                  <Link to="/cadastro" className="text-[#DE870D] font-bold hover:underline">
                    Criar conta grátis
                  </Link>
                </div>

                <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-center">
                  <button 
                    onClick={() => {
                      setIsSuperAdminMode(true);
                      setEmail('');
                      setPassword('');
                      setError(null);
                    }}
                    className="text-xs text-[#94A3B8] hover:text-[#DE870D] font-medium transition-colors"
                  >
                    Acesso Admin Master
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ========================================================
               MODO SUPER ADMIN (Black Noir - Linear/Vercel inspired)
               ======================================================== */
            <motion.div
              key="admin-mode"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="bg-[#000000] rounded-xl border border-[#333333] p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <div className="flex justify-center mb-8">
                  <div className="w-12 h-12 rounded-full border border-[#444] bg-[#111] flex items-center justify-center">
                    <Shield className="w-6 h-6 text-zinc-300" />
                  </div>
                </div>
                
                <div className="text-center mb-8">
                  <h2 className="text-xl font-medium text-white tracking-wide">Raffros Corteflow <span className="font-light text-zinc-500">Platform</span></h2>
                  <p className="text-zinc-500 mt-2 text-sm">Acesso Restrito</p>
                </div>
                
                {error && (
                  <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 bg-[#000] border-b border-[#333] text-white placeholder-zinc-600 outline-none focus:border-zinc-300 transition-colors rounded-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Admin Email"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-3 bg-[#000] border-b border-[#333] text-white placeholder-zinc-600 outline-none focus:border-zinc-300 transition-colors rounded-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-4 font-medium text-sm text-black bg-white rounded hover:bg-zinc-200 transition-colors disabled:opacity-50 flex justify-center items-center"
                  >
                    {loading ? (
                       <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                    ) : (
                      'Entrar'
                    )}
                  </button>
                </form>

                <div className="mt-10 text-center">
                  <button 
                    onClick={() => {
                      setIsSuperAdminMode(false);
                      setError(null);
                    }}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Voltar para Login da Empresa
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
