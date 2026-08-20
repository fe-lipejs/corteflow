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
