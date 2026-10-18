import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, Mail, CheckCircle2, X, KeyRound, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeBrazilianPhone } from '../lib/phoneUtils';

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

  // ── Forgot Password States ──
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const input = forgotIdentifier.trim();
    if (!input) {
      setForgotError('Por favor, informe seu e-mail ou número de telefone.');
      return;
    }

    const isEmail = input.includes('@');
    let searchIdentifier = input;

    if (!isEmail) {
      const phoneValidation = normalizeBrazilianPhone(input);
      if (!phoneValidation.isValid || !phoneValidation.normalized) {
        setForgotError(phoneValidation.error || 'Informe um telefone celular válido com DDD. Ex.: (27) 99730-3135.');
        return;
      }
      searchIdentifier = phoneValidation.normalized;
    }

    setForgotLoading(true);

    try {
      let finalEmail: string | null = null;

      // 1. Tenta localizar via RPC segura
      try {
        const { data: targetEmail, error: rpcError } = await supabase.rpc('get_email_by_phone_or_email', {
          p_identifier: searchIdentifier
        });

        if (!rpcError && targetEmail) {
          finalEmail = targetEmail;
        } else if (isEmail) {
          finalEmail = input.toLowerCase();
        }
      } catch (rpcErr) {
        if (isEmail) {
          finalEmail = input.toLowerCase();
        }
      }

      if (finalEmail) {
        // 2. Envia recuperação de senha do Supabase Auth para o e-mail localizado
        await supabase.auth.resetPasswordForEmail(finalEmail, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
      }

      // 3. Regra de segurança contra enumeração: SEMPRE exibe a mensagem genérica de sucesso
      setForgotSubmitted(true);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      // Mantém segurança contra enumeração mesmo em erro inesperado
      setForgotSubmitted(true);
    } finally {
      setForgotLoading(false);
    }
  };

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

      const isProfessional = profileData?.role === 'professional';
      const isCompleted = profileData?.onboarding_completed || Boolean(profileData?.tenant_id) || isProfessional;

      if (isSuperAdminMode || profileData?.role === 'super_admin') {
        navigate('/platform');
      } else if (isCompleted || isProfessional) {
        // Check memberships for multi-tenant
        const { data: memData } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (memData && memData.length > 1) {
          navigate('/select-tenant');
        } else {
          navigate('/admin');
        }
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
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-700 relative overflow-hidden ${isSuperAdminMode ? 'bg-[#000000]' : ''
        }`}
      style={
        isSuperAdminMode
          ? undefined
          : {
            background:
              'radial-gradient(circle at 86% 14%, rgba(217, 70, 239, 0.11), rgba(129, 140, 248, 0.18) 35%, transparent 55%), radial-gradient(circle at 12% 85%, rgba(29, 94, 255, 0.36), transparent 52%), linear-gradient(165deg, #040E2D 0%, #071C56 32%, #0C287A 58%, #1A206C 80%, #113EB8 100%)',
          }
      }
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

      {/* SVG Noise Texture & Ambient Light (normal mode) */}
      {!isSuperAdminMode && (
        <>
          <div className="rf-auth-noise" aria-hidden="true" />
          <div className="rf-auth-light-sweep" aria-hidden="true" />
          {/* Grid lines sutis */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 z-0" aria-hidden="true">
            {[8, 25, 50, 75, 92].map((left, i) => (
              <span
                key={i}
                className="absolute top-0 bottom-0 w-px bg-white/10"
                style={{ left: `${left}%` }}
              />
            ))}
          </div>
        </>
      )}

      {/* Botão sutil de voltar ao início */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 text-xs font-semibold text-white/75 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/15"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Início</span>
      </Link>

      <div className="w-full max-w-[440px] relative z-10 py-6">
        <AnimatePresence mode="wait">
          {!isSuperAdminMode ? (
            /* ========================================================
               MODO EMPRESA (Design System Raffros: Royal Blue + White Glass + Orange)
               ======================================================== */
            <motion.div
              key="empresa-mode"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Logo Oficial com filtro branco no fundo azul */}
              <div className="text-center mb-6">
                <button
                  onClick={handleLogoClick}
                  className="inline-flex items-center justify-center cursor-pointer focus:outline-none transition-transform hover:scale-105 active:scale-95"
                  title="Raffros Corteflow"
                >
                  <img
                    src="/logo.svg"
                    alt="Raffros Corteflow"
                    className="h-11 md:h-12 w-auto filter invert brightness-200 drop-shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                  />
                </button>
              </div>

              {/* Card em White Glassmorphism de Altíssimo Padrão */}
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
                {/* Eyebrow & Headline */}
                <div className="text-center mb-7">

                  <h2 className="text-2xl sm:text-[26px] font-black text-[#0F172A] tracking-[-0.035em] leading-tight">
                    {t('login.title') || 'Acesse sua conta'}
                  </h2>
                  <p className="text-[#5B6478] mt-1.5 text-xs sm:text-sm font-normal">
                    Gerencie agendamentos, equipe e financeiro
                  </p>
                </div>

                {resendSuccess && (
                  <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Link de confirmação reenviado com sucesso! Verifique seu e-mail.</span>
                  </div>
                )}

                {error && (
                  <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-700 text-xs sm:text-sm font-medium space-y-2">
                    <p>{error}</p>
                    {error.includes('confirmar seu e-mail') && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendingEmail}
                        className="text-xs font-bold text-[#FC761D] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {resendingEmail ? 'Reenviando...' : 'Reenviar e-mail de ativação →'}
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      {t('login.email')}
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                      {t('login.password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="w-full px-4 py-3.5 pr-12 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(email);
                        setForgotError(null);
                        setForgotSubmitted(false);
                        setForgotPasswordOpen(true);
                      }}
                      className="text-xs text-[#5B6478] hover:text-[#FC761D] font-semibold hover:underline cursor-pointer transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  {/* Botão no estilo pílula oficial da Landing Page */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[52px] rounded-full font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_14px_30px_rgba(255,135,56,0.35)] hover:brightness-105 active:scale-[0.98] mt-2"
                    style={{ background: '#FC761D' }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{t('login.submit') || 'Entrar no painel'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-xs sm:text-sm text-[#5B6478]">
                  Não tem uma conta?{' '}
                  <Link to="/cadastro" className="text-[#0F172A] font-bold hover:text-[#FC761D] underline decoration-[#FC761D]/50 hover:decoration-[#FC761D] transition-colors">
                    Criar conta grátis
                  </Link>
                </div>

                <div className="mt-6 pt-5 border-t border-[#E2E8F0]/80 text-center">
                  <button
                    onClick={() => {
                      setIsSuperAdminMode(true);
                      setEmail('');
                      setPassword('');
                      setError(null);
                    }}
                    className="text-[11px] text-[#94A3B8] hover:text-[#0F172A] font-semibold tracking-wide uppercase transition-colors cursor-pointer"
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
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="bg-[#050508] rounded-[28px] border border-[#27272A] p-8 sm:p-10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
                <div className="flex justify-center mb-6">
                  <div className="w-12 h-12 rounded-2xl border border-[#333] bg-[#111] flex items-center justify-center shadow-inner">
                    <Shield className="w-6 h-6 text-zinc-200" />
                  </div>
                </div>

                <div className="text-center mb-7">
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Raffros Corteflow <span className="font-normal text-zinc-500">Platform</span>
                  </h2>
                  <p className="text-zinc-500 mt-1 text-xs uppercase tracking-widest font-semibold">
                    Acesso Restrito Super Admin
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 bg-red-950/40 border border-red-800/60 rounded-2xl text-red-400 text-xs text-center font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3.5 bg-[#0C0D12] border border-[#27272A] rounded-2xl text-white placeholder-zinc-600 outline-none focus:border-zinc-400 transition-colors text-sm font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@raffros.com"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Senha Master
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-3.5 bg-[#0C0D12] border border-[#27272A] rounded-2xl text-white placeholder-zinc-600 outline-none focus:border-zinc-400 transition-colors text-sm font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[50px] mt-2 font-extrabold text-sm text-black bg-white rounded-full hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer shadow-[0_10px_25px_rgba(255,255,255,0.15)]"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                    ) : (
                      <>
                        <span>Autenticar Master</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      setIsSuperAdminMode(false);
                      setError(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium cursor-pointer"
                  >
                    ← Voltar para Login da Empresa
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODAL: ESQUECI MINHA SENHA ── */}
      <AnimatePresence>
        {forgotPasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop com blur escuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setForgotPasswordOpen(false)}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-md"
            />

            {/* Modal Dialog em White Glassmorphism */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-[28px] p-7 sm:p-8 z-10 space-y-5"
              style={{
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92))',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
                boxShadow: '0 30px 80px rgba(4, 18, 48, 0.45)',
              }}
            >
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(false)}
                className="absolute top-5 right-5 text-[#94A3B8] hover:text-[#0F172A] p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {forgotSubmitted ? (
                /* Estado: Instruções Enviadas / Concluído */
                <div className="text-center py-2 space-y-4">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
                    Solicitação Processada
                  </h3>
                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed font-medium">
                    Se encontrarmos uma conta associada aos dados informados, enviaremos as instruções para redefinição de senha ao e-mail cadastrado.
                  </p>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Por motivos de segurança, o link é enviado exclusivamente para o e-mail da conta. Verifique também sua caixa de Spam.
                  </p>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(false)}
                    className="w-full h-[48px] rounded-full font-extrabold text-sm text-white shadow-[0_12px_24px_rgba(255,135,56,0.3)] hover:brightness-105 active:scale-[0.98] cursor-pointer transition-all"
                    style={{ background: '#FC761D' }}
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                /* Estado: Formulário de solicitação */
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-[#FC761D]/10 text-[#FC761D] flex items-center justify-center shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-[#0F172A] tracking-tight">
                        Recuperação de Senha
                      </h3>
                      <p className="text-xs text-[#64748B]">Informe o e-mail ou telefone da sua conta</p>
                    </div>
                  </div>

                  {forgotError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-xs font-medium">
                      {forgotError}
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                        E-mail ou telefone
                      </label>
                      <input
                        type="text"
                        required
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="seuemail@exemplo.com ou 27999999999"
                        className="w-full px-4 py-3.5 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm"
                      />
                    </div>

                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      Você pode informar seu e-mail cadastrado ou seu número de telefone celular com DDD. As instruções serão enviadas para o e-mail da sua conta.
                    </p>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setForgotPasswordOpen(false)}
                        className="w-1/3 h-[48px] font-bold text-xs text-[#64748B] hover:text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-2/3 h-[48px] font-extrabold text-xs text-white rounded-full shadow-[0_12px_24px_rgba(255,135,56,0.3)] hover:brightness-105 active:scale-[0.98] cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                        style={{ background: '#FC761D' }}
                      >
                        {forgotLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>Enviar Instruções</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
