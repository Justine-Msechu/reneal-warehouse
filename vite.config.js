import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA/service-worker support was dropped in the move to Vercel (an
// autoUpdate-based SW caused a "why can't I see my change" incident), then
// reintroduced with registerType:'prompt' to avoid silent updates — but
// that reintroduction caused something worse: a client whose cached bundle
// goes stale enough that its precached JS/CSS chunks get evicted from the
// next few deployments outright breaks (404s), and because the broken page
// never renders, it can never show the "reload" prompt that would have
// fixed it. That's a self-inflicted, unrecoverable-without-manually-
// clearing-site-data outage, worse than the thing 'prompt' was meant to
// prevent. `selfDestroying: true` ships a service worker whose only job is
// to unregister itself and wipe its own caches — the browser's SW update
// check runs independently of whether the page's own JS ever executes, so
// this reaches and heals even fully broken/stuck clients. Once existing
// installs have had time to clean themselves up, this plugin can be
// removed entirely; until then, leaving it in is harmless and self-limiting.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({ selfDestroying: true }),
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
