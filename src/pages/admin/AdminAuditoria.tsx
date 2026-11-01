import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ScrollText, ChevronLeft, ChevronRight,
  LogIn, LogOut, Building2, UserCog, CreditCard, Shield, Edit, Trash2
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import { AdminTableSkeleton } from './components/AdminSkeleton';

interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogOut,
  tenant_created: Building2,
  tenant_edited: Edit,
  tenant_deleted: Trash2,
  tenant_status_changed: Shield,
  plan_changed: CreditCard,
  user_created: UserCog,
  user_role_changed: Shield,
  default: ScrollText,
};

const ACTION_COLORS: Record<string, string> = {
  login: 'text-emerald-600',
  logout: 'text-slate-400',
  tenant_created: 'text-blue-600',
  tenant_edited: 'text-amber-600',
  tenant_deleted: 'text-red-600',
  tenant_status_changed: 'text-orange-600',
  plan_changed: 'text-indigo-600',
  user_created: 'text-blue-600',
  user_role_changed: 'text-indigo-600',
  default: 'text-slate-400',
};

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  tenant_created: 'Empresa Criada',
  tenant_edited: 'Empresa Editada',
  tenant_deleted: 'Empresa Excluída',
  tenant_status_changed: 'Status Alterado',
  plan_changed: 'Plano Alterado',
  user_created: 'Usuário Criado',
  user_role_changed: 'Role Alterada',
};

const PAGE_SIZE = 30;

export default function AdminAuditoria() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin_audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        console.warn('Audit log not available:', error.message);
        return [];
      }
      return (data ?? []) as AuditEntry[];
    }
  });

  const uniqueActions = [...new Set(entries.map(e => e.action))];

  const filtered = entries.filter(e => {
    const matchSearch = (e.actor_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      (e.target_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || e.action === actionFilter;
    return matchSearch && matchAction;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Auditoria"
        subtitle={`${entries.length} registro${entries.length !== 1 ? 's' : ''}`}
        icon={<ScrollText className="w-5 h-5" />}
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar ação, usuário ou alvo..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 shadow-xs transition-colors"
          />
        </div>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 shadow-xs"
        >
          <option value="all">Todas as ações</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <div className="col-span-3">Ação</div>
          <div className="col-span-2 hidden md:block">Usuário</div>
          <div className="col-span-3 hidden lg:block">Alvo</div>
          <div className="col-span-2 hidden lg:block">IP</div>
          <div className="col-span-4 md:col-span-2 lg:col-span-2 text-right">Data / Hora</div>
        </div>

        {isLoading ? (
          <AdminTableSkeleton rows={8} />
        ) : paginated.length === 0 ? (
          <AdminEmptyState
            title={entries.length === 0 ? 'Nenhum registro de auditoria' : 'Nenhum registro encontrado'}
            description={entries.length === 0
              ? 'Execute a migration 0013_audit_log.sql no seu Supabase para ativar o sistema de auditoria.'
              : 'Ajuste os filtros.'}
            icon={<ScrollText className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {paginated.map((entry, i) => {
              const Icon = ACTION_ICONS[entry.action] ?? ACTION_ICONS.default;
              const color = ACTION_COLORS[entry.action] ?? ACTION_COLORS.default;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="col-span-3 flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </div>
                  <div className="col-span-2 hidden md:block">
                    <p className="text-xs text-slate-600 truncate">{entry.actor_name ?? '—'}</p>
                  </div>
                  <div className="col-span-3 hidden lg:block">
                    {entry.target_name && (
                      <p className="text-xs text-slate-500 truncate">{entry.target_name}</p>
                    )}
                  </div>
                  <div className="col-span-2 hidden lg:block">
                    <p className="text-xs text-slate-400 font-mono">{entry.ip_address ?? '—'}</p>
                  </div>
                  <div className="col-span-4 md:col-span-2 lg:col-span-2 text-right">
                    <p className="text-[10px] text-slate-400">{fmtDate(entry.created_at)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-500">Página {page + 1} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
