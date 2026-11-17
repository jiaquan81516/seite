import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        id: './',
        name: 'Seite · Daily Spending',
        short_name: 'Seite',
        description: 'A personal daily spending tracker.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fffdfa',
        theme_color: '#fffdfa',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Include the lazy HEIC decoder so installed apps can also convert offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        cacheId: 'seite',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,mjs,css,html,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'], clearMocks: true },
});
