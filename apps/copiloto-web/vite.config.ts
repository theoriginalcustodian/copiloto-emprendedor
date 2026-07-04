import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Copiloto del Emprendedor — cliente PWA mobile-first + desktop responsive.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Un redeploy DEBE llegar al navegador sin que el usuario limpie nada a mano:
      // - cleanupOutdatedCaches purga el precache viejo (evita el estado "partido": index nuevo +
      //   chunk viejo -> UI rota, ej. composer que no renderiza);
      // - skipWaiting + clientsClaim: el SW nuevo toma control YA (no espera a cerrar todas las
      //   pestañas), así la 2da carga tras un deploy ya sirve el build fresco.
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Copiloto del Emprendedor',
        short_name: 'Copiloto',
        description: 'Tu copiloto de IA para el día a día del negocio.',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#020308',
        theme_color: '#020308',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
