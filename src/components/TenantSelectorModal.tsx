import { useState } from 'react';
import { Building2, Loader2, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';

export interface TenantOption {
  tenant_id: string;
  role: string;
  tenants: {
    id: string;
    name: string;
    business_type: string;
    slug: string;
  };
}

interface Props {
  options: TenantOption[];
}

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  barbearia: '💈 Barbearia',
  salao: '💇 Salão de Beleza',
  esmalteria: '💅 Esmalteria',
};

export function TenantSelectorModal({ options }: Props) {
  const { switchTenantContext, signOut } = useAuth();
  const { theme } = useTheme();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (tenantId: string) => {
    setLoadingId(tenantId);
    setError(null);
    try {
      await switchTenantContext(tenantId);
    } catch (err: any) {
      setError(err?.message || 'Erro ao selecionar salão. Tente novamente.');
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-md border rounded-3xl p-8 shadow-2xl"
        style={{ background: theme.cardBg, borderColor: theme.border }}
      >
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${theme.accent}20` }}
          >
            <Building2 className="w-8 h-8" style={{ color: theme.accent }} />
          </div>
          <h2 className="text-xl font-bold font-serif mb-1" style={{ color: theme.textPrimary }}>
            Qual salão você vai acessar?
          </h2>
          <p className="text-sm" style={{ color: theme.textSecondary }}>
            Você está vinculado a {options.length} estabelecimentos. Selecione um para continuar.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {options.map((opt) => {
            const tenant = opt.tenants;
            const isLoading = loadingId === tenant.id;
            return (
              <button
                key={tenant.id}
                onClick={() => handleSelect(tenant.id)}
                disabled={!!loadingId}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  borderColor: isLoading ? theme.accent : theme.border,
                  background: isLoading ? `${theme.accent}10` : theme.inputBg,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
                  style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
                >
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: theme.textPrimary }}>
                    {tenant.name}
                  </p>
                  <p className="text-xs" style={{ color: theme.textSecondary }}>
                    {BUSINESS_TYPE_LABEL[tenant.business_type] || tenant.business_type}
                  </p>
                </div>
                <div className="shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: theme.accent }} />
                  ) : (
                    <ChevronRight className="w-5 h-5" style={{ color: theme.textSecondary }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: theme.textSecondary }}
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
