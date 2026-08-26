import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, ChevronRight, LogOut, Loader2, Scissors } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export default function SelectTenant() {
  const { user, memberships, switchTenantContext, signOut, tenantId, loading } = useContext(AuthContext)!;
  const navigate = useNavigate();
  const location = useLocation();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  // If loading auth or user doesn't exist, wait (handled by AuthGuard generally, but good to check)
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // If user only has 1 membership and is already on it, auto redirect
  useEffect(() => {
    if (memberships.length === 1 && !loading) {
      const singleTenantId = memberships[0].tenant_id;
      if (tenantId !== singleTenantId) {
        handleSwitch(singleTenantId);
      } else {
        navigate('/admin');
      }
    }
  }, [memberships, tenantId, loading]);

  const handleSwitch = async (id: string) => {
    setIsSwitching(id);
    try {
      await switchTenantContext(id);
      // Determine where they were trying to go
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from);
    } catch (err) {
      console.error(err);
      setIsSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 mb-8">
          <Scissors className="w-8 h-8 text-[#FFC400]" />
          <span className="text-2xl font-bold tracking-tight">Navalha</span>
        </div>
        <div className="max-w-md w-full bg-zinc-900 rounded-xl p-8 text-center border border-zinc-800">
          <Store className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum estabelecimento</h2>
          <p className="text-zinc-400 mb-6">
            Sua conta não possui vínculo com nenhuma barbearia no momento. Peça ao administrador para convidar você.
          </p>
          <button onClick={signOut} className="w-full bg-transparent border border-zinc-700 text-white hover:bg-zinc-800 flex items-center justify-center py-2.5 rounded-lg transition-colors font-medium">
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-8">
        <Scissors className="w-8 h-8 text-[#FFC400]" />
        <span className="text-2xl font-bold tracking-tight">Navalha</span>
      </div>
      
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Bem-vindo de volta!</h1>
          <p className="text-zinc-400">Selecione onde você deseja trabalhar hoje.</p>
        </div>

        <div className="space-y-3 mb-8">
          {memberships.map((mem) => {
            const tenant = mem.tenants;
            if (!tenant) return null;
            
            const isCurrent = tenantId === tenant.id;
            
            return (
              <motion.button
                key={tenant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleSwitch(tenant.id)}
                disabled={isSwitching !== null}
                className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                  isCurrent 
                    ? 'bg-[#FFC400]/10 border-[#FFC400]/50 hover:bg-[#FFC400]/20' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  {tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
                      <Store className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white">{tenant.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                        {mem.role === 'owner' ? 'Proprietário' : mem.role === 'manager' ? 'Gerente' : 'Profissional'}
                      </span>
                      {isCurrent && (
                        <span className="text-xs text-[#FFC400]">Selecionado</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {isSwitching === tenant.id ? (
                  <Loader2 className="w-5 h-5 text-[#FFC400] animate-spin" />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${isCurrent ? 'text-[#FFC400]' : 'text-zinc-500'}`} />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={signOut} className="text-zinc-500 hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
