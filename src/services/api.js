const SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || ''
const API_KEY = import.meta.env.VITE_API_KEY || ''

// ── Cache (localStorage) ──────────────────────────────────────
// Online: serve cache if fresh (< 5 min), else fetch
// Offline: serve cache regardless of age
const TTL = 5 * 60 * 1000
const PFX = 'rws_'

function getCacheEntry(key) {
  try {
    const raw = localStorage.getItem(PFX + key)
    if (!raw) return null
    return JSON.parse(raw) // { data, ts }
  } catch { return null }
}

function putCache(key, data) {
  try { localStorage.setItem(PFX + key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function bust(...keys) {
  keys.forEach((k) => { try { localStorage.removeItem(PFX + k) } catch {} })
}

// ── HTTP helpers ──────────────────────────────────────────────
async function request(params) {
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('key', API_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const data = await res.json()
  if (data.error === 'Unauthorized') throw new Error('Unauthorized')
  return data
}

async function post(body) {
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to save changes.')
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ ...body, key: API_KEY }),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const data = await res.json()
  if (data.error === 'Unauthorized') throw new Error('Unauthorized')
  return data
}

async function cachedGet(key, params) {
  const entry = getCacheEntry(key)
  const isOnline = navigator.onLine

  // Online + fresh cache → return immediately
  if (entry && isOnline && Date.now() - entry.ts < TTL) return entry.data

  // Offline + any cache → return whatever we have
  if (entry && !isOnline) return entry.data

  // Online + stale/missing → fetch fresh
  if (isOnline) {
    try {
      const data = await request(params)
      putCache(key, data)
      return data
    } catch (err) {
      if (entry) return entry.data // fetch failed but we have stale data — use it
      throw err
    }
  }

  // Offline + no cache
  throw new Error('You are offline and this data has not been loaded before. Please connect to the internet first.')
}

// ── Repairs ───────────────────────────────────────────────────
export const getRepairs = () => cachedGet('repairs', { action: 'getRepairs' })
export const addRepair = (data) => { bust('repairs'); return post({ action: 'addRepair', ...data }) }
export const updateRepair = (data) => { bust('repairs'); return post({ action: 'updateRepair', ...data }) }

// ── Spare Laptops ─────────────────────────────────────────────
export const getSpareLaptops = () => cachedGet('laptops', { action: 'getSpareLaptops' })
export const addSpareLaptop = (data) => { bust('laptops'); return post({ action: 'addSpareLaptop', ...data }) }
export const updateSpareLaptop = (data) => { bust('laptops'); return post({ action: 'updateSpareLaptop', ...data }) }

// ── Warehouse Inventory ───────────────────────────────────────
export const getInventory = () => cachedGet('inventory', { action: 'getInventory' })
export const addInventoryItem = (data) => { bust('inventory'); return post({ action: 'addInventoryItem', ...data }) }
export const updateInventoryItem = (data) => { bust('inventory'); return post({ action: 'updateInventoryItem', ...data }) }

// ── Schools ───────────────────────────────────────────────────
export const getSchools = () => cachedGet('schools', { action: 'getSchools' })
export const addSchool = (data) => { bust('schools'); return post({ action: 'addSchool', ...data }) }
export const updateSchool = (data) => { bust('schools'); return post({ action: 'updateSchool', ...data }) }

// ── Withdrawals ───────────────────────────────────────────────
export const getWithdrawals = () => cachedGet('withdrawals', { action: 'getWithdrawals' })
export const logWithdrawal = (data) => { bust('withdrawals', 'inventory'); return post({ action: 'logWithdrawal', ...data }) }

// ── Deployments ───────────────────────────────────────────────
export const getDeployments = () => cachedGet('deployments', { action: 'getDeployments' })
export const logDeployment = (data) => { bust('deployments', 'laptops'); return post({ action: 'logDeployment', ...data }) }

// ── Users ─────────────────────────────────────────────────────
export const getUser = (email) => request({ action: 'getUser', email })
export const getUsers = () => cachedGet('users', { action: 'getUsers' })
export const addUser = (data) => { bust('users'); return post({ action: 'addUser', ...data }) }
export const removeUser = (data) => { bust('users'); return post({ action: 'removeUser', ...data }) }
