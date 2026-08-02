import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Users, Shield, MoreVertical,
  CheckCircle, Ban, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown
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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_id, avatar_url');
      if (error) throw error;

      const profileList = profiles ?? [];

      // Get tenant names
      const tenantIds = [...new Set(profileList.map(p => p.tenant_id).filter(Boolean))];
      let tenantMap: Record<string, string> = {};

      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds as string[]);
        (tenants ?? []).forEach((t: any) => { tenantMap[t.id] = t.name; });
      }

      return profileList.map(p => ({
        ...p,
        tenant_name: p.tenant_id ? tenantMap[p.tenant_id] : undefined,
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
    }
  });

  // Filter + paginate
  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.tenant_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const roleColors: Record<string, string> = {
    super_admin: 'violet',
    admin: 'blue',
    manager: 'blue',
    professional: 'neutral',
    client: 'neutral',
    owner: 'blue',
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            placeholder="Buscar usuário ou empresa..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#444] outline-none focus:border-[#333] transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value as UserRole | 'all'); setPage(0); }}
          className="px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-[#888] outline-none focus:border-[#333]"
        >
          <option value="all">Todos os papéis</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#111] text-[10px] font-bold uppercase tracking-widest text-[#333]">
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
          <div className="divide-y divide-[#0d0d0d]">
            {paginated.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="group grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-[#0f0f0f] transition-colors relative"
              >
                {/* Name */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[#111] border border-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-[#555]">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                    <p className="text-xs text-[#333] font-mono truncate">{user.id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Tenant */}
                <div className="col-span-3 hidden md:block">
                  <p className="text-xs text-[#555] truncate">
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
                      className="px-2 py-1 bg-[#111] border border-[#333] rounded text-xs text-white outline-none"
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
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                      className="p-1.5 text-[#333] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {openMenuId === user.id && (
                      <div className="absolute right-0 top-8 w-44 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl shadow-2xl z-50 overflow-hidden">
                        <button
                          onClick={() => { setEditingRole(user.id); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-blue-400 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" /> Alterar Role
                        </button>
                        <button
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-amber-400 transition-colors"
                          onClick={() => { setOpenMenuId(null); }}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Resetar Senha
                        </button>
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
          <div className="border-t border-[#111] px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-[#444]">
              {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
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
