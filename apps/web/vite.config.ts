import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flota Segura GPS',
        short_name: 'Flota Segura',
        description: 'Rastreo satelital de SECUREFLEET CONSULTING',
        lang: 'es-MX',
        theme_color: '#0B4F59',
        background_color: '#F4F5F7',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nunca se almacenan en caché datos de la API (ubicaciones = información sensible)
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1100 },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', ws: true, changeOrigin: true } },
  },
  test: { environment: 'jsdom', globals: true },
} as any);
