import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Bell, CheckCheck, AlertCircle, Clock,
  UserPlus, DollarSign, Ban, ChevronLeft, ChevronRight, MessageCircle
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
  critical: 'text-red-500',
  high: 'text-orange-500',
  normal: 'text-blue-600',
  low: 'text-slate-400',
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-colors shadow-xs"
          >
            <CheckCheck className="w-4 h-4 text-blue-600" />
            Marcar todas lidas
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar notificação..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-xs placeholder-slate-400 transition-colors"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={showUnread} onChange={e => { setShowUnread(e.target.checked); setPage(0); }} />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
          </div>
          <span className="text-sm text-slate-600 font-medium">Apenas não lidas</span>
        </label>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
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
          <div className="divide-y divide-slate-100">
            {paginated.map((notif, i) => {
              const Icon = TYPE_ICONS[notif.type] ?? TYPE_ICONS.default;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`flex items-start gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/30' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-50 border border-slate-100 ${PRIORITY_COLORS[notif.priority]}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${notif.read ? 'text-slate-600' : 'text-slate-900'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">{fmtDate(notif.created_at)}</span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{notif.body}</p>
                    )}
                    {notif.tenant_name && (
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">{notif.tenant_name}</p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
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
