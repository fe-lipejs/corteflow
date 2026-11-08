import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../integrations/supabase/client';
import { getTenantPublicUrl } from '../../lib/tenantUrl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ExternalLink, MoreVertical, CheckCircle,
  ShieldAlert, Ban, PlayCircle, Building2, ChevronLeft, ChevronRight,
  ArrowUpDown, Trash2, RotateCcw, Sliders, Loader2, Sparkles, X, Save, DollarSign, BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  const navigate = useNavigate();
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
  
  // Customização de Limites & Recursos do Salão
  const [contractModalTenant, setContractModalTenant] = useState<Tenant | null>(null);
  const [contractSubId, setContractSubId] = useState<string | null>(null);
  const [contractPlanId, setContractPlanId] = useState<string | null>(null);
  const [contractPlanName, setContractPlanName] = useState<string>('');
  const [contractMaxPros, setContractMaxPros] = useState<number>(1);
  const [contractMaxServices, setContractMaxServices] = useState<number>(3);
  const [contractMaxProducts, setContractMaxProducts] = useState<number>(0);
  const [contractAllowFinanceiro, setContractAllowFinanceiro] = useState<boolean>(false);
  const [contractAllowProdutos, setContractAllowProdutos] = useState<boolean>(false);
  const [contractAllowRelatorios, setContractAllowRelatorios] = useState<boolean>(false);
  const [contractAllowAllPermissions, setContractAllowAllPermissions] = useState<boolean>(false);
  const [contractCustomPrice, setContractCustomPrice] = useState<string>('');
  const [isSavingContract, setIsSavingContract] = useState<boolean>(false);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);

  const queryClient = useQueryClient();

  async function handleOpenContractModal(tenant: Tenant) {
    setContractModalTenant(tenant);
    setIsLoadingContract(true);
    try {
      const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('id, plan_id, status, plans(*), subscription_contracts(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!sub) {
        toast.error('Nenhuma assinatura encontrada para este salão.');
        setContractModalTenant(null);
        return;
      }

      setContractSubId(sub.id);
      setContractPlanId(sub.plan_id);
      const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
      const contract = Array.isArray(sub.subscription_contracts) ? sub.subscription_contracts[0] : sub.subscription_contracts;

      setContractPlanName(plan?.name || 'Plano Padrão');

      if (contract) {
        setContractMaxPros(contract.max_professionals ?? plan?.max_professionals ?? 1);
        setContractMaxServices(contract.limits?.servicos ?? plan?.limits?.servicos ?? 3);
        setContractMaxProducts(contract.limits?.produtos ?? plan?.limits?.produtos ?? 0);
        setContractAllowFinanceiro(contract.features?.financeiro ?? plan?.features?.financeiro ?? false);
        setContractAllowProdutos(contract.allow_products ?? contract.features?.produtos ?? plan?.allow_products ?? false);
        setContractAllowRelatorios(contract.features?.relatorios ?? plan?.features?.relatorios ?? false);
        setContractAllowAllPermissions((contract.permissions || []).includes('*'));
      } else {
        setContractMaxPros(plan?.max_professionals ?? 1);
        setContractMaxServices(plan?.limits?.servicos ?? 3);
        setContractMaxProducts(plan?.limits?.produtos ?? 0);
        setContractAllowFinanceiro(plan?.features?.financeiro ?? false);
        setContractAllowProdutos(plan?.allow_products ?? plan?.features?.produtos ?? false);
        setContractAllowRelatorios(plan?.features?.relatorios ?? false);
        setContractAllowAllPermissions((plan?.permissions || []).includes('*'));
      }

      // Buscar preço promocional personalizado na tabela custom_pricing
      const { data: cpData } = await supabase
        .from('custom_pricing')
        .select('amount_override')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (cpData && cpData.amount_override != null) {
        setContractCustomPrice(String(cpData.amount_override));
      } else {
        setContractCustomPrice('');
      }
    } catch (err: any) {
      console.error('Erro ao carregar contrato:', err);
      toast.error('Erro ao carregar permissões do salão: ' + (err.message || ''));
      setContractModalTenant(null);
    } finally {
      setIsLoadingContract(false);
    }
  }

  async function handleSaveContract() {
    if (!contractSubId || !contractPlanId || !contractModalTenant) return;
    try {
      setIsSavingContract(true);
      const { error } = await supabase
        .from('subscription_contracts')
        .upsert({
          subscription_id: contractSubId,
          plan_id: contractPlanId,
          max_professionals: Number(contractMaxPros),
          allow_products: contractAllowProdutos,
          features: {
            agenda: true,
            servicos: true,
            clientes: true,
            equipe: true,
            financeiro: contractAllowFinanceiro,
            produtos: contractAllowProdutos,
            relatorios: contractAllowRelatorios,
          },
          limits: {
            profissionais: Number(contractMaxPros),
            servicos: Number(contractMaxServices),
            produtos: Number(contractMaxProducts),
          },
          permissions: contractAllowAllPermissions ? ['*'] : [
            'agenda.visualizar_todos', 'agenda.criar', 'agenda.editar', 'agenda.cancelar', 'agenda.mudar_status', 'agenda.bloquear_horario',
            'equipe.visualizar', 'equipe.criar', 'equipe.editar_perfil', 'equipe.editar_horarios',
            'catalogo.visualizar', 'catalogo.criar', 'catalogo.editar', 'catalogo.excluir',
            'clientes.visualizar', 'clientes.exportar',
            ...(contractAllowFinanceiro ? ['financeiro.visualizar_caixa_geral', 'financeiro.visualizar_meu_caixa', 'financeiro.criar_lancamento', 'financeiro.editar_lancamento', 'financeiro.excluir_lancamento', 'financeiro.exportar'] : []),
            ...(contractAllowProdutos ? ['produtos.visualizar', 'produtos.criar', 'produtos.editar', 'produtos.excluir', 'produto.criar', 'produto.editar', 'produto.excluir'] : []),
            'configuracoes.editar_layout'
          ],
          status: 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'subscription_id' });

      if (error) throw error;

      // Salvar ou remover preço promocional personalizado na tabela custom_pricing
      if (contractCustomPrice && Number(contractCustomPrice) > 0) {
        const { data: existingCp } = await supabase
          .from('custom_pricing')
          .select('id')
          .eq('tenant_id', contractModalTenant.id)
          .maybeSingle();

        if (existingCp) {
          await supabase.from('custom_pricing').update({
            amount_override: Number(contractCustomPrice),
            plan_id: contractPlanId,
            note: 'Preço promocional personalizado',
          }).eq('id', existingCp.id);
        } else {
          await supabase.from('custom_pricing').insert({
            tenant_id: contractModalTenant.id,
            plan_id: contractPlanId,
            amount_override: Number(contractCustomPrice),
            note: 'Preço promocional personalizado',
          });
        }
      } else if (contractCustomPrice === '') {
        await supabase.from('custom_pricing').delete().eq('tenant_id', contractModalTenant.id);
      }

      toast.success('Permissões, limites e preço promocional salvos para ' + contractModalTenant?.name + '!');
      setContractModalTenant(null);
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
    } catch (err: any) {
      console.error('Erro ao salvar contrato:', err);
      toast.error('Erro ao salvar alterações: ' + (err.message || ''));
    } finally {
      setIsSavingContract(false);
    }
  }

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar empresa ou slug..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-sm"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}
          className="px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-zinc-200 outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
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
          className="px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-zinc-200 outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
        >
          <option value="all">Todos os tipos</option>
          <option value="barbearia">Barbearia</option>
          <option value="salao">Salão</option>
          <option value="esmalteria">Esmalteria</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-visible shadow-xl">
        {/* Table header */}
        <div className="border-b border-white/5 bg-white/[0.02] px-5 py-3 grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <div className="col-span-6 md:col-span-4 lg:col-span-3">
            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer">
              Empresa <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-1 hidden lg:block">Tipo</div>
          <div className="col-span-3 lg:col-span-2 hidden md:block">
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer">
              Status <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-2 hidden lg:block">Plano</div>
          <div className="col-span-2 hidden lg:block">
            <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer">
              Cadastro <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
          <div className="col-span-6 md:col-span-5 lg:col-span-2 text-right">Ações</div>
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
          <div className="divide-y divide-white/5">
            {paginated.map((tenant, i) => {
              const activeSub = tenant.subscriptions?.find(s => s.status === 'active' || s.status === 'trial');
              const settings = tenant.tenant_settings;

              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`group grid grid-cols-12 gap-3 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors relative ${openMenuId === tenant.id ? 'z-40' : 'z-0'} ${tenant.deleted_at ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
                >
                  {/* Name + slug */}
                  <div className="col-span-6 md:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-emerald-400">{tenant.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${tenant.deleted_at ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{tenant.name}</p>
                      <p className="text-xs text-zinc-400 truncate">/{tenant.slug}{settings?.city ? ` · ${settings.city}` : ''}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-1 hidden lg:block text-xs text-zinc-400 truncate">
                    {businessTypeLabel[tenant.business_type] ?? tenant.business_type}
                  </div>

                  {/* Status */}
                  <div className="col-span-3 lg:col-span-2 hidden md:block">
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
                              {daysLeftText && <span className="text-[10px] text-amber-400 font-semibold">{daysLeftText}</span>}
                            </div>
                          );
                        }
                        
                        if (stripeStatus === 'canceled') {
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <AdminBadge value="canceled" dot />
                              {latestSub.canceled_at && <span className="text-[10px] text-zinc-500 font-semibold">{new Date(latestSub.canceled_at).toLocaleDateString('pt-BR')}</span>}
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
                  <div className="col-span-2 hidden lg:block text-xs text-zinc-400 truncate">
                    {activeSub?.plans?.name ?? '—'}
                  </div>

                  {/* Date */}
                  <div className="col-span-2 hidden lg:block text-xs text-zinc-500">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Actions */}
                  <div className="col-span-6 md:col-span-5 lg:col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/platform/tenants/${tenant.id}/analytics`)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:text-emerald-400 bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all cursor-pointer shadow-xs"
                      title="Abrir Raffros Analytics deste estabelecimento"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">Ver métricas</span>
                    </button>
                    <button
                      onClick={() => handleOpenContractModal(tenant)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all cursor-pointer shadow-xs"
                      title="Editar Limites, Telas e Preço Promocional"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Limites</span>
                    </button>
                    {!tenant.deleted_at && (
                      <button
                        onClick={() => window.open(getTenantPublicUrl(tenant.slug), '_blank')}
                        className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Ver página pública"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === tenant.id && (
                        <div className="absolute right-0 top-8 w-48 bg-[#0E0E14] border border-white/10 rounded-xl shadow-2xl z-[999] overflow-hidden py-1 divide-y divide-white/5">
                          {tenant.deleted_at ? (
                            <button
                              onClick={() => restoreTenant.mutate(tenant.id)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Empresa
                            </button>
                          ) : (
                            <div>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'active' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Ativar
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'trial' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-amber-400 transition-colors font-medium cursor-pointer"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-amber-400" /> Colocar em Trial
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'suspended' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-orange-400 transition-colors font-medium cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> Suspender
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: tenant.id, status: 'blocked' })}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-rose-400 transition-colors font-medium cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-400" /> Bloquear
                              </button>
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => {
                                navigate(`/platform/tenants/${tenant.id}/analytics`);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors font-semibold cursor-pointer"
                            >
                              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Ver métricas
                            </button>
                            <button
                              onClick={() => {
                                handleOpenContractModal(tenant);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Limites & Recursos
                            </button>
                            <button
                              onClick={() => {
                                setStripeInfoModalOpen(tenant);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" /> Detalhes Stripe
                            </button>
                            {!tenant.deleted_at && (
                              <button
                                onClick={() => {
                                  setDeleteModalOpen(tenant);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Apagar Empresa
                              </button>
                            )}
                          </div>
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
          <div className="border-t border-white/5 px-5 py-3 flex items-center justify-between bg-white/[0.01]">
            <p className="text-xs text-zinc-500">
              {filtered.length} empresa{filtered.length !== 1 ? 's' : ''}
              {' · '}Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0E0E14] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-zinc-100">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-400 mb-2">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="font-bold text-lg text-white">Apagar Empresa</h3>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Esta ação é <strong className="text-white">irreversível</strong>. Todos os dados da empresa 
                <strong className="text-white"> {deleteModalOpen.name}</strong>, incluindo clientes, agendamentos, financeiros e profissionais serão apagados permanentemente.
              </p>
              
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Para confirmar, digite: <span className="text-white select-none font-bold font-mono">{deleteModalOpen.slug}</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModalOpen.slug}
                  className="w-full px-4 py-2.5 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  onPaste={e => e.preventDefault()}
                />
              </div>
            </div>
            
            <div className="border-t border-white/10 p-4 flex justify-end gap-3 bg-black/20">
              <button
                onClick={() => {
                  setDeleteModalOpen(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors font-medium cursor-pointer"
                disabled={deleteTenant.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTenant.mutate(deleteModalOpen)}
                disabled={deleteConfirmText !== deleteModalOpen.slug || deleteTenant.isPending}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-600/20 cursor-pointer active:scale-95"
              >
                {deleteTenant.isPending ? 'Apagando...' : 'Apagar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Info Modal */}
      {stripeInfoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0E0E14] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-zinc-100">
            <div className="p-6 border-b border-white/10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Detalhes do Stripe</h3>
              <p className="text-sm text-zinc-400 mt-1">Informações de assinatura para {stripeInfoModalOpen.name}</p>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {stripeInfoModalOpen.subscriptions && stripeInfoModalOpen.subscriptions.length > 0 ? (
                <>
                  {stripeInfoModalOpen.subscriptions.map((sub, idx) => (
                    <div key={idx} className="bg-white/[0.02] p-4 rounded-xl border border-white/10 text-sm">
                      <div className="grid grid-cols-2 gap-y-3">
                        <div className="text-zinc-400">Status:</div>
                        <div className="text-white font-semibold capitalize">{sub.status}</div>
                        
                        <div className="text-zinc-400">Plano:</div>
                        <div className="text-white font-medium">{sub.plans?.name || 'Desconhecido'}</div>
                        
                        <div className="text-zinc-400">Customer ID:</div>
                        <div className="text-zinc-300 font-mono text-xs">{sub.stripe_customer_id || '—'}</div>
                        
                        <div className="text-zinc-400">Subscription ID:</div>
                        <div className="text-zinc-300 font-mono text-xs">{sub.stripe_subscription_id || '—'}</div>
                        
                        {sub.current_period_end && (
                          <>
                            <div className="text-zinc-400">Período expira:</div>
                            <div className="text-white">{new Date(sub.current_period_end).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}

                        {sub.grace_period_ends_at && (
                          <>
                            <div className="text-rose-400 font-medium">Carência até:</div>
                            <div className="text-rose-400 font-bold">{new Date(sub.grace_period_ends_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                        
                        {sub.canceled_at && (
                          <>
                            <div className="text-zinc-400">Cancelado em:</div>
                            <div className="text-white">{new Date(sub.canceled_at).toLocaleDateString('pt-BR')}</div>
                          </>
                        )}
                      </div>
                      {sub.suspension_reason && (
                        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs">
                          <strong>Motivo da suspensão:</strong> {sub.suspension_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-6 text-zinc-500">
                  <p>Nenhuma assinatura registrada no Stripe.</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-white/10 p-4 flex justify-end bg-black/20">
              <button
                onClick={() => setStripeInfoModalOpen(null)}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract & Permissions Customization Modal */}
      {contractModalTenant && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0E0E14] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-zinc-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#13131A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Limites &amp; Recursos Personalizados</h3>
                  <p className="text-xs text-zinc-400">{contractModalTenant.name} ({contractPlanName})</p>
                </div>
              </div>
              <button
                onClick={() => setContractModalTenant(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingContract ? (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                <p className="text-sm">Carregando permissões do salão...</p>
              </div>
            ) : (
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
                  💡 Os limites e módulos configurados aqui sobrescrevem as restrições padrão do plano <strong>exclusivamente para este salão</strong>, sem alterar os outros clientes.
                </div>

                {/* Limites Operacionais */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Limites de Uso</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Máx. Serviços
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={contractMaxServices}
                        onChange={e => setContractMaxServices(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-zinc-500">Padrão Solo: 3</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Máx. Profissionais
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={contractMaxPros}
                        onChange={e => setContractMaxPros(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-zinc-500">Padrão Solo: 1</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Máx. Produtos
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={contractMaxProducts}
                        onChange={e => setContractMaxProducts(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-zinc-500">0 se desativado</span>
                    </div>
                  </div>
                </div>

                {/* Módulos do Sistema */}
                <div className="border-t border-white/5 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Módulos Desbloqueados</h4>
                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">Módulo Financeiro Completo</p>
                        <p className="text-xs text-zinc-400">Fluxo de caixa, entradas, saídas e controle de lançamentos</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={contractAllowFinanceiro}
                        onChange={e => setContractAllowFinanceiro(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">Módulo de Produtos &amp; Estoque</p>
                        <p className="text-xs text-zinc-400">Permite cadastrar e controlar estoque de cosméticos/produtos</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={contractAllowProdutos}
                        onChange={e => {
                          const val = e.target.checked;
                          setContractAllowProdutos(val);
                          if (val && contractMaxProducts === 0) setContractMaxProducts(10);
                        }}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">Relatórios &amp; Exportações</p>
                        <p className="text-xs text-zinc-400">Exportação de dados para Excel e gráficos avançados</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={contractAllowRelatorios}
                        onChange={e => setContractAllowRelatorios(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/30 rounded-xl cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-bold text-emerald-300">Liberar Todas as Permissões (*)</p>
                        <p className="text-xs text-emerald-400/80">Acesso irrestrito a todos os recursos da plataforma</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={contractAllowAllPermissions}
                        onChange={e => {
                          const val = e.target.checked;
                          setContractAllowAllPermissions(val);
                          if (val) {
                            setContractAllowFinanceiro(true);
                            setContractAllowProdutos(true);
                            setContractAllowRelatorios(true);
                          }
                        }}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Preço Promocional / Desconto */}
                <div className="border-t border-white/5 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Preço Promocional da Mensalidade (R$)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mb-2.5">
                    Defina um valor personalizado de mensalidade para este salão (ex: 17.90). O sistema aplicará esse desconto no checkout e na renovação mensal.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 17.90 (vazio = preço padrão)"
                        value={contractCustomPrice}
                        onChange={e => setContractCustomPrice(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    {contractCustomPrice && Number(contractCustomPrice) > 0 ? (
                      <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                        Promoção R$ {Number(contractCustomPrice).toFixed(2).replace('.', ',')}/mês
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        Preço padrão do plano
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-white/10 p-4 flex justify-end gap-3 bg-[#13131A]">
              <button
                onClick={() => setContractModalTenant(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
                disabled={isSavingContract}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveContract}
                disabled={isSavingContract || isLoadingContract}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
              >
                {isSavingContract ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Ajustes do Salão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
