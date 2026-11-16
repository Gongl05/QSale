import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.QSALE_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/session': `http://127.0.0.1:${process.env.QSALE_SESSION_PORT ?? 3001}`,
      '/backend': `http://127.0.0.1:${process.env.QSALE_SESSION_PORT ?? 3001}`,
    },
  },
});
