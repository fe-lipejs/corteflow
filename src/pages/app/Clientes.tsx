import { useState, useMemo } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Clientes() {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const [segment, setSegment] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
    <div className="h-full flex flex-col space-y-6 w-full min-w-0 animate-fade-in">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textSecondary }}>CRM</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: theme.textPrimary }}>Clientes</h1>
          <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>Gestão e histórico da sua base.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 glass-card"
            style={{ borderColor: theme.border, color: theme.textPrimary }}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </button>
        </div>
      </header>

      <div className="border rounded-2xl shadow-2xl flex-1 flex flex-col min-h-[500px] glass-card" style={{ borderColor: theme.border }}>
        {/* Mobile Filter Toggle */}
        <div className="md:hidden p-4 border-b" style={{ borderColor: theme.border }}>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 transition-colors"
            style={{ color: theme.textSecondary }}
          >
            <Filter className="w-4 h-4" /> Filtros e Busca
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${showFilters ? 'block' : 'hidden md:flex'}`}
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
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${segment === tab.id ? 'font-bold' : 'hover:opacity-80'}`}
                style={{
                  background: segment === tab.id ? theme.accentGradient : 'transparent',
                  color: segment === tab.id ? theme.btnPrimaryText : theme.textSecondary,
                  boxShadow: segment === tab.id ? theme.shadowAccent : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-auto">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textSecondary }} />
             <input 
               type="text" 
               placeholder="Buscar cliente..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none w-full md:w-64 transition-all themed-input" 
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
               <div className="h-full flex flex-col items-center justify-center space-y-2" style={{ color: theme.textSecondary }}>
                 <p className="font-semibold text-lg" style={{ color: theme.textPrimary }}>
                   {customers.length === 0 ? "Sem informações suficientes" : "Nenhum cliente encontrado"}
                 </p>
                 <p className="text-sm">
                   {customers.length === 0 ? "Sua lista de clientes aparecerá aqui assim que houver cadastros." : "Tente ajustar os filtros de busca."}
                 </p>
               </div>
             ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: theme.border, color: theme.textSecondary }}>
                      <th className="py-3 px-4 font-semibold">Nome / Contato</th>
                      <th className="py-3 px-4 font-semibold">Segmento</th>
                      <th className="py-3 px-4 font-semibold">Cadastrado em</th>
                      <th className="py-3 px-4 font-semibold text-right">Total Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(cliente => (
                      <tr key={cliente.id} className="border-b last:border-b-0 hover:bg-black/5 transition-colors" style={{ borderColor: theme.border }}>
                        <td className="py-4 px-4">
                          <p className="font-semibold" style={{ color: theme.textPrimary }}>{cliente.name}</p>
                          <p className="text-xs" style={{ color: theme.textSecondary }}>{cliente.phone || cliente.email || 'Sem contato'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                            style={{ 
                              background: cliente.segment === 'vip' ? `${theme.accent}20` : cliente.segment === 'fiel' ? `${theme.success}20` : `${theme.info}20`,
                              color: cliente.segment === 'vip' ? theme.accent : cliente.segment === 'fiel' ? theme.success : theme.info
                            }}
                          >
                            {cliente.segment || 'Novo'}
                          </span>
                        </td>
                        <td className="py-4 px-4" style={{ color: theme.textSecondary }}>
                          {format(new Date(cliente.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </td>
                        <td className="py-4 px-4 text-right font-bold" style={{ color: theme.textPrimary }}>
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
    </div>
  );
}
