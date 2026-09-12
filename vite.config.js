import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA/service-worker support (vite-plugin-pwa) was dropped in the move to
// Vercel, then reintroduced here with `registerType: 'prompt'` instead of
// the old `autoUpdate` — that silent auto-swap was what caused a real
// incident where a deployed UI change wasn't visible until a hard refresh.
// 'prompt' + src/components/UpdateToast.jsx means an update is only ever
// applied when someone clicks "Reload", never silently. Offline reads are
// still separately covered by the localStorage cache in
// src/services/api.js, which doesn't depend on the service worker at all.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'Reneal Warehouse',
        short_name: 'Reneal Warehouse',
        description: 'Warehouse management for Reneal Tanzania',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#08448c',
        theme_color: '#08448c',
        icons: [
          // Placeholder: public/logo.png is 64x55 (non-square, too small
          // for a PWA icon). Using the pre-existing generic icon.svg until
          // a proper square/high-res export of the real logo exists.
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        storageQuota: 10000000,
      },
    },
  },
})
