import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationBellProps {
  align?: 'left' | 'right' | 'sidebar';
}

export function NotificationBell({ align = 'right' }: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) return;
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('tenant_id', tenant.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAsReadMutation.mutate();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen}
        className="relative p-2 rounded-full transition-colors"
        style={{ color: theme.textMuted }}
        onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span 
            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
            style={{ background: theme.accent, boxShadow: `0 0 0 2px ${theme.bg}` }}
          />
        )}
      </button>

      {isOpen && (
        <div 
          className={`absolute ${
            align === 'sidebar'
              ? 'left-0 md:left-full md:top-0 md:ml-3 mt-2 md:mt-0'
              : align === 'left'
              ? 'left-0 mt-2'
              : 'right-0 mt-2'
          } w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden z-[100] border`}
          style={{ background: theme.bg, borderColor: theme.border }}
        >
          <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Notificações</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${theme.accent}20`, color: theme.accent }}>
                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center" style={{ color: theme.textMuted }}>
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: theme.border }}>
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    className={`p-4 transition-colors ${!notif.is_read ? 'bg-opacity-5' : ''}`}
                    style={{ backgroundColor: !notif.is_read ? theme.accent : 'transparent' }}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold mb-0.5" style={{ color: theme.textPrimary }}>{notif.title}</p>
                        <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>{notif.description}</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] flex items-center gap-1 opacity-70" style={{ color: theme.textMuted }}>
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          {notif.link && (
                            <Link 
                              to={notif.link} 
                              onClick={() => setIsOpen(false)}
                              className="text-[10px] hover:underline"
                              style={{ color: theme.accent }}
                            >
                              Ver detalhes
                            </Link>
                          )}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: theme.accent }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
