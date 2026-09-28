import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { injectBuildSha, resolveBuildSha } from './src/util/buildSha';

// BUILDSHA (2026-09-28, contrato planificación): `servido@<sha>` pasa de inferencia (hora del
// PNG cruzada contra origin/main) a lectura real -- data-build-sha en <html> es lo que el
// instrumento de captura lee del mismo snapshot que fotografía. VITE_BUILD_SHA se inyecta en
// deploy.sh y sync-web.sh (las DOS rutas de build), no acá: acá sólo se lee el env ya presente.
// `loadEnv` (no `process.env`) a propósito: este package.json no declara `@types/node`, y
// `process.env` bajo `strict` de tsconfig.node.json no tipa sin él (TS2580, lo cazó CI, no local
// -- el node_modules de dev tenía @types/node hoisted de otro workspace, CI no).
function buildShaPlugin(mode: string): Plugin {
  return {
    name: 'build-sha-attr',
    transformIndexHtml(html) {
      const env = loadEnv(mode, '.', 'VITE_');
      return injectBuildSha(html, resolveBuildSha(env.VITE_BUILD_SHA));
    },
  };
}

// Odobi — cliente PWA mobile-first + desktop responsive.
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [
    react(),
    buildShaPlugin(mode),
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
        // El SW instala una NavigationRoute que sirve `index.html` (fallback SPA) para TODA
        // navegación. Sin esta denylist, un click en "Entrar con Google" (navegación same-origin a
        // /auth/v1/authorize) lo intercepta el SW y devuelve el shell de la SPA en vez de llegar a
        // GoTrue → el login OAuth "recarga y no hace nada". Excluir /auth/* (authorize Y callback)
        // deja esas navegaciones ir a la red (Caddy → GoTrue). Los paths de API del front-door
        // (/chat,/me,/reply…) son fetch/XHR, no navegaciones, así que la NavigationRoute no los toca.
        navigateFallbackDenylist: [/^\/auth\//],
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Odobi',
        short_name: 'Odobi',
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
}));
