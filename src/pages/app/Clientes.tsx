import { useState, useMemo, useEffect } from 'react';
import { Search, Download, Filter, Crown, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { usePermissionEngine } from '../../hooks/usePermissionEngine';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CustomerModal } from './clientes/CustomerModal';
import { UpgradeModal } from '../../components/UpgradeModal';

export default function Clientes() {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const engine = usePermissionEngine();
  const navigate = useNavigate();

  const isLight =
    theme.id === 'elegant' ||
    (theme.bg && (theme.bg.toLowerCase().startsWith('#f') || theme.bg.toLowerCase().startsWith('#fff')));

  const [segment, setSegment] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

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

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [segment, searchTerm]);

  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

  const money = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleExport = () => {
    if (!engine.hasPermission('clientes.exportar')) {
      setShowUpgradeModal('clientes.exportar');
      return;
    }
    if (!customers || customers.length === 0) return;

    const headers = ['Nome', 'Telefone', 'Email', 'Segmento', 'Gasto Total', 'Criado em'];
    const rows = filteredCustomers.map(c => [
      `"${c.name || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      `"${c.segment || ''}"`,
      `"${c.total_spent || 0}"`,
      `"${c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy') : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clientes_${tenant?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col space-y-6 w-full min-w-0 animate-fade-in pb-12">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: isLight ? '#475569' : theme.textSecondary }}>CRM</p>
          <h1 className="font-serif text-3xl font-bold" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>Clientes</h1>
          <p className="mt-1 text-sm" style={{ color: isLight ? '#475569' : theme.textSecondary }}>Gestão e histórico da sua base.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 border rounded-xl font-medium transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer"
            style={{
              borderColor: isLight ? '#CBD5E1' : theme.border,
              background: isLight ? '#FFFFFF' : theme.cardBg,
              color: isLight ? '#0F172A' : theme.textPrimary,
            }}
          >
            <Download className="w-4 h-4 mr-2" /> Exportar
          </button>
        </div>
      </header>

      <div
        className="border rounded-2xl flex-1 flex flex-col min-h-[500px] transition-all"
        style={{
          borderColor: isLight ? '#E2E8F0' : theme.border,
          background: isLight ? '#FFFFFF' : theme.cardBg,
          boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        {/* Mobile Filter Toggle */}
        <div className="md:hidden p-4 border-b" style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 transition-colors cursor-pointer text-sm font-semibold"
            style={{ color: isLight ? '#334155' : theme.textSecondary }}
          >
            <Filter className="w-4 h-4" /> Filtros e Busca
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div
          className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${showFilters ? 'block' : 'hidden md:flex'}`}
          style={{
            borderColor: isLight ? '#E2E8F0' : theme.border,
            background: isLight ? '#F8FAFC' : theme.inputBg,
          }}
        >
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
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${segment === tab.id ? 'shadow-sm' : 'hover:opacity-80'}`}
                style={{
                  background: segment === tab.id ? theme.accentGradient : (isLight ? '#FFFFFF' : 'transparent'),
                  color: segment === tab.id ? theme.btnPrimaryText : (isLight ? '#334155' : theme.textSecondary),
                  border: segment === tab.id ? 'none' : `1px solid ${isLight ? '#CBD5E1' : theme.border}`,
                  boxShadow: segment === tab.id ? theme.shadowAccent : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: isLight ? '#64748B' : theme.textSecondary }} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="py-2 pl-10 pr-4 rounded-xl text-sm outline-none w-full md:w-64 transition-all themed-input"
              style={{
                borderColor: isLight ? '#CBD5E1' : theme.border,
                background: isLight ? '#FFFFFF' : theme.inputBg,
                color: isLight ? '#0F172A' : theme.textPrimary,
              }}
            />
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="min-w-[600px] h-full flex flex-col justify-between">
            {isLoading ? (
              <table className="w-full text-left">
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={4} />
                  ))}
                </tbody>
              </table>
            ) : filteredCustomers.length === 0 ? (
              <div
                className="h-full flex flex-col items-center justify-center py-20 space-y-2"
                style={{ color: isLight ? '#64748B' : theme.textSecondary }}
              >
                <p className="font-bold text-lg" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                  {customers.length === 0 ? "Nenhum cliente cadastrado ainda" : "Nenhum cliente encontrado"}
                </p>
                <p className="text-sm font-medium">
                  {customers.length === 0 ? "Sua base de clientes será preenchida automaticamente com os agendamentos." : "Tente ajustar os filtros ou a busca acima."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: isLight ? '#E2E8F0' : theme.border, color: isLight ? '#64748B' : theme.textSecondary }}
                  >
                    <th className="py-3 px-4 font-semibold">Nome / Contato</th>
                    <th className="py-3 px-4 font-semibold">Segmento</th>
                    <th className="py-3 px-4 font-semibold">Cadastrado em</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map(cliente => (
                    <tr
                      key={cliente.id}
                      className="border-b last:border-b-0 hover:bg-black/5 transition-colors cursor-pointer"
                      style={{ borderColor: isLight ? '#F1F5F9' : theme.border }}
                      onClick={() => setSelectedCustomer(cliente)}
                    >
                      <td className="py-4 px-4">
                        <p className="font-bold text-sm" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{cliente.name}</p>
                        <p className="text-xs font-medium" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>{cliente.phone || cliente.email || 'Sem contato'}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm"
                          style={{
                            background: cliente.segment === 'vip'
                              ? (isLight ? '#FEF3C7' : 'rgba(245, 158, 11, 0.2)')
                              : cliente.segment === 'fiel'
                                ? (isLight ? '#DCFCE7' : 'rgba(34, 197, 94, 0.2)')
                                : (isLight ? '#DBEAFE' : 'rgba(59, 130, 246, 0.2)'),
                            color: cliente.segment === 'vip'
                              ? (isLight ? '#92400E' : '#FBBF24')
                              : cliente.segment === 'fiel'
                                ? (isLight ? '#166534' : '#4ADE80')
                                : (isLight ? '#1E40AF' : '#60A5FA'),
                            borderColor: cliente.segment === 'vip'
                              ? (isLight ? '#FDE68A' : 'rgba(245, 158, 11, 0.3)')
                              : cliente.segment === 'fiel'
                                ? (isLight ? '#BBF7D0' : 'rgba(34, 197, 94, 0.3)')
                                : (isLight ? '#BFDBFE' : 'rgba(59, 130, 246, 0.3)'),
                          }}
                        >
                          {cliente.segment || 'Novo'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium" style={{ color: isLight ? '#475569' : theme.textSecondary }}>
                        {format(new Date(cliente.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-sm" style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>
                        {money(cliente.total_spent || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {filteredCustomers.length > 0 && (
              <div
                className="pt-6 border-t mt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                style={{ borderColor: isLight ? '#E2E8F0' : theme.border }}
              >
                <p className="text-xs font-medium" style={{ color: isLight ? '#64748B' : theme.textSecondary }}>
                  Mostrando <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{(currentPage - 1) * PAGE_SIZE + 1}</strong> a <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{Math.min(currentPage * PAGE_SIZE, filteredCustomers.length)}</strong> de <strong style={{ color: isLight ? '#0F172A' : theme.textPrimary }}>{filteredCustomers.length}</strong> clientes
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
                    style={{
                      borderColor: isLight ? '#CBD5E1' : theme.border,
                      color: isLight ? '#0F172A' : theme.textPrimary,
                    }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive ? 'shadow-sm' : 'hover:bg-black/5'}`}
                          style={{
                            background: isActive ? theme.accentGradient : 'transparent',
                            color: isActive ? theme.btnPrimaryText : (isLight ? '#334155' : theme.textSecondary),
                            border: `1px solid ${isActive ? theme.accent : (isLight ? '#CBD5E1' : theme.border)}`
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-1 text-xs opacity-50">...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 cursor-pointer"
                    style={{
                      borderColor: isLight ? '#CBD5E1' : theme.border,
                      color: isLight ? '#0F172A' : theme.textPrimary,
                    }}
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
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

      {/* ── Modal: Upgrade Plan ── */}
      {showUpgradeModal && (
        <UpgradeModal 
          feature={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(null)} 
        />
      )}
    </div>
  );
}
