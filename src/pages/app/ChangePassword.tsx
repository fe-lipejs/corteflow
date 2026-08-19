import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { professionalProfile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const validatePassword = () => {
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (password !== confirmPassword) return 'As senhas não coincidem.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Update the professional record to remove force_password_change
      if (professionalProfile) {
        const { error: profError } = await supabase
          .from('professionals')
          .update({ force_password_change: false })
          .eq('id', professionalProfile.id);

        if (profError) throw profError;
      }

      setSuccess(true);
      await refreshProfile();
      
      setTimeout(() => {
        navigate('/app');
      }, 2000);

    } catch (err: any) {
      console.error('Error updating password:', err);
      setError(err.message || 'Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: theme.border }}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>Senha Atualizada!</h2>
          <p style={{ color: theme.textSecondary }}>Sua senha foi atualizada com sucesso. Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: theme.border }}>
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${theme.accent}15` }}>
            <Lock className="w-6 h-6" style={{ color: theme.accent }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>Defina sua Nova Senha</h2>
          <p className="text-sm" style={{ color: theme.textSecondary }}>
            Como este é seu primeiro acesso (ou sua senha foi redefinida), você precisa criar uma nova senha segura.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.textPrimary }}>
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border focus:ring-2 outline-none transition-all"
                style={{ borderColor: theme.border }}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.textPrimary }}>
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border focus:ring-2 outline-none transition-all"
                style={{ borderColor: theme.border }}
                placeholder="Digite a senha novamente"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-opacity disabled:opacity-50"
            style={{ background: theme.accent, color: theme.textInverse }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha e Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
