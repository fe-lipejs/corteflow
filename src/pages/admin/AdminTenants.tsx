import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
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
      
      const normalizedData = (data ?? []).map((tenant: any) => ({
        ...tenant,
        subscriptions: Array.isArray(tenant.subscriptions) 
          ? tenant.subscriptions 
          : (tenant.subscriptions ? [tenant.subscriptions] : [])
      }));
      
      return normalizedData as unknown as Tenant[];
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
    }
  });

  const deleteTenant = useMutation({
    mutationFn: async (tenant: Tenant) => {
      const { error } = await supabase.rpc('soft_delete_tenant', { p_tenant_id: tenant.id });
      if (error) {
        const { error: updateErr } = await supabase.from('tenants').update({
          deleted_at: new Date().toISOString(),
          status: 'canceled'
        } as any).eq('id', tenant.id);
        if (updateErr) throw updateErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
      setDeleteModalOpen(null);
      setDeleteConfirmText('');
    }
  });

  // Filter & sort
  const filtered = tenants
    .filter(t => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase());

      const isDeleted = !!t.deleted_at;
      let matchStatus = true;
      if (statusFilter === 'deleted') {
        matchStatus = isDeleted;
      } else if (statusFilter !== 'all') {
        matchStatus = !isDeleted && t.status === statusFilter;
      }

      const matchType = typeFilter === 'all' || t.business_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'created_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar empresa ou slug..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-xs"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors shadow-xs"
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
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 transition-colors shadow-xs"
        >
          <option value="all">Todos os tipos</option>
          <option value="barbearia">Barbearia</option>
          <option value="salao">Salão</option>
          <option value="esmalteria">Esmalteria</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-visible shadow-xs">
        {/* Table header */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <div className="col-span-4">
            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-slate-600 transition-colors">
              Empresa <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 hidden lg:block">Tipo</div>
          <div className="col-span-2 hidden md:block">
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-600 transition-colors">
              Status <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 hidden lg:block">Plano</div>
          <div className="col-span-2 hidden lg:block">
            <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-slate-600 transition-colors">
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
          <div className="divide-y divide-slate-100">
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
                  className={`group grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 transition-colors relative ${openMenuId === tenant.id ? 'z-40' : 'z-0'} ${tenant.deleted_at ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
                >
                  {/* Name + slug */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-blue-700">{tenant.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${tenant.deleted_at ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{tenant.name}</p>
                      <p className="text-xs text-slate-400 truncate">/{tenant.slug}{settings?.city ? ` · ${settings.city}` : ''}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2 hidden lg:block text-xs text-slate-500">
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
                              {daysLeftText && <span className="text-[10px] text-amber-600 font-semibold">{daysLeftText}</span>}
                            </div>
                          );
                        }
                        
                        if (stripeStatus === 'canceled') {
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <AdminBadge value="canceled" dot />
                              {latestSub.canceled_at && <span className="text-[10px] text-slate-500 font-semibold">{new Date(latestSub.canceled_at).toLocaleDateString('pt-BR')}</span>}
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
                  <div className="col-span-2 hidden lg:block text-xs text-slate-600">
                    {activeSub?.plans?.name ?? '—'}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 hidden lg:block text-xs text-slate-400">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1.5">
                    {!tenant.deleted_at && (
                      <button
                        onClick={() => window.open(getTenantPublicUrl(tenant.slug), '_blank')}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver página pública"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === tenant.id && (
                        <div className="absolute right-0 top-8 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[999] overflow-hidden py-1">
                          {tenant.deleted_at ? (
                            <button
                              onClick={() => restoreTenant.mutate(tenant.id)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Empresa
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'active' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors font-medium"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Ativar
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'trial' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-amber-600 transition-colors font-medium"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-amber-500" /> Colocar em Trial
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'suspended' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-orange-600 transition-colors border-t border-slate-100 font-medium"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" /> Suspender
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'blocked' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors font-medium"
                              >
                                <Ban className="w-3.5 h-3.5 text-red-500" /> Bloquear
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setStripeInfoModalOpen(tenant);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-t border-slate-100 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" /> Detalhes Stripe
                          </button>
                          {!tenant.deleted_at && (
                            <button
                              onClick={() => {
                                setDeleteModalOpen(tenant);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100 font-medium"
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
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-500">
              {filtered.length} empresa{filtered.length !== 1 ? 's' : ''}
              {' · '}Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-900">Apagar Empresa</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Esta ação é <strong className="text-slate-900">irreversível</strong>. Todos os dados da empresa 
                <strong className="text-slate-900"> {deleteModalOpen.name}</strong>, incluindo clientes, agendamentos, financeiros e profissionais serão apagados permanentemente.
              </p>
              
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Para confirmar, digite: <span className="text-slate-900 select-none font-bold">{deleteModalOpen.slug}</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModalOpen.slug}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                  onPaste={e => e.preventDefault()}
                />
              </div>
            </div>
            
            <div className="border-t border-slate-100 p-4 flex justify-end gap-3 bg-slate-50/70">
              <button
                onClick={() => {
                  setDeleteModalOpen(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
                disabled={deleteTenant.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTenant.mutate(deleteModalOpen)}
                disabled={deleteConfirmText !== deleteModalOpen.slug || deleteTenant.isPending}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                {deleteTenant.isPending ? 'Apagando...' : 'Apagar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Info Modal */}
      {stripeInfoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Detalhes do Stripe</h3>
              <p className="text-sm text-slate-500 mt-1">Informações de assinatura para {stripeInfoModalOpen.name}</p>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {stripeInfoModalOpen.subscriptions && stripeInfoModalOpen.subscriptions.length > 0 ? (
                <>
                  {stripeInfoModalOpen.subscriptions.map((sub, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                      <div className="grid grid-cols-2 gap-y-3">
                        <div className="text-slate-500">Status:</div>
                        <div className="text-slate-900 font-semibold capitalize">{sub.status}</div>
                        
                        <div className="text-slate-500">Plano:</div>
                        <div className="text-slate-900 font-medium">{sub.plans?.name || 'Desconhecido'}</div>
                        
                        <div className="text-slate-500">Customer ID:</div>
                        <div className="text-slate-700 font-mono text-xs">{sub.stripe_customer_id || '—'}</div>
                        
                        <div className="text-slate-500">Subscription ID:</div>
                        <div className="text-slate-700 font-mono text-xs">{sub.stripe_subscription_id || '—'}</div>
                        
                        {sub.current_period_end && (
                          <>
                            <div className="text-slate-500">Período expira:</div>
                            <div className="text-slate-900">{new Date(sub.current_period_end).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}

                        {sub.grace_period_ends_at && (
                          <>
                            <div className="text-red-600 font-medium">Carência até:</div>
                            <div className="text-red-600 font-bold">{new Date(sub.grace_period_ends_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                        
                        {sub.canceled_at && (
                          <>
                            <div className="text-slate-500">Cancelado em:</div>
                            <div className="text-slate-900">{new Date(sub.canceled_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                      </div>
                      {sub.suspension_reason && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                          <strong>Motivo da suspensão:</strong> {sub.suspension_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <p>Nenhuma assinatura registrada no Stripe.</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-100 p-4 flex justify-end bg-slate-50/70">
              <button
                onClick={() => setStripeInfoModalOpen(null)}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm shadow-xs transition-colors"
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
