// Service Worker para PWA do Raffros
const CACHE_NAME = 'raffros-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Alguns assets estáticos não foram cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
            return Promise.resolve();
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Não cacheia requisições do Supabase, Stripe, API externa ou métodos que não sejam GET
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('stripe.com') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('chrome-extension')
  ) {
    return;
  }

  // Estratégia Network First com fallback de Cache para navegação e páginas
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/');
        });
      })
    );
    return;
  }

  // Estratégia Stale-While-Revalidate para assets estáticos (imagens locais, CSS, JS, ícones)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── Web Push: Recebimento de Notificações em Segundo Plano ─────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Raffros',
    body: 'Você tem uma nova atualização na agenda.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'raffros-push',
    url: '/admin/agenda',
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          ...(parsed.data || {}),
          url: parsed.url || (parsed.data && parsed.data.url) || '/admin/agenda',
        },
      };
    } catch (_err) {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  const targetUrl = (payload.data && payload.data.url) || payload.url || '/admin/agenda';

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'raffros-notification',
    renotify: true,
    vibrate: [180, 80, 180],
    data: {
      ...(payload.data || {}),
      url: targetUrl,
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Raffros', options));
});

// ─── Web Push: Clique na Notificação ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const relativeOrFullUrl = notificationData.url || '/admin/agenda';
  const targetUrl = new URL(relativeOrFullUrl, self.location.origin).href;
  const targetPathWithQuery =
    new URL(targetUrl).pathname + new URL(targetUrl).search + new URL(targetUrl).hash;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        // Priorizar uma janela aberta do Raffros na mesma origem
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin) {
              if ('focus' in client) {
                await client.focus();
              }
              client.postMessage({
                type: 'RAFFROS_NOTIFICATION_CLICK',
                url: targetPathWithQuery,
                bookingId: notificationData.bookingId || null,
                data: notificationData,
              });
              return;
            }
          } catch (_e) {
            // Ignora URL inválida
          }
        }

        // Se o Raffros estiver fechado, abre nova janela/aba na URL do agendamento
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Web Push: Renovação de Assinatura pelo Navegador ───────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'RAFFROS_PUSH_SUBSCRIPTION_CHANGED',
        });
      }
    })
  );
});
