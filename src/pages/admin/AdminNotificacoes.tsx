import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Bell, CheckCheck, AlertCircle, Clock,
  UserPlus, DollarSign, Ban, Zap, ChevronLeft, ChevronRight, MessageCircle
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
  new_ticket: MessageCircle,
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
  const navigate = useNavigate();
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

  const handleNotifClick = (notif: Notification) => {
    if (!notif.read) markRead.mutate(notif.id);
    if (notif.type === 'new_ticket') {
      navigate('/platform/suporte');
    }
  };

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
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AdminPageHeader
        title="Notificações"
        subtitle="Eventos da plataforma e alertas do sistema."
        icon={<Bell className="w-5 h-5" />}
        actions={
          <button
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] disabled:opacity-50 border border-[#222] rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas lidas
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="text"
            placeholder="Buscar notificação..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-[#0d0d0d] border border-[#222] text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={showUnread} onChange={e => { setShowUnread(e.target.checked); setPage(0); }} />
            <div className="w-9 h-5 bg-[#222] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#888] peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
          </div>
          <span className="text-sm text-[#888] font-medium">Apenas não lidas</span>
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
                  onClick={() => handleNotifClick(notif)}
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

