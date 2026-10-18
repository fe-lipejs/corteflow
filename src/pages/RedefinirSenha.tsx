import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, KeyRound, Loader2 } from 'lucide-react';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Escuta o evento de PASSWORD_RECOVERY do Supabase Auth
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
        setError(null);
      }
    });

    // 2. Verifica se a URL contém o hash de recuperação antes que o Supabase o limpe
    const hasRecoveryHash = window.location.hash.includes('type=recovery');

    if (hasRecoveryHash) {
      setIsRecoverySession(true);
    } else {
      // 3. Se não tem hash, vamos checar a sessão atual
      supabase.auth.getSession().then(({ data: { session }, error: sessionErr }) => {
        if (session) {
          // Usuário já está logado normalmente, barra o acesso e manda pro painel
          navigate('/admin');
        } else {
          // Não está logado e não tem hash: link inválido ou acesso direto
          // Espera um tempinho pro Supabase Auth terminar de carregar os eventos antes de mostrar erro
          const timer = setTimeout(() => {
            setIsRecoverySession(prev => (prev === null ? false : prev));
          }, 1500);
          return () => clearTimeout(timer);
        }
      });
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações de senha
    if (!password || password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      // Encerra sessão temporária de recuperação para forçar login com a nova senha
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error('Password reset error:', err);
      const msg = err?.message || '';
      if (msg.includes('same as your current password') || msg.includes('different from your old')) {
        setError('A nova senha não pode ser igual à senha anterior.');
      } else if (msg.includes('requires recent login') || msg.includes('token expired') || msg.includes('expired')) {
        setError('O link de recuperação expirou. Por favor, solicite um novo link.');
      } else {
        setError('Não foi possível atualizar a senha. Tente solicitar um novo link.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 85% 12%, rgba(244, 114, 182, 0.14), transparent 38%), radial-gradient(circle at 12% 85%, rgba(37, 99, 235, 0.38), transparent 52%), linear-gradient(165deg, #0B2958 0%, #0F3775 40%, #164894 75%, #1A3E78 100%)',
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
          top: -40%;
          left: -60%;
          width: 50%;
          height: 180%;
          transform: rotate(18deg);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.03) 30%,
            rgba(173, 205, 255, 0.12) 50%,
            rgba(255, 255, 255, 0.03) 70%,
            transparent 100%
          );
          filter: blur(20px);
          animation: rfAuthSweep 16s cubic-bezier(.45,.05,.55,.95) infinite;
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

      {/* Voltar ao site */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 text-xs font-semibold text-white/75 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/15"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Início</span>
      </Link>

      <div className="w-full max-w-[440px] relative z-10 py-6">
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
          {success ? (
            /* ── TELA DE SUCESSO ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Senha Redefinida!</h2>
              <p className="text-xs sm:text-sm text-[#5B6478] leading-relaxed">
                Sua senha foi alterada com sucesso. Agora você já pode acessar sua conta com a nova credencial.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full h-[52px] rounded-full font-extrabold text-sm text-white shadow-[0_14px_30px_rgba(255,135,56,0.35)] hover:brightness-105 active:scale-[0.98] cursor-pointer transition-all flex items-center justify-center gap-2"
                  style={{ background: '#FC761D' }}
                >
                  <span>Ir para o Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : isRecoverySession === false ? (
            /* ── TELA DE LINK EXPIRADO OU INVÁLIDO ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Link Expirado ou Inválido</h2>
              <p className="text-xs sm:text-sm text-[#5B6478] leading-relaxed">
                Por motivos de segurança, os links de redefinição de senha possuem tempo de validade limitado ou já foram utilizados.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full h-[52px] rounded-full font-extrabold text-sm text-white shadow-[0_14px_30px_rgba(255,135,56,0.35)] hover:brightness-105 active:scale-[0.98] cursor-pointer transition-all flex items-center justify-center gap-2"
                  style={{ background: '#FC761D' }}
                >
                  <span>Solicitar Novo Link de Recuperação</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── FORMULÁRIO DE NOVA SENHA ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#FC761D]/10 border border-[#FC761D]/20 text-[#FC761D] flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl sm:text-[26px] font-black text-[#0F172A] tracking-[-0.035em] leading-tight">
                  Redefinir Senha
                </h2>
                <p className="text-xs sm:text-sm text-[#5B6478] mt-1.5 font-normal">
                  Crie uma nova senha segura para sua conta
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-700 text-xs sm:text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nova Senha */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-3.5 pr-12 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
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

                {/* Confirmar Nova Senha */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1E293B] mb-1.5">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-4 py-3.5 pr-12 bg-[#F8FAFC] border border-[#CBD5E1]/90 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#FC761D] focus:ring-4 focus:ring-[#FC761D]/15 focus:bg-white transition-all font-medium text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botão no estilo pílula oficial da Landing Page */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] mt-2 rounded-full font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_14px_30px_rgba(255,135,56,0.35)] hover:brightness-105 active:scale-[0.98]"
                  style={{ background: '#FC761D' }}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Salvar Nova Senha</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#5B6478] hover:text-[#FC761D] font-bold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
