import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const allowedHosts: string[] | boolean = env.NGROK_HOST 
    ? [env.NGROK_HOST, '.ngrok-free.app', '.ngrok.io']
    : true;

  return {
    plugins: [react()],
    server: {
      allowedHosts,
      proxy: {
        // Mesmo proxy de contingência do vercel.json (/sb → Supabase) para o ambiente local
        '/sb': {
          target: env.VITE_SUPABASE_URL || 'https://paefckmkawocjxzuoclq.supabase.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/sb/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          playlist: resolve(__dirname, 'playlist/index.html')
        }
      }
    }
  };
});
