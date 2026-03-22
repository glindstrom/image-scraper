import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '');
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.FRONTEND_PORT || '5173'),
      proxy: {
        '/api': env.BACKEND_URL || 'http://localhost:3001',
      },
    },
  };
});
