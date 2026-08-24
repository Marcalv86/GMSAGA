import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? '')
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks: {
            pdf: ['pdfjs-dist', 'jspdf', 'html2canvas']
          }
        }
      }
    }
  };
});
