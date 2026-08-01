import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Scissors, Mail, Eye, EyeOff } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: CadastroForm) => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`
        }
      });

      if (authError) throw authError;
      setSuccess(true);
      
    } catch (err: any) {
      console.error(err);
      const msg: string = err?.message || '';
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('Este e-mail já está cadastrado. Tente fazer login.');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1A1714] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-[#C9963B]/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-[#C9963B]/3 blur-[120px] rounded-full pointer-events-none" />

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
          
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-[#C9963B]/10 border border-[#C9963B]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-10 h-10 text-[#C9963B]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Verifique seu E-mail!</h3>
                <p className="text-[#A09888] text-sm mb-8 leading-relaxed">
                  Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e depois volte para finalizar a configuração do seu salão.
                </p>
                <Link to="/login" className="text-[#C9963B] font-semibold hover:underline text-sm">
                  Ir para o Login →
                </Link>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white">Crie sua conta</h2>
                  <p className="text-[#A09888] mt-2 text-sm">7 dias grátis. Sem cartão de crédito.</p>
                </div>

                <div className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-[#A09888] mb-1.5">Nome completo</label>
                    <input
                      type="text"
                      {...register('fullName')}
                      className="w-full px-4 py-3 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="João da Silva"
                    />
                    {errors.fullName && <p className="text-red-400 text-xs mt-1.5">{errors.fullName.message}</p>}
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block text-sm font-medium text-[#A09888] mb-1.5">Telefone (WhatsApp)</label>
                    <input
                      type="tel"
                      {...register('phone')}
                      className="w-full px-4 py-3 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="11999999999"
                    />
                    {errors.phone && <p className="text-red-400 text-xs mt-1.5">{errors.phone.message}</p>}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-sm font-medium text-[#A09888] mb-1.5">E-mail</label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full px-4 py-3 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                      placeholder="joao@exemplo.com"
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
                  </div>

                  {/* Senha */}
                  <div>
                    <label className="block text-sm font-medium text-[#A09888] mb-1.5">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        className="w-full px-4 py-3 pr-12 bg-[#141210] border border-[#2A2520] rounded-xl text-white placeholder-[#555] outline-none focus:border-[#C9963B]/50 focus:ring-1 focus:ring-[#C9963B]/30 transition-all"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A09888] transition-colors"
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
                  style={{ background: 'linear-gradient(135deg, #C9963B, #E8B960)', color: '#1A1714' }}
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
