import { useState, useRef, useEffect } from 'react';
import { Bell, Clock, Smartphone, CheckCircle2, Settings2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import toast from 'react-hot-toast';

interface NotificationBellProps {
  align?: 'left' | 'right' | 'sidebar';
}

export function NotificationBell({ align = 'right' }: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const { tenant, role, professionalProfile } = useAuth();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    isSupported,
    permission,
    isIOS,
    isInstalled,
    currentDeviceRecord,
    isCurrentDeviceActive,
    preferences,
    isSubscribing,
    subscribeCurrentDevice,
    toggleDeviceActive,
  } = usePushNotifications();

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
    queryKey: ['notifications', tenant?.id, professionalProfile?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (professionalProfile?.id) {
        // Professionals only see their own notifications, plus any tenant-wide ones where professional_id is null
        query = query.or(`professional_id.eq.${professionalProfile.id},professional_id.is.null`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) return;
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
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
    },
  });

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAsReadMutation.mutate();
    }
  };

  const handleQuickEnablePush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (currentDeviceRecord && !currentDeviceRecord.is_active && permission === 'granted') {
        await toggleDeviceActive({ deviceId: currentDeviceRecord.id, isActive: true });
        toast.success('Notificações reativadas neste aparelho!');
        return;
      }
      await subscribeCurrentDevice();
      toast.success('Notificações ativadas no seu celular/aparelho!');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível ativar as notificações.');
    }
  };

  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (role === 'professional') {
      navigate('/admin/minha-area');
    } else {
      navigate('/admin/configuracoes?tab=notificacoes');
    }
  };

  const isPushFullyActiveHere = isCurrentDeviceActive && preferences.push_enabled !== false;

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
          <div
            className="px-4 py-3 border-b flex justify-between items-center"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
                Notificações
              </h3>
              {unreadCount > 0 && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${theme.accent}20`, color: theme.accent }}
                >
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={handleOpenSettings}
              title="Configurações de notificações"
              className="p-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ color: theme.textMuted }}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          {/* Barra sucinta de ativação rápida de notificações no celular / app instalado */}
          {(isSupported || isIOS) && (
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between gap-3"
              style={{
                borderColor: theme.border,
                background: isPushFullyActiveHere ? 'rgba(16,185,129,0.06)' : `${theme.accent}10`,
              }}
            >
              {isPushFullyActiveHere ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-medium truncate" style={{ color: theme.textPrimary }}>
                      Recebendo notificações no aparelho
                    </span>
                  </div>
                  <button
                    onClick={handleOpenSettings}
                    className="text-[11px] font-semibold flex-shrink-0 hover:underline cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    Configurar
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${theme.accent}20`, color: theme.accent }}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate" style={{ color: theme.textPrimary }}>
                        Receber notificações no celular
                      </p>
                      <p className="text-[10px] leading-tight truncate mt-0.5" style={{ color: theme.textMuted }}>
                        {isIOS && !isInstalled
                          ? 'Adicione o app à Tela de Início primeiro'
                          : 'Alertas de agendamentos na tela e no app'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleQuickEnablePush}
                    disabled={isSubscribing}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    style={{ background: theme.accent, color: '#FFFFFF' }}
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Ativando</span>
                      </>
                    ) : (
                      <span>Ativar</span>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="max-h-[380px] overflow-y-auto">
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
                        <p className="text-sm font-semibold mb-0.5" style={{ color: theme.textPrimary }}>
                          {notif.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                          {notif.description}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className="text-[10px] flex items-center gap-1 opacity-70"
                            style={{ color: theme.textMuted }}
                          >
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {(notif.link || (notif as any).booking_id) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setIsOpen(false);
                                let targetLink = (notif.link || '/admin/agenda').replace(/^\/app\//, '/admin/');
                                const bId = (notif as any).booking_id;
                                if (bId && !targetLink.includes('bookingId=')) {
                                  const sep = targetLink.includes('?') ? '&' : '?';
                                  targetLink = `${targetLink}${sep}bookingId=${bId}`;
                                }
                                navigate(targetLink);
                              }}
                              className="text-[10px] hover:underline cursor-pointer"
                              style={{ color: theme.accent }}
                            >
                              Ver detalhes
                            </button>
                          )}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: theme.accent }}
                        />
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
