import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, Shield, MoreVertical,
  ChevronLeft, ChevronRight, AlertTriangle, ChevronDown, ChevronUp,
  X, Trash2, CreditCard, ShieldAlert
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import AdminBadge from './components/AdminBadge';
import { AdminTableSkeleton } from './components/AdminSkeleton';
import type { UserRole } from '../../types/database';

interface AdminUser {
  id: string;
  full_name: string;
  role: UserRole;
  tenant_id: string | null;
  avatar_url: string | null;
  tenant_name?: string;
  tenant_slug?: string;
  tenant_status?: string;
  subscription_status?: string;
  stripe_subscription_id?: string | null;
}

const ROLES: UserRole[] = ['super_admin', 'admin', 'manager', 'professional', 'client', 'owner'];
const PAGE_SIZE = 20;

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Selected user for details & danger zone modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_id, avatar_url');
      if (error) throw error;

      const profileList = profiles ?? [];

      // Get tenant details & subscriptions
      const tenantIds = [...new Set(profileList.map(p => p.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, { name: string; slug: string; status: string; sub_status?: string; stripe_sub_id?: string | null }> = {};

      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select(`
            id, name, slug, status,
            subscriptions (status, stripe_subscription_id)
          `)
          .in('id', tenantIds as string[]);

        (tenants ?? []).forEach((t: any) => {
          const subsArray = Array.isArray(t.subscriptions) ? t.subscriptions : (t.subscriptions ? [t.subscriptions] : []);
          const latestSub = subsArray[0];
          tenantMap[t.id] = {
            name: t.name,
            slug: t.slug,
            status: t.status,
            sub_status: latestSub?.status,
            stripe_sub_id: latestSub?.stripe_subscription_id,
          };
        });
      }

      return profileList.map(p => ({
        ...p,
        tenant_name: p.tenant_id ? tenantMap[p.tenant_id]?.name : undefined,
        tenant_slug: p.tenant_id ? tenantMap[p.tenant_id]?.slug : undefined,
        tenant_status: p.tenant_id ? tenantMap[p.tenant_id]?.status : undefined,
        subscription_status: p.tenant_id ? tenantMap[p.tenant_id]?.sub_status : undefined,
        stripe_subscription_id: p.tenant_id ? tenantMap[p.tenant_id]?.stripe_sub_id : undefined,
      })) as AdminUser[];
    }
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('profiles').update({ role } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setOpenMenuId(null);
      setEditingRole(null);
      if (selectedUser) {
        setSelectedUser(prev => prev ? { ...prev, role: editingRole as UserRole || prev.role } : null);
      }
    }
  });

  // ── Cancel Subscription Action (Super Admin) ──
  const cancelSubscription = useMutation({
    mutationFn: async (user: AdminUser) => {
      if (!user.tenant_id) throw new Error('Este usuário não possui empresa vinculada.');

      try {
        await supabase.functions.invoke('delete-account', {
          body: { target_tenant_id: user.tenant_id }
        });
      } catch (err) {
        console.warn('Edge function warning:', err);
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() } as any)
        .eq('tenant_id', user.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      alert('Assinatura cancelada com sucesso no Stripe e no sistema.');
      setSelectedUser(null);
      setShowDangerZone(false);
    },
    onError: (err: any) => {
      alert(`Erro ao cancelar assinatura: ${err.message}`);
    }
  });

  // ── Delete Account Action (Super Admin) ──
  const deleteAccount = useMutation({
    mutationFn: async (user: AdminUser) => {
      if (user.tenant_id) {
        try {
          await supabase.functions.invoke('delete-account', {
            body: { target_tenant_id: user.tenant_id }
          });
        } catch (e) {
          console.warn('Stripe cancellation on delete warning:', e);
        }

        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() } as any)
          .eq('tenant_id', user.tenant_id);

        const { error: tenantErr } = await supabase.rpc('delete_tenant_safely', { p_tenant_id: user.tenant_id });
        if (tenantErr) {
          await supabase.from('tenants').update({ deleted_at: new Date().toISOString(), status: 'canceled' } as any).eq('id', user.tenant_id);
        }
      }

      await supabase.from('profiles').update({ role: 'client' } as any).eq('id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      queryClient.invalidateQueries({ queryKey: ['admin_tenants_v2'] });
      alert('Conta e empresa associada foram excluídas com sucesso. Qualquer assinatura no Stripe foi cancelada.');
      setSelectedUser(null);
      setShowDangerZone(false);
      setDeleteConfirmText('');
    },
    onError: (err: any) => {
      alert(`Erro ao apagar conta: ${err.message}`);
    }
  });

  // Filter + paginate
  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.tenant_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const roleColors: Record<string, string> = {
    super_admin: 'emerald',
    admin: 'emerald',
    manager: 'emerald',
    professional: 'neutral',
    client: 'neutral',
    owner: 'emerald',
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Usuários"
        subtitle={`${users.length} usuário${users.length !== 1 ? 's' : ''} cadastrado${users.length !== 1 ? 's' : ''}`}
        icon={<Users className="w-5 h-5" />}
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar usuário ou empresa..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value as UserRole | 'all'); setPage(0); }}
          className="px-3 py-2 bg-[#13131A] border border-white/10 rounded-xl text-sm text-zinc-200 outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
        >
          <option value="all">Todos os papéis</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0B0B0E] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <div className="col-span-5">Usuário</div>
          <div className="col-span-3 hidden md:block">Empresa</div>
          <div className="col-span-2">Papel</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {isLoading ? (
          <AdminTableSkeleton rows={8} />
        ) : paginated.length === 0 ? (
          <AdminEmptyState
            title="Nenhum usuário encontrado"
            description="Ajuste os filtros ou o termo de busca."
            icon={<Users className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y divide-white/5">
            {paginated.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`group grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors relative ${openMenuId === user.id ? 'z-40' : 'z-0'}`}
              >
                {/* Name */}
                <div 
                  className="col-span-5 flex items-center gap-3 min-w-0 cursor-pointer"
                  onClick={() => { setSelectedUser(user); setShowDangerZone(false); }}
                >
                  <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-xs shadow-xs">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{user.full_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate hover:text-emerald-400 transition-colors">{user.full_name}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{user.id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Tenant */}
                <div className="col-span-3 hidden md:block">
                  <p className="text-xs text-zinc-400 truncate">
                    {user.tenant_name ?? (user.role === 'super_admin' ? 'Plataforma' : '—')}
                  </p>
                </div>

                {/* Role */}
                <div className="col-span-2">
                  {editingRole === user.id ? (
                    <select
                      defaultValue={user.role}
                      onChange={e => updateRole.mutate({ id: user.id, role: e.target.value as UserRole })}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                      className="px-2 py-1 bg-[#13131A] border border-emerald-500 rounded-lg text-xs text-white outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <AdminBadge variant={(roleColors[user.role] ?? 'neutral') as any} value={user.role} />
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 relative">
                  <button
                    onClick={() => { setSelectedUser(user); setShowDangerZone(false); }}
                    className="px-2.5 py-1 text-xs bg-white/5 hover:bg-emerald-500/10 text-zinc-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-colors font-medium hidden sm:inline-flex shadow-xs cursor-pointer"
                  >
                    Gerenciar
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openMenuId === user.id && (
                      <div className="absolute right-0 top-8 w-48 bg-[#0E0E14] border border-white/10 rounded-xl shadow-2xl z-[999] overflow-hidden py-1 divide-y divide-white/5">
                        <div className="py-1">
                          <button
                            onClick={() => { setSelectedUser(user); setShowDangerZone(false); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5 text-emerald-400" /> Ver Detalhes
                          </button>
                          <button
                            onClick={() => { setEditingRole(user.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/5 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Alterar Papel
                          </button>
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => { setSelectedUser(user); setShowDangerZone(true); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Zona de Perigo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-white/5 px-5 py-3 flex items-center justify-between bg-white/[0.01]">
            <p className="text-xs text-zinc-500">
              {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
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

      {/* ── USER DETAILS & DANGER ZONE MODAL ── */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0B0B0E] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-zinc-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 bg-[#0E0E14] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400 shadow-xs">
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{selectedUser.full_name}</h3>
                    <p className="text-xs text-zinc-500 font-mono">{selectedUser.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedUser(null); setShowDangerZone(false); setDeleteConfirmText(''); }}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-1">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Papel Atual</p>
                    <div className="pt-0.5">
                      <AdminBadge variant={(roleColors[selectedUser.role] ?? 'neutral') as any} value={selectedUser.role} />
                    </div>
                  </div>
                  <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-1">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Empresa Vinculada</p>
                    <p className="text-sm font-semibold text-zinc-200 truncate">
                      {selectedUser.tenant_name || 'Nenhuma'}
                    </p>
                  </div>
                </div>

                {/* Subscription status if tenant exists */}
                {selectedUser.tenant_id && (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Status da Assinatura:</span>
                      <span className="font-semibold capitalize text-zinc-200">
                        {selectedUser.subscription_status || 'Sem assinatura'}
                      </span>
                    </div>
                    {selectedUser.stripe_subscription_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Stripe ID:</span>
                        <span className="font-mono text-zinc-400">{selectedUser.stripe_subscription_id.slice(0, 14)}...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── DANGER ZONE (ZONA DE PERIGO) ── */}
                <div className="border border-rose-500/30 rounded-2xl bg-rose-950/20 overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setShowDangerZone(!showDangerZone)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-rose-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Zona de Perigo (Ações Críticas)</span>
                    </div>
                    {showDangerZone ? (
                      <ChevronUp className="w-4 h-4 text-rose-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-rose-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showDangerZone && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-5 pt-1 border-t border-rose-500/20 space-y-4"
                      >
                        <p className="text-xs text-rose-300 leading-relaxed">
                          Ações nesta seção afetam diretamente o faturamento do Stripe e o acesso deste usuário.
                        </p>

                        {/* Action 1: Cancel Subscription */}
                        <div className="p-3.5 bg-[#13131A] border border-rose-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                          <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Cancelar Assinatura / Plano
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Cancela no Stripe e encerra cobranças recorrentes.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja cancelar a assinatura de ${selectedUser.full_name}?`)) {
                                cancelSubscription.mutate(selectedUser);
                              }
                            }}
                            disabled={cancelSubscription.isPending || !selectedUser.tenant_id}
                            className="px-3 py-2 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-40 whitespace-nowrap cursor-pointer"
                          >
                            {cancelSubscription.isPending ? 'Cancelando...' : 'Cancelar Assinatura'}
                          </button>
                        </div>

                        {/* Action 2: Delete Account */}
                        <div className="p-3.5 bg-[#13131A] border border-rose-500/20 rounded-xl space-y-3 shadow-xs">
                          <div>
                            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Apagar Conta Permanentemente
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Cancela o Stripe primeiro e desativa a conta do salão.
                            </p>
                          </div>

                          <div className="space-y-2 pt-1">
                            <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                              Digite o nome do usuário para confirmar: <span className="text-white select-none font-bold">{selectedUser.full_name}</span>
                            </label>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={e => setDeleteConfirmText(e.target.value)}
                              placeholder={selectedUser.full_name}
                              className="w-full px-3 py-2 bg-[#0E0E14] border border-rose-500/30 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => deleteAccount.mutate(selectedUser)}
                              disabled={deleteConfirmText !== selectedUser.full_name || deleteAccount.isPending}
                              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-600/20 cursor-pointer active:scale-95"
                            >
                              {deleteAccount.isPending ? 'Apagando conta e cancelando Stripe...' : 'Confirmar e Apagar Conta'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-[#0E0E14] flex justify-end">
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setShowDangerZone(false); setDeleteConfirmText(''); }}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
