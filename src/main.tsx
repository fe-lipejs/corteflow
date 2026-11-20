import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './locales/i18n';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RealtimeProvider } from './contexts/RealtimeContext';
import CookieConsentBanner from './components/cookies/CookieConsentBanner';

// Registrar Service Worker para PWA (tanto em Dev quanto em Prod para habilitar o prompt nativo do Chrome)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => {
        console.warn('Erro ao registrar ServiceWorker do PWA:', err);
      });
  });
}

const isNetworkFailure = (error: any) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Falhas de rede (4G oscilando / rota bloqueada): tenta de novo com backoff
      retry: (failureCount, error) => (isNetworkFailure(error) ? failureCount < 4 : failureCount < 2),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Mutations (ex.: criar agendamento) NÃO são repetidas automaticamente para evitar duplicidade
      retry: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RealtimeProvider>
            <AppRoutes />
            <CookieConsentBanner />
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);

