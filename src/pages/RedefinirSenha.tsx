import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

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
          navigate('/app');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#DE870D]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-[#DE870D]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center mb-4">
            <img src="/logo.svg" alt="Raffros Corteflow" className="h-16 md:h-20 w-auto" />
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-xl">
          {success ? (
            /* ── TELA DE SUCESSO ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A]">Senha Redefinida!</h2>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Sua senha foi alterada com sucesso. Agora você já pode acessar sua conta com a nova credencial.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3.5 px-4 font-bold text-sm text-white rounded-xl shadow-md hover:shadow-lg shadow-[#DE870D]/25 hover:brightness-105 active:scale-[0.99] cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  Ir para o Login
                </button>
              </div>
            </motion.div>
          ) : isRecoverySession === false ? (
            /* ── TELA DE LINK EXPIRADO OU INVÁLIDO ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A]">Link Expirado ou Inválido</h2>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Por motivos de segurança, os links de redefinição de senha possuem tempo de validade limitado ou já foram utilizados.
              </p>
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3.5 px-4 font-bold text-sm text-white rounded-xl shadow-md hover:shadow-lg shadow-[#DE870D]/25 hover:brightness-105 active:scale-[0.99] cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  Solicitar Novo Link de Recuperação
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── FORMULÁRIO DE NOVA SENHA ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#DE870D]/10 border border-[#DE870D]/20 text-[#DE870D] flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-[#0F172A]">Redefinir Senha</h2>
                <p className="text-sm text-[#64748B] mt-1">Crie uma nova senha segura para sua conta</p>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nova Senha */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium text-sm"
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

                {/* Confirmar Nova Senha */}
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155] transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 font-bold text-sm text-white rounded-xl shadow-md hover:shadow-lg shadow-[#DE870D]/25 hover:brightness-105 active:scale-[0.99] cursor-pointer transition-all disabled:opacity-60 mt-2"
                  style={{ background: 'linear-gradient(135deg, #DE870D, #F5A623)' }}
                >
                  {loading ? 'Atualizando senha...' : 'Salvar Nova Senha'}
                </button>
              </form>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A] font-semibold transition-colors"
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
