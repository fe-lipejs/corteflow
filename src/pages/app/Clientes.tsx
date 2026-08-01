import { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

export default function Clientes() {
  const { theme } = useTheme();
  const [segment, setSegment] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);
  
  // Fake loading state for visual demonstration
  const [isLoading, setIsLoading] = useState(true);

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
              { id: 'novos', label: 'Novos' },
              { id: 'fieis', label: 'Fiéis' },
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
             <input type="text" placeholder="Buscar cliente..." className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none w-full md:w-64 transition-all themed-input" />
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
             ) : (
               <div className="h-full flex items-center justify-center" style={{ color: theme.textSecondary }}>
                 Sua lista de clientes aparecerá aqui.
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
