import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA per ARCHITECTURE.md §5: standalone, bot-first, offline-capable.
// Manifest fields mirror the design handoff's manifest.json (docs/design/manifest.json).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/radar.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Role Radar',
        short_name: 'Radar',
        description:
          'Your personal job-hunt scout — it surfaces the rare right role and walks you through it.',
        id: '/',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1E8A4F',
        theme_color: '#1E8A4F',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/icons/radar-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/radar-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/radar-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Run a sweep', short_name: 'Sweep', url: '/?action=sweep' },
          { name: 'Review proposals', short_name: 'Queue', url: '/?view=queue' },
        ],
      },
      workbox: {
        // App shell + static assets: precache, cache-first (instant offline launch).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Google Fonts stylesheets + glyph files (self-hosting is the follow-up; see README).
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rr-fonts',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Amplify Data (AppSync): network-first with a short fallback so an
            // offline open still shows the last briefing.
            urlPattern: /^https:\/\/.*\.appsync-api\..*\.amazonaws\.com\/.*/i,
            handler: 'NetworkFirst',
            method: 'POST',
            options: {
              cacheName: 'rr-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
