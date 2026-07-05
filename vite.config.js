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
  },
})
