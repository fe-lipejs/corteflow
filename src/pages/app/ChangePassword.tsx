import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, Scissors } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { professionalProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const validatePassword = () => {
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (password !== confirmPassword) return 'As senhas não coincidem.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePassword();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      if (professionalProfile) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clear-professional-password-flag`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ professional_id: professionalProfile.id })
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao sincronizar com o servidor');
          }
        }
      }

      setSuccess(true);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-700 relative overflow-hidden bg-[#F8FAFC]">
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] mb-2">Senha Atualizada!</h2>
            <p className="text-[#64748B] text-sm mb-6">Sua senha foi redefinida com sucesso.</p>
            <button
              type="button"
              onClick={() => window.location.href = '/admin'}
              className="w-full bg-[#DE870D] hover:bg-[#c2760b] text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(222,135,13,0.39)] flex justify-center items-center gap-2"
            >
              Acessar meu painel →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-700 relative overflow-hidden bg-[#F8FAFC]">
      <div className="w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Raffros Corteflow" className="h-20 md:h-24 w-auto mx-auto" />
        </div>

        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#0F172A]">Crie sua Nova Senha</h2>
            <p className="text-[#64748B] mt-2 text-sm">
              Bem-vindo! Como este é seu primeiro acesso, você precisa criar uma nova senha personalizada.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-[#334155]">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5 text-[#334155]">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#DE870D] focus:ring-2 focus:ring-[#DE870D]/20 transition-all font-medium"
                  placeholder="Digite a senha novamente"
                  required
                />
              </div>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Use pelo menos 8 caracteres misturando letras e números.
            </p>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-[#DE870D] hover:bg-[#c2760b] text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(222,135,13,0.39)] disabled:opacity-50 disabled:shadow-none mt-2 flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Senha e Entrar →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


