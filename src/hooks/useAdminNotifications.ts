import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export function useAdminNotifications() {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['admin_notifications_unread'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);
      if (error) return 0; // Graceful fallback if table doesn't exist yet
      return count ?? 0;
    },
    refetchInterval: 30000, // Poll every 30s
    staleTime: 15000,
  });

  return { unreadCount };
}
