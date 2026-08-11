import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface RealtimeContextType {
  isConnected: boolean;
  status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING';
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: true,
  status: 'SUBSCRIBED',
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(true);
  const [status, setStatus] = useState<'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING'>('CONNECTING');

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const tenantId = profile.tenant_id;

    // Supabase Channel setup
    const channel = supabase
      .channel(`tenant-${tenantId}`)
      // Escutar agendamentos
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `tenant_id=eq.${tenantId}` },
        () => {
          // Invalidate all booking-related queries (agenda views)
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          // FIX #7: Invalidate the actual query keys used by Dashboard.tsx
          queryClient.invalidateQueries({ queryKey: ['dashboard_today_bookings'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard_recent_bookings'] });
          // Also invalidate customer history that shows in BookingDetailSheet
          queryClient.invalidateQueries({ queryKey: ['customer_history_bookings'] });
        }
      )
      // Escutar clientes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          // FIX #7: Also update the dashboard new customers counter
          queryClient.invalidateQueries({ queryKey: ['dashboard_new_customers'] });
        }
      )
      // Escutar notificações
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });

          const notif = payload.new as any;
          
          // Toast visual
          toast.success(`${notif.title}\n${notif.description}`, {
            duration: 6000,
            style: {
              background: '#222',
              color: '#fff',
              border: '1px solid #333',
              fontSize: '13px'
            },
          });

          // Tocar som se ativado
          try {
            // Tenta pegar as config do cache
            let settings: any = queryClient.getQueryData(['notification_settings']);
            
            // Se não estiver no cache, busca no banco rapidamente
            if (!settings) {
              const { data } = await supabase
                .from('notification_settings')
                .select('sound_enabled')
                .eq('tenant_id', tenantId)
                .single();
              settings = data;
            }

            if (settings && settings.sound_enabled) {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
                
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
              }
            }
          } catch (e) {
            console.error('Erro ao reproduzir som de notificação:', e);
          }
        }
      )
      .subscribe((evtStatus) => {
        setStatus(evtStatus as any);
        if (evtStatus === 'SUBSCRIBED') {
          setIsConnected(true);
          // Opcional: Re-invalidar tudo quando reconecta para garantir que não perdeu nada enquanto estava offline
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        } else if (evtStatus === 'CLOSED' || evtStatus === 'CHANNEL_ERROR' || evtStatus === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.tenant_id, queryClient]);

  return (
    <RealtimeContext.Provider value={{ isConnected, status }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);
