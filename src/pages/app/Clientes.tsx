import { useState, useMemo } from 'react';
import { Search, Download, Filter, Users, Star, Award, UserPlus } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CustomerModal } from './clientes/CustomerModal';

export default function Clientes() {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const [segment, setSegment] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['clientes', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const stats = useMemo(() => {
    const total = customers.length;
    const vips = customers.filter(c => c.segment === 'vip').length;
    const fieis = customers.filter(c => c.segment === 'fiel').length;
    const novos = customers.filter(c => !c.segment || c.segment === 'novo').length;
    return { total, vips, fieis, novos };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    
    if (segment !== 'todos') {
      result = result.filter(c => c.segment === segment);
    }
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name?.toLowerCase().includes(lower) || 
        c.phone?.includes(lower) ||
        c.email?.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [customers, segment, searchTerm]);

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in pb-10">
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>CRM & Gestão</p>
          <h1 className="text-3xl font-bold font-sans" style={{ color: theme.textPrimary }}>Clientes</h1>
          <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Base completa e histórico de relacionamento com seus clientes.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 glass-card"
            style={{ borderColor: theme.border, color: theme.textPrimary }}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </button>
        </div>
      </header>

      {/* ── KPIs — Clean Financeiro Style ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total de Clientes', value: stats.total, icon: Users, isHighlight: false, badge: 'Base Total' },
          { label: 'Clientes VIPs', value: stats.vips, icon: Star, isHighlight: true, badge: 'Alta Frequência' },
          { label: 'Clientes Fiéis', value: stats.fieis, icon: Award, isHighlight: false, badge: 'Recorrentes' },
          { label: 'Novos Clientes', value: stats.novos, icon: UserPlus, isHighlight: false, badge: 'Recentes' },
        ].map((stat, i) => (
          stat.isHighlight ? (
            <div key={i} className="p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5"
              style={{ background: theme.accentGradient, borderColor: theme.accent, color: theme.btnPrimaryText }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-full bg-black/15 flex items-center justify-center backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-black/20 rounded-full backdrop-blur-sm" style={{ color: theme.btnPrimaryText }}>{stat.badge}</span>
              </div>
              <p className="text-sm font-bold opacity-80 mb-1 relative z-10">{stat.label}</p>
              <h3 className="text-3xl font-black relative z-10 tracking-tight">
                {isLoading ? '—' : stat.value}
              </h3>
            </div>
          ) : (
            <div key={i} className="p-6 rounded-3xl border shadow-sm glass-card flex flex-col justify-between transition-all hover:-translate-y-0.5"
              style={{ borderColor: theme.border }}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: theme.accentMuted, color: theme.accent }}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 border rounded-full" style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textSecondary }}>{stat.badge}</span>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: theme.textSecondary }}>{stat.label}</p>
              <h3 className="text-3xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
                {isLoading ? '—' : stat.value}
              </h3>
            </div>
          )
        ))}
      </div>

      {/* ── CONTAINER DA TABELA ── */}
      <div className="border rounded-3xl shadow-sm flex-1 flex flex-col min-h-[500px] glass-card overflow-hidden" style={{ borderColor: theme.border }}>
        {/* Filters and Search Bar */}
        <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"
          style={{ borderColor: theme.border, background: theme.inputBg }}>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'novo', label: 'Novos' },
              { id: 'fiel', label: 'Fiéis' },
              { id: 'vip', label: 'VIP' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setSegment(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${segment === tab.id ? 'shadow-sm' : 'hover:opacity-80'}`}
                style={{
                  background: segment === tab.id ? theme.accentGradient : theme.cardBg,
                  color: segment === tab.id ? theme.btnPrimaryText : theme.textSecondary,
                  border: segment === tab.id ? 'none' : `1px solid ${theme.border}`,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-auto">
             <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: theme.textSecondary }} />
             <input 
               type="text" 
               placeholder="Buscar por nome, telefone ou e-mail..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="py-2.5 rounded-2xl text-sm outline-none w-full md:w-80 transition-all themed-input themed-input-search" 
             />
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="min-w-[600px] h-full">
             {isLoading ? (
               <table className="w-full text-left">
                 <tbody>
                   {Array.from({ length: 6 }).map((_, i) => (
                     <TableRowSkeleton key={i} cols={4} />
                   ))}
                 </tbody>
               </table>
             ) : filteredCustomers.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center py-16 space-y-2" style={{ color: theme.textSecondary }}>
                 <p className="font-bold text-lg" style={{ color: theme.textPrimary }}>
                   {customers.length === 0 ? "Nenhum cliente cadastrado ainda" : "Nenhum cliente encontrado"}
                 </p>
                 <p className="text-xs max-w-sm text-center">
                   {customers.length === 0 ? "Sua base de clientes será preenchida automaticamente conforme novos agendamentos forem realizados." : "Tente ajustar os termos de busca."}
                 </p>
               </div>
             ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                      <th className="pb-4 px-4 font-semibold text-xs uppercase tracking-wider">Cliente</th>
                      <th className="pb-4 px-4 font-semibold text-xs uppercase tracking-wider">Segmento</th>
                      <th className="pb-4 px-4 font-semibold text-xs uppercase tracking-wider">Cadastrado em</th>
                      <th className="pb-4 px-4 font-semibold text-xs uppercase tracking-wider text-right">Total Investido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(cliente => (
                      <tr 
                        key={cliente.id} 
                        className="border-b last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" 
                        style={{ borderColor: theme.border }}
                        onClick={() => setSelectedCustomer(cliente)}
                      >
                        <td className="py-4 px-4">
                          <p className="font-bold text-sm" style={{ color: theme.textPrimary }}>{cliente.name}</p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: theme.textSecondary }}>{cliente.phone || cliente.email || 'Sem contato'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border"
                            style={{ 
                              background: cliente.segment === 'vip' ? `${theme.accent}20` : cliente.segment === 'fiel' ? `${theme.success}20` : `${theme.info}20`,
                              color: cliente.segment === 'vip' ? theme.accent : cliente.segment === 'fiel' ? theme.success : theme.info,
                              borderColor: cliente.segment === 'vip' ? `${theme.accent}40` : cliente.segment === 'fiel' ? `${theme.success}40` : `${theme.info}40`
                            }}
                          >
                            {cliente.segment || 'Novo'}
                          </span>
                        </td>
                        <td className="py-4 px-4" style={{ color: theme.textSecondary }}>
                          {format(new Date(cliente.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-base" style={{ color: theme.textPrimary }}>
                          {money(cliente.total_spent || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             )}
          </div>
        </div>
      </div>

      {selectedCustomer && (
        <CustomerModal 
          customer={selectedCustomer} 
          tenantId={tenant!.id} 
          onClose={() => setSelectedCustomer(null)} 
        />
      )}
    </div>
  );
}
