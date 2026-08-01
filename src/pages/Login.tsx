import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login')) {
        setError('E-mail ou senha incorretos.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.');
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      navigate('/app'); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1A1714] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#C9963B]/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)' }}>
              <Scissors className="w-5 h-5 text-[#1A1714]" />
            </div>
            <span className="font-bold text-xl text-white">Navalha</span>
          </Link>
        </div>

        <div className="bg-[#1E1B17] rounded-2xl border border-[#2A2520] p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">{t('login.title')}</h2>
            <p className="text-[#A09888] mt-2 text-sm">Acesse o painel do seu salão</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#A09888]">
                {t('login.email')}
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#A09888]">
                {t('login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full px-4 py-3 pr-12 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A09888] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 font-bold text-sm rounded-xl disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(201,150,59,0.3)]"
              style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#1A1714' }}
            >
              {loading ? 'Entrando...' : t('login.submit')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#666]">
            Não tem uma conta?{' '}
            <Link to="/cadastro" className="text-[#C9963B] font-medium hover:underline">
              Criar conta grátis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
