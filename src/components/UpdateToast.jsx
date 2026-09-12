import { useEffect, useState } from 'react'

// Registers the PWA service worker with registerType:'prompt' (see
// vite.config.js) — an update is only ever applied when the user clicks
// Reload here, never silently. This is the fix for the incident that got
// the old autoUpdate-based PWA config removed.
export default function UpdateToast() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateSW, setUpdateSW] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        const update = registerSW({
          onNeedRefresh: () => setNeedsRefresh(true),
          onOfflineReady: () => setOfflineReady(true),
        })
        setUpdateSW(() => update)
      })
      .catch(() => {}) // no service worker support (or dev mode) — nothing to do
    return () => { cancelled = true }
  }, [])

  if (needsRefresh) {
    return (
      <div className="bg-blue-700 text-white text-sm text-center py-2 px-4 font-medium flex items-center justify-center gap-3">
        <span>A new version of the app is available.</span>
        <button
          onClick={() => updateSW && updateSW(true)}
          className="bg-white text-blue-700 px-3 py-1 rounded text-xs font-semibold hover:bg-blue-50"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedsRefresh(false)}
          className="text-blue-200 hover:text-white text-xs"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="bg-green-600 text-white text-sm text-center py-1.5 px-4 flex items-center justify-center gap-3">
        <span>App is ready to work offline.</span>
        <button onClick={() => setOfflineReady(false)} className="text-green-200 hover:text-white text-xs" aria-label="Dismiss">✕</button>
      </div>
    )
  }

  return null
}
