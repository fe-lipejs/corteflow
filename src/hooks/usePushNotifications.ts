import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { usePWAInstall } from './usePWAInstall';

export interface PushSubscriptionDevice {
  id: string;
  user_id: string;
  tenant_id: string;
  professional_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_name: string;
  platform: 'android' | 'ios' | 'desktop' | 'web';
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

export interface PushNotificationPreferences {
  id?: string;
  user_id: string;
  tenant_id: string;
  push_enabled: boolean;
  notify_new_booking: boolean;
  notify_cancellation: boolean;
  notify_reschedule: boolean;
  notify_reminder: boolean;
  notify_daily_summary: boolean;
  reminder_minutes_before: number;
}

const DEFAULT_PREFERENCES: Omit<PushNotificationPreferences, 'user_id' | 'tenant_id'> = {
  push_enabled: true,
  notify_new_booking: true,
  notify_cancellation: true,
  notify_reschedule: true,
  notify_reminder: true,
  notify_daily_summary: true,
  reminder_minutes_before: 30,
};

let cachedVapidPublicKey: string =
  (typeof window !== 'undefined' && window.localStorage?.getItem('raffros_vapid_public_key')) ||
  (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ||
  '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectDeviceInfo(): { deviceName: string; platform: 'android' | 'ios' | 'desktop' | 'web' } {
  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();

  const isIOS =
    /iphone|ipad|ipod/.test(uaLower) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(uaLower);

  let browser = 'Navegador';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  if (isIOS) {
    const model = /ipad/.test(uaLower) ? 'iPad' : 'iPhone';
    return {
      deviceName: `${model} (${browser})`,
      platform: 'ios',
    };
  }

  if (isAndroid) {
    const androidModelMatch = ua.match(/;\s*([^;)]+?)\s+Build\//i);
    const model = androidModelMatch?.[1]?.trim() || 'Android';
    return {
      deviceName: `${model} (${browser})`,
      platform: 'android',
    };
  }

  let os = 'Computador';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'Mac';
  else if (/linux/i.test(ua)) os = 'Linux';

  return {
    deviceName: `${os} (${browser})`,
    platform: 'desktop',
  };
}

export function usePushNotifications() {
  const { user, profile, tenant, professionalProfile } = useAuth();
  const tenantId = tenant?.id ?? profile?.tenant_id ?? null;
  const queryClient = useQueryClient();
  const { isIOS, isInstalled } = usePWAInstall();

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const syncLocalBrowserState = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      } else {
        // Garante que usuários que já instalaram o app antes desta atualização
        // recebam automaticamente o novo service-worker.js com suporte a Push
        reg.update().catch(() => {});
      }
      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription();
        setCurrentEndpoint(sub?.endpoint ?? null);
      }
    } catch (err) {
      console.warn('Não foi possível verificar assinatura Push local:', err);
    }
  }, []);

  useEffect(() => {
    syncLocalBrowserState();
    // Pré-carrega a chave pública VAPID em segundo plano para que, no iPhone (WebKit),
    // o clique em "Ativar" não perca o gesto do usuário aguardando rede antes do pushManager.subscribe()
    if (!cachedVapidPublicKey && user?.id) {
      supabase.functions
        .invoke('push-notifications', {
          body: { action: 'get_vapid_public_key' },
        })
        .then(({ data }) => {
          if (data?.publicKey) {
            cachedVapidPublicKey = data.publicKey;
            try {
              window.localStorage?.setItem('raffros_vapid_public_key', data.publicKey);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [syncLocalBrowserState, user?.id]);

  // Buscar dispositivos registrados do usuário atual neste tenant
  const devicesQuery = useQuery({
    queryKey: ['push_subscriptions', user?.id, tenantId],
    enabled: Boolean(user?.id && tenantId),
    retry: false,
    queryFn: async (): Promise<PushSubscriptionDevice[]> => {
      const { data, error } = await (supabase as any)
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .order('last_used_at', { ascending: false });

      if (error) {
        // Caso a migração ainda não tenha sido aplicada no banco remoto, retorna lista vazia sem quebrar a UI
        if (error.code === 'PGRST205' || error.code === '42P01' || String(error.message || '').includes('404')) {
          return [];
        }
        console.warn('[usePushNotifications] Aviso ao buscar dispositivos:', error.message);
        return [];
      }
      return (data ?? []) as PushSubscriptionDevice[];
    },
  });

  // Buscar preferências de notificações Push do usuário atual neste tenant
  const preferencesQuery = useQuery({
    queryKey: ['push_notification_preferences', user?.id, tenantId],
    enabled: Boolean(user?.id && tenantId),
    retry: false,
    queryFn: async (): Promise<PushNotificationPreferences> => {
      const { data, error } = await (supabase as any)
        .from('push_notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .eq('tenant_id', tenantId!)
        .maybeSingle();

      if (error) {
        return {
          user_id: user!.id,
          tenant_id: tenantId!,
          ...DEFAULT_PREFERENCES,
        };
      }

      if (data) {
        return data as PushNotificationPreferences;
      }

      return {
        user_id: user!.id,
        tenant_id: tenantId!,
        ...DEFAULT_PREFERENCES,
      };
    },
  });

  // Registra o dispositivo atual no Web Push (somente após clique explícito do usuário)
  const subscribeCurrentDevice = useCallback(async () => {
    if (!user?.id || !tenantId) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }

    const hasPushApis =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (isIOS && (!isInstalled || !hasPushApis)) {
      throw new Error(
        'No iPhone, toque em Compartilhar no navegador → "Adicionar à Tela de Início" e abra o Raffros pelo ícone instalado para ativar as notificações no celular.'
      );
    }

    if (!hasPushApis) {
      throw new Error('Seu navegador atual não suporta notificações Web Push neste modo.');
    }

    setIsSubscribing(true);
    try {
      // 1. Solicitar permissão ao navegador IMEDIATAMENTE dentro do gesto de toque (obrigatório no iOS WebKit)
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== 'granted') {
        throw new Error(
          'Permissão de notificações negada. Libere as notificações nas configurações do navegador/aparelho e tente novamente.'
        );
      }

      // 2. Garantir que o Service Worker esteja ativo
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;

      // 3. Obter a chave pública VAPID (usando cache pré-carregado para preservar gesto no iOS)
      let vapidPublicKey = cachedVapidPublicKey;
      if (!vapidPublicKey) {
        const { data: keyData, error: keyErr } = await supabase.functions.invoke('push-notifications', {
          body: { action: 'get_vapid_public_key' },
        });
        if (keyErr || !keyData?.publicKey) {
          throw new Error('Não foi possível obter a chave de segurança VAPID do servidor.');
        }
        vapidPublicKey = keyData.publicKey;
        cachedVapidPublicKey = vapidPublicKey;
        try {
          window.localStorage?.setItem('raffros_vapid_public_key', vapidPublicKey);
        } catch {}
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Criar ou recuperar PushSubscription no navegador
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });
      }

      const subJson = subscription.toJSON();
      const { deviceName, platform } = detectDeviceInfo();

      // 5. Salvar assinatura no Supabase vinculada ao user_id e tenant_id via Edge Function
      const { data: subResult, error: subError } = await supabase.functions.invoke('push-notifications', {
        body: {
          action: 'subscribe',
          tenantId,
          professionalId: professionalProfile?.id ?? null,
          subscription: subJson,
          deviceName,
          platform,
          userAgent: navigator.userAgent,
        },
      });

      if (subError || subResult?.error) {
        throw new Error(subResult?.error || subError?.message || 'Erro ao registrar dispositivo no servidor.');
      }

      // 6. Garantir que push_enabled esteja ativo nas preferências do usuário
      await (supabase as any)
        .from('push_notification_preferences')
        .upsert(
          {
            user_id: user.id,
            tenant_id: tenantId,
            push_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tenant_id' }
        );

      setCurrentEndpoint(subscription.endpoint);
      await queryClient.invalidateQueries({ queryKey: ['push_subscriptions', user.id, tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['push_notification_preferences', user.id, tenantId] });

      return (subResult?.device ?? subResult?.subscription) as PushSubscriptionDevice;
    } finally {
      setIsSubscribing(false);
    }
  }, [user?.id, tenantId, professionalProfile?.id, isIOS, isInstalled, queryClient]);

  // Atualizar preferências individuais de eventos Push
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<PushNotificationPreferences>) => {
      if (!user?.id || !tenantId) throw new Error('Usuário não autenticado.');
      const current = preferencesQuery.data ?? {
        user_id: user.id,
        tenant_id: tenantId,
        ...DEFAULT_PREFERENCES,
      };

      const payload = {
        user_id: user.id,
        tenant_id: tenantId,
        push_enabled: updates.push_enabled ?? current.push_enabled,
        notify_new_booking: updates.notify_new_booking ?? current.notify_new_booking,
        notify_cancellation: updates.notify_cancellation ?? current.notify_cancellation,
        notify_reschedule: updates.notify_reschedule ?? current.notify_reschedule,
        notify_reminder: updates.notify_reminder ?? current.notify_reminder,
        notify_daily_summary: updates.notify_daily_summary ?? current.notify_daily_summary,
        reminder_minutes_before: updates.reminder_minutes_before ?? current.reminder_minutes_before,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from('push_notification_preferences')
        .upsert(payload, { onConflict: 'user_id,tenant_id' })
        .select('*')
        .single();

      if (error) throw error;
      return data as PushNotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push_notification_preferences', user?.id, tenantId] });
    },
  });

  // Ativar / Desativar um dispositivo individual
  const toggleDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, isActive }: { deviceId: string; isActive: boolean }) => {
      if (!user?.id || !tenantId) throw new Error('Usuário não autenticado.');
      const { error } = await (supabase as any)
        .from('push_subscriptions')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions', user?.id, tenantId] });
    },
  });

  // Remover um dispositivo conectado
  const removeDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, endpoint }: { deviceId: string; endpoint: string }) => {
      if (!user?.id || !tenantId) throw new Error('Usuário não autenticado.');
      const { error } = await (supabase as any)
        .from('push_subscriptions')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Se o dispositivo removido for o navegador atual, cancela a inscrição local também
      if (endpoint && endpoint === currentEndpoint && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub && sub.endpoint === endpoint) {
            await sub.unsubscribe();
            setCurrentEndpoint(null);
          }
        } catch (e) {
          console.warn('Erro ao desinscrever PushManager local:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions', user?.id, tenantId] });
    },
  });

  // Disparar notificação de teste
  const sendTestNotification = useCallback(async () => {
    if (!tenantId) throw new Error('Estabelecimento não identificado.');
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('push-notifications', {
        body: {
          action: 'send_test',
          tenantId,
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha ao enviar notificação de teste.');
      }
      if ((data?.sent ?? data?.delivered) === 0) {
        throw new Error(
          'Nenhum dispositivo ativo recebeu o teste. Verifique se este aparelho está conectado e ativo.'
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['push_subscriptions', user?.id, tenantId] });
      return data;
    } finally {
      setIsTesting(false);
    }
  }, [tenantId, user?.id, queryClient]);

  // Ouvir evento de rotação de chave do Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RAFFROS_PUSH_SUBSCRIPTION_CHANGED' && Notification.permission === 'granted') {
        subscribeCurrentDevice().catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [subscribeCurrentDevice]);

  // Se o navegador/app instalado já tem permissão 'granted' e uma PushSubscription ativa,
  // mas ainda não está sincronizado para este tenant no banco, sincroniza silenciosamente
  useEffect(() => {
    if (
      !user?.id ||
      !tenantId ||
      !currentEndpoint ||
      permission !== 'granted' ||
      devicesQuery.isLoading ||
      isSubscribing
    ) {
      return;
    }
    const existing = (devicesQuery.data ?? []).find((d) => d.endpoint === currentEndpoint);
    if (!existing) {
      subscribeCurrentDevice().catch(() => {});
    }
  }, [
    user?.id,
    tenantId,
    currentEndpoint,
    permission,
    devicesQuery.isLoading,
    devicesQuery.data,
    isSubscribing,
    subscribeCurrentDevice,
  ]);

  const devices = devicesQuery.data ?? [];
  const currentDeviceRecord = devices.find((d) => d.endpoint === currentEndpoint) ?? null;
  const activeDevicesCount = devices.filter((d) => d.is_active).length;
  const isCurrentDeviceActive = Boolean(currentDeviceRecord && currentDeviceRecord.is_active);

  return {
    isSupported,
    permission,
    isIOS,
    isInstalled,
    currentEndpoint,
    currentDeviceRecord,
    isCurrentDeviceActive,
    activeDevicesCount,
    devices,
    isLoadingDevices: devicesQuery.isLoading,
    preferences:
      preferencesQuery.data ??
      ({
        user_id: user?.id ?? '',
        tenant_id: tenantId ?? '',
        ...DEFAULT_PREFERENCES,
      } as PushNotificationPreferences),
    isLoadingPreferences: preferencesQuery.isLoading,
    isSubscribing,
    isTesting,
    subscribeCurrentDevice,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    toggleDeviceActive: toggleDeviceMutation.mutateAsync,
    removeDevice: removeDeviceMutation.mutateAsync,
    sendTestNotification,
  };
}

