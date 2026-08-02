import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ExternalLink, MoreVertical, CheckCircle,
  ShieldAlert, Ban, PlayCircle, Building2, ChevronLeft, ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import AdminBadge from './components/AdminBadge';
import { AdminTableSkeleton } from './components/AdminSkeleton';
import type { Database } from '../../types/database';

type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  tenant_settings?: {
    logo_url: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  } | null;
  subscriptions?: Array<{
    status: string;
    plans?: { name: string } | null;
    current_period_end: string | null;
  }>;
};

type SortField = 'name' | 'created_at' | 'status';
type StatusFilter = 'all' | 'active' | 'trial' | 'suspended' | 'blocked' | 'canceled';
type TypeFilter = 'all' | 'barbearia' | 'salao' | 'esmalteria';

const PAGE_SIZE = 20;

export default function AdminTenants() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin_tenants_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_settings (logo_url, phone, city, state),
          subscriptions (status, current_period_end, plans (name))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('tenants').update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
      setOpenMenuId(null);
    }
  });

  // ── Filter + Sort + Paginate ──
  const filtered = tenants
    .filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchType = typeFilter === 'all' || t.business_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortField === 'name') return dir * a.name.localeCompare(b.name);
      if (sortField === 'status') return dir * a.status.localeCompare(b.status);
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
    setPage(0);
  };

  const businessTypeLabel: Record<string, string> = {
    barbearia: 'Barbearia',
    salao: 'Salão',
    esmalteria: 'Esmalteria',
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Empresas"
        subtitle={`${tenants.length} empresa${tenants.length !== 1 ? 's' : ''} cadastrada${tenants.length !== 1 ? 's' : ''}`}
        icon={<Building2 className="w-5 h-5" />}
      />

      {/* ── Filters ── */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            placeholder="Buscar empresa ou slug..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#444] outline-none focus:border-[#333] transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-[#888] outline-none focus:border-[#333] transition-colors"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspenso</option>
          <option value="blocked">Bloqueado</option>
          <option value="canceled">Cancelado</option>
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as TypeFilter); setPage(0); }}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-[#888] outline-none focus:border-[#333] transition-colors"
        >
          <option value="all">Todos os tipos</option>
          <option value="barbearia">Barbearia</option>
          <option value="salao">Salão</option>
          <option value="esmalteria">Esmalteria</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="border-b border-[#111] px-5 py-3 grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-[#333]">
          <div className="col-span-4">
            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-[#666] transition-colors">
              Empresa <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 hidden lg:block">Tipo</div>
          <div className="col-span-2 hidden md:block">
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-[#666] transition-colors">
              Status <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 hidden lg:block">Plano</div>
          <div className="col-span-2 hidden lg:block">
            <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-[#666] transition-colors">
              Cadastro <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 md:col-span-2 text-right">Ações</div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <AdminTableSkeleton rows={8} />
        ) : paginated.length === 0 ? (
          <AdminEmptyState
            title="Nenhuma empresa encontrada"
            description="Tente ajustar os filtros ou o termo de busca."
            icon={<Building2 className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y divide-[#0d0d0d]">
            {paginated.map((tenant, i) => {
              const activeSub = tenant.subscriptions?.find(s => s.status === 'active' || s.status === 'trial');
              const settings = tenant.tenant_settings;

              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="group grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-[#0f0f0f] transition-colors relative"
                >
                  {/* Name + slug */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-[#111] border border-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-[#444]">{tenant.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tenant.name}</p>
                      <p className="text-xs text-[#444] truncate">/{tenant.slug}{settings?.city ? ` · ${settings.city}` : ''}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2 hidden lg:block text-xs text-[#555]">
                    {businessTypeLabel[tenant.business_type] ?? tenant.business_type}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 hidden md:block">
                    <AdminBadge value={tenant.status} dot />
                  </div>

                  {/* Plan */}
                  <div className="col-span-2 hidden lg:block text-xs text-[#555]">
                    {activeSub?.plans?.name ?? '—'}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 hidden lg:block text-xs text-[#333]">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => window.open(`/${tenant.slug}`, '_blank')}
                      className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                      title="Ver página pública"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                        className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === tenant.id && (
                        <div className="absolute right-0 top-8 w-44 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl shadow-2xl z-50 overflow-hidden">
                          <button
                            onClick={() => updateStatus.mutate({ id: tenant.id, status: 'active' })}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-emerald-400 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Ativar
                          </button>
                          <button
                            onClick={() => updateStatus.mutate({ id: tenant.id, status: 'trial' })}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-amber-400 transition-colors"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Colocar em Trial
                          </button>
                          <button
                            onClick={() => updateStatus.mutate({ id: tenant.id, status: 'suspended' })}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-orange-400 transition-colors border-t border-[#111]"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Suspender
                          </button>
                          <button
                            onClick={() => updateStatus.mutate({ id: tenant.id, status: 'blocked' })}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-red-400 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" /> Bloquear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="border-t border-[#111] px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-[#444]">
              {filtered.length} empresa{filtered.length !== 1 ? 's' : ''}
              {' · '}Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
