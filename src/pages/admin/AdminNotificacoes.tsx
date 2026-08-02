import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Bell, CheckCheck, AlertCircle, Clock,
  UserPlus, DollarSign, Ban, Zap, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import AdminPageHeader from './components/AdminPageHeader';
import AdminEmptyState from './components/AdminEmptyState';
import { AdminTableSkeleton } from './components/AdminSkeleton';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  tenant_name: string | null;
  read: boolean;
  priority: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  new_signup: UserPlus,
  trial_expiring: Clock,
  payment_failed: AlertCircle,
  payment_confirmed: DollarSign,
  tenant_blocked: Ban,
  system_error: AlertCircle,
  default: Bell,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-[#888]',
  low: 'text-[#444]',
};

const PAGE_SIZE = 25;

export default function AdminNotificacoes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showUnread, setShowUnread] = useState(false);
  const [page, setPage] = useState(0);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Notification[];
    }
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read: true } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_notifications'] })
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read: true } as any)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_notifications'] })
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = notifications.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.body ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (n.tenant_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchUnread = !showUnread || !n.read;
    return matchSearch && matchUnread;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Agora';
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}` : 'Todas as notificações lidas'}
        icon={<Bell className="w-5 h-5" />}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] text-sm text-[#888] hover:text-white hover:border-[#333] rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como lidas
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
          <input
            type="text"
            placeholder="Buscar notificação..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-sm text-white placeholder-[#444] outline-none focus:border-[#333]"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => { setShowUnread(!showUnread); setPage(0); }}
            className={`w-9 h-5 rounded-full transition-colors relative ${showUnread ? 'bg-violet-600' : 'bg-[#1a1a1a]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showUnread ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-[#666]">Apenas não lidas</span>
        </label>
      </div>

      {/* List */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
        {isLoading ? (
          <AdminTableSkeleton rows={6} />
        ) : paginated.length === 0 ? (
          <AdminEmptyState
            title={notifications.length === 0 ? 'Nenhuma notificação ainda' : 'Nenhuma notificação encontrada'}
            description={notifications.length === 0
              ? 'Quando eventos importantes ocorrerem na plataforma, eles aparecerão aqui.'
              : 'Ajuste os filtros para ver mais resultados.'}
            icon={<Bell className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y divide-[#0d0d0d]">
            {paginated.map((notif, i) => {
              const Icon = TYPE_ICONS[notif.type] ?? TYPE_ICONS.default;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => !notif.read && markRead.mutate(notif.id)}
                  className={`flex items-start gap-4 px-5 py-4 hover:bg-[#0f0f0f] transition-colors cursor-pointer ${!notif.read ? 'bg-[#0d0d0d]' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${PRIORITY_COLORS[notif.priority]}`} style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${notif.read ? 'text-[#888]' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-[#333] flex-shrink-0">{fmtDate(notif.created_at)}</span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-[#444] mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    {notif.tenant_name && (
                      <p className="text-[10px] text-[#333] mt-1">{notif.tenant_name}</p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[#111] px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-[#444]">Página {page + 1} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] disabled:opacity-30 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
