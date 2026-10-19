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
      /*
       * MAPAS DE ORIGEN EN PRODUCCIÓN, A PROPÓSITO.
       *
       * Esta aplicación se depura leyendo su propio registro de errores desde
       * el móvil, y sin mapas los errores llegan así:
       *
       *     Cannot access 'W' before initialization
       *
       * Una letra. Cuál era «W» y en qué archivo vivía se acaba buscando a
       * mano por el código durante media hora, cuando el navegador lo sabe.
       * Con los mapas dice el nombre de verdad y la línea.
       *
       * No pesa en la carga: los .map solo se descargan si se abren las
       * herramientas de desarrollo. Y el código de esta app no esconde nada
       * que no esté ya en un repositorio público.
       */
      sourcemap: true,
      target: 'es2022',
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf';
            }
            if (id.includes('@google/genai')) {
              return 'genai';
            }
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified') || id.includes('micromark') || id.includes('mdast') || id.includes('unist') || id.includes('vfile')) {
              return 'markdown';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
          }
        }
      }
    }
  };
});
