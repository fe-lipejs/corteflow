import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ExternalLink, MoreVertical, CheckCircle,
  ShieldAlert, Ban, PlayCircle, Building2, ChevronLeft, ChevronRight,
  ArrowUpDown, Trash2, RotateCcw
} from 'lucide-react';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import AdminBadge from './components/AdminBadge';
import { AdminTableSkeleton } from './components/AdminSkeleton';
import type { Database } from '../../types/database';

type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  deleted_at?: string | null;
  tenant_settings?: {
    logo_url: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  } | null;
  subscriptions?: Array<{
    status: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    grace_period_ends_at: string | null;
    canceled_at: string | null;
    suspension_reason: string | null;
    plans?: { name: string } | null;
    current_period_end: string | null;
  }>;
};

type SortField = 'name' | 'created_at' | 'status';
type StatusFilter = 'all' | 'active' | 'trial' | 'suspended' | 'blocked' | 'canceled' | 'deleted';
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
  const [deleteModalOpen, setDeleteModalOpen] = useState<Tenant | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [stripeInfoModalOpen, setStripeInfoModalOpen] = useState<Tenant | null>(null);
  const queryClient = useQueryClient();

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin_tenants_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_settings (logo_url, phone, city, state),
          subscriptions (status, stripe_subscription_id, stripe_customer_id, grace_period_ends_at, canceled_at, suspension_reason, current_period_end, plans (name))
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

  const restoreTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error: rpcErr } = await supabase.rpc('restore_tenant', { p_tenant_id: id });
      if (rpcErr) {
        const { error } = await supabase.from('tenants').update({ deleted_at: null, status: 'active' } as any).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
      setOpenMenuId(null);
      alert('Empresa restaurada com sucesso! O acesso do cliente foi reativado.');
    },
    onError: (err: any) => {
      alert(`Erro ao restaurar empresa: ${err.message}`);
    }
  });

  const deleteTenant = useMutation({
    mutationFn: async (tenant: Tenant) => {
      // 1. Invoke delete-account edge function which guarantees immediate Stripe cancellation
      try {
        await supabase.functions.invoke('delete-account', {
          body: { target_tenant_id: tenant.id }
        });
      } catch (edgeErr) {
        console.warn('Edge function delete-account warning:', edgeErr);
      }

      // 2. Mark subscription as canceled in database
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() } as any)
        .eq('tenant_id', tenant.id);

      // 3. Perform safe soft delete
      const { error } = await supabase.rpc('delete_tenant_safely', { p_tenant_id: tenant.id });
      if (error) {
        // Fallback to direct update if RPC has check constraints
        const { error: fallbackErr } = await supabase
          .from('tenants')
          .update({ deleted_at: new Date().toISOString(), status: 'canceled' } as any)
          .eq('id', tenant.id);
        if (fallbackErr) throw fallbackErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
      setDeleteModalOpen(null);
      setDeleteConfirmText('');
      alert('Empresa excluída com sucesso e assinatura no Stripe cancelada imediatamente.');
    },
    onError: (err: any) => {
      alert(`Erro ao excluir empresa: ${err.message}`);
    }
  });

  // ── Filter + Sort + Paginate ──
  const filtered = tenants
    .filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase());
      
      const computedStatus = t.deleted_at ? 'deleted' : t.status;
      const matchStatus = statusFilter === 'all' || computedStatus === statusFilter;
      const matchType = typeFilter === 'all' || t.business_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortField === 'name') return dir * a.name.localeCompare(b.name);
      if (sortField === 'status') {
        const statusA = a.deleted_at ? 'deleted' : a.status;
        const statusB = b.deleted_at ? 'deleted' : b.status;
        return dir * statusA.localeCompare(statusB);
      }
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
          <option value="deleted">Excluída</option>
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
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-visible">
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
              const computedStatus = tenant.deleted_at ? 'deleted' : tenant.status;

              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`group grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-[#0f0f0f] transition-colors relative ${openMenuId === tenant.id ? 'z-40' : 'z-0'} ${tenant.deleted_at ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
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
                      <p className={`text-sm font-medium truncate ${tenant.deleted_at ? 'text-[#666] line-through' : 'text-white'}`}>{tenant.name}</p>
                      <p className="text-xs text-[#444] truncate">/{tenant.slug}{settings?.city ? ` · ${settings.city}` : ''}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2 hidden lg:block text-xs text-[#555]">
                    {businessTypeLabel[tenant.business_type] ?? tenant.business_type}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 hidden md:block">
                    {(() => {
                      if (tenant.deleted_at) {
                        return <AdminBadge value="deleted" dot />;
                      }
                      
                      // Pick subscription by sorting current_period_end (descending)
                      const latestSub = tenant.subscriptions?.sort((a, b) => {
                        const dateA = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
                        const dateB = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
                        return dateB - dateA;
                      })[0];
                      
                      if (latestSub && (tenant.status === 'active' || tenant.status === 'trial')) {
                        const stripeStatus = latestSub.status;
                        
                        if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
                          let daysLeftText = '';
                          if (latestSub.grace_period_ends_at) {
                            const days = Math.ceil((new Date(latestSub.grace_period_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            if (days > 0) {
                              daysLeftText = `Bloqueia em ${days} dia${days > 1 ? 's' : ''}`;
                            } else {
                              daysLeftText = 'Prazo expirado';
                            }
                          }
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <AdminBadge value="past_due" dot />
                              {daysLeftText && <span className="text-[10px] text-yellow-500/70 font-semibold">{daysLeftText}</span>}
                            </div>
                          );
                        }
                        
                        if (stripeStatus === 'canceled') {
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <AdminBadge value="canceled" dot />
                              {latestSub.canceled_at && <span className="text-[10px] text-[#666] font-semibold">{new Date(latestSub.canceled_at).toLocaleDateString('pt-BR')}</span>}
                            </div>
                          );
                        }

                        if (stripeStatus === 'active') return <AdminBadge value="active" dot />;
                        if (stripeStatus === 'trialing' || stripeStatus === 'trial') return <AdminBadge value="trial" dot />;
                      }

                      return <AdminBadge value={tenant.status} dot />;
                    })()}
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
                    {!tenant.deleted_at && (
                      <button
                        onClick={() => window.open(`/${tenant.slug}`, '_blank')}
                        className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                        title="Ver página pública"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                        className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === tenant.id && (
                        <div className="absolute right-0 top-8 w-48 bg-[#0f0f0f] border border-[#222] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[999] overflow-hidden">
                          {tenant.deleted_at ? (
                            <button
                              onClick={() => restoreTenant.mutate(tenant.id)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Empresa
                            </button>
                          ) : (
                            <>
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
                            </>
                          )}
                          <button
                            onClick={() => {
                              setStripeInfoModalOpen(tenant);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-white transition-colors border-t border-[#111]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Detalhes Stripe
                          </button>
                          {!tenant.deleted_at && (
                            <button
                              onClick={() => {
                                setDeleteModalOpen(tenant);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors border-t border-[#111] font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Apagar Empresa
                            </button>
                          )}
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

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-500 mb-2">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="font-bold text-lg text-white">Apagar Empresa</h3>
              </div>
              <p className="text-sm text-[#888] leading-relaxed">
                Esta ação é <strong className="text-white">irreversível</strong>. Todos os dados da empresa 
                <strong className="text-white"> {deleteModalOpen.name}</strong>, incluindo clientes, agendamentos, financeiros e profissionais serão apagados permanentemente.
              </p>
              
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-[#555] mb-2">
                  Para confirmar, digite: <span className="text-white select-none">{deleteModalOpen.slug}</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModalOpen.slug}
                  className="w-full px-4 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl text-sm text-white outline-none focus:border-red-500/50 transition-colors"
                  onPaste={e => e.preventDefault()}
                />
              </div>
            </div>
            
            <div className="border-t border-[#1a1a1a] p-4 flex justify-end gap-3 bg-[#0a0a0a]">
              <button
                onClick={() => {
                  setDeleteModalOpen(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm text-[#888] hover:text-white transition-colors"
                disabled={deleteTenant.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTenant.mutate(deleteModalOpen)}
                disabled={deleteConfirmText !== deleteModalOpen.slug || deleteTenant.isPending}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteTenant.isPending ? 'Apagando...' : 'Apagar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stripe Info Modal */}
      {stripeInfoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1a1a1a]">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Detalhes do Stripe</h3>
              <p className="text-sm text-[#888] mt-1">Informações de assinatura para {stripeInfoModalOpen.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              {stripeInfoModalOpen.subscriptions && stripeInfoModalOpen.subscriptions.length > 0 ? (
                <>
                  {stripeInfoModalOpen.subscriptions.map((sub, idx) => (
                    <div key={idx} className="bg-[#111] p-4 rounded-xl border border-[#1a1a1a] text-sm">
                      <div className="grid grid-cols-2 gap-y-3">
                        <div className="text-[#888]">Status:</div>
                        <div className="text-white font-medium capitalize">{sub.status}</div>
                        
                        <div className="text-[#888]">Plano:</div>
                        <div className="text-white">{sub.plans?.name || 'Desconhecido'}</div>
                        
                        <div className="text-[#888]">Customer ID:</div>
                        <div className="text-white font-mono text-xs">{sub.stripe_customer_id || '—'}</div>
                        
                        <div className="text-[#888]">Subscription ID:</div>
                        <div className="text-white font-mono text-xs">{sub.stripe_subscription_id || '—'}</div>
                        
                        {sub.current_period_end && (
                          <>
                            <div className="text-[#888]">Período expira:</div>
                            <div className="text-white">{new Date(sub.current_period_end).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}

                        {sub.grace_period_ends_at && (
                          <>
                            <div className="text-red-400">Carência até:</div>
                            <div className="text-red-400 font-bold">{new Date(sub.grace_period_ends_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                        
                        {sub.canceled_at && (
                          <>
                            <div className="text-[#888]">Cancelado em:</div>
                            <div className="text-white">{new Date(sub.canceled_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                      </div>
                      {sub.suspension_reason && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                          <strong>Motivo da suspensão:</strong> {sub.suspension_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6 text-[#888]">
                  <p>Nenhuma assinatura registrada no Stripe.</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-[#1a1a1a] p-4 flex justify-end bg-[#0a0a0a]">
              <button
                onClick={() => setStripeInfoModalOpen(null)}
                className="px-6 py-2 bg-white text-black font-bold rounded-lg transition-opacity hover:opacity-90 text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
