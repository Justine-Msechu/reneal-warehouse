import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        navigateFallback: '/reneal-warehouse/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'Reneal Warehouse System',
        short_name: 'RWS',
        description: 'Warehouse management for Reneal Tanzania',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/reneal-warehouse/',
        scope: '/reneal-warehouse/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base: '/reneal-warehouse/',
  test: {
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        storageQuota: 10000000,
      },
    },
    // Tests must never depend on real .env values being present (they
    // aren't in CI — VITE_APPS_SCRIPT_URL is only injected for the actual
    // build step). A syntactically-valid dummy keeps `new URL(...)` in
    // api.js from throwing regardless of environment.
    env: {
      VITE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-placeholder/exec',
    },
  },
})
