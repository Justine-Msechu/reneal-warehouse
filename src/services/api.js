// API client for the Vercel Functions + Postgres backend. Frontend and API
// are served from the same Vercel project (same-origin), so auth is a
// httpOnly session cookie (`credentials: 'include'`) instead of a bearer
// token carried in every request — the backend verifies it locally.

const API_BASE = '/api'

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
async function handleAuthError(res, data) {
  if (res.status === 401 || res.status === 403) {
    // Only reload if we thought we had a session — avoids a reload loop on the login screen itself
    if (sessionStorage.getItem('rws_user')) {
      sessionStorage.clear()
      window.location.reload()
    }
    throw new Error(res.status === 403 ? 'You do not have permission for this action.' : 'Unauthorized')
  }
  if (data?.error) throw new Error(data.error)
}

async function request(path, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v) })
  const res = await fetch(url.toString(), { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { await handleAuthError(res, data); throw new Error(`Request failed: ${res.status}`) }
  return data
}

async function send(method, path, params = {}, body) {
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to save changes.')
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v) })
  const res = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { await handleAuthError(res, data); throw new Error(data.error || `Request failed: ${res.status}`) }
  return data
}

const post = (path, body) => send('POST', path, {}, body)
const patch = (path, params, body) => send('PATCH', path, params, body)
const del = (path, params) => send('DELETE', path, params)

async function cachedGet(key, path, params) {
  const entry = getCacheEntry(key)
  const isOnline = navigator.onLine

  if (entry && isOnline && Date.now() - entry.ts < TTL) return entry.data
  if (entry && !isOnline) return entry.data

  if (isOnline) {
    try {
      const data = await request(path, params)
      putCache(key, data)
      return data
    } catch (err) {
      if (entry) return entry.data
      throw err
    }
  }

  throw new Error('You are offline and this data has not been loaded before. Please connect to the internet first.')
}

// ── Auth ──────────────────────────────────────────────────────
export const loginWithGoogle = (credential) => send('POST', `${API_BASE}/auth`, { action: 'login' }, { credential })
export const getSessionUser = () => request(`${API_BASE}/auth`, { action: 'session' })
export const logout = () => send('POST', `${API_BASE}/auth`, { action: 'logout' })

// ── Repairs ───────────────────────────────────────────────────
export const getRepairs = () => cachedGet('repairs', `${API_BASE}/repairs`)
export const addRepair = (data) => { bust('repairs'); return post(`${API_BASE}/repairs`, data) }
export const updateRepair = (data) => { bust('repairs'); return patch(`${API_BASE}/repairs`, { id: data.id }, data) }

// ── Spare Laptops ─────────────────────────────────────────────
export const getSpareLaptops = () => cachedGet('laptops', `${API_BASE}/spare-laptops`)
export const addSpareLaptop = (data) => { bust('laptops'); return post(`${API_BASE}/spare-laptops`, data) }
export const updateSpareLaptop = (data) => { bust('laptops'); return patch(`${API_BASE}/spare-laptops`, { id: data.id }, data) }

// ── Warehouse Inventory ───────────────────────────────────────
export const getInventory = () => cachedGet('inventory', `${API_BASE}/inventory`, { resource: 'items' })
export const addInventoryItem = (data) => { bust('inventory'); return post(`${API_BASE}/inventory?resource=items`, data) }
export const updateInventoryItem = (data) => { bust('inventory'); return patch(`${API_BASE}/inventory`, { resource: 'items', id: data.id }, data) }
export const deleteInventoryItem = (id) => { bust('inventory', 'deletedLog'); return del(`${API_BASE}/inventory`, { resource: 'items', id }) }
export const restoreInventoryItem = (id) => { bust('inventory', 'deletedLog'); return post(`${API_BASE}/inventory?${new URLSearchParams({ resource: 'items', id, restore: '1' })}`) }
export const deleteInventoryBox = (boxId) => { bust('inventory', 'deletedLog'); return del(`${API_BASE}/inventory`, { resource: 'boxes', id: boxId }) }
export const getDeletedLog = () => cachedGet('deletedLog', `${API_BASE}/inventory`, { resource: 'deleted-log' })

// ── Schools ───────────────────────────────────────────────────
export const getSchools = () => cachedGet('schools', `${API_BASE}/schools`)
export const addSchool = (data) => { bust('schools'); return post(`${API_BASE}/schools`, data) }
export const updateSchool = (data) => { bust('schools'); return patch(`${API_BASE}/schools`, { id: data.id }, data) }

// ── Withdrawals ───────────────────────────────────────────────
export const getWithdrawals = () => cachedGet('withdrawals', `${API_BASE}/withdrawals`)
export const logWithdrawal = (data) => { bust('withdrawals', 'inventory'); return post(`${API_BASE}/withdrawals`, data) }
export const updateWithdrawal = (data) => { bust('withdrawals'); return patch(`${API_BASE}/withdrawals`, { id: data.id }, data) }

// ── Deployments ───────────────────────────────────────────────
export const getDeployments = () => cachedGet('deployments', `${API_BASE}/deployments`)
export const logDeployment = (data) => { bust('deployments', 'laptops'); return post(`${API_BASE}/deployments`, data) }
export const updateDeployment = (data) => { bust('deployments'); return patch(`${API_BASE}/deployments`, { id: data.id }, data) }

// ── Users ─────────────────────────────────────────────────────
export const getUsers = () => cachedGet('users', `${API_BASE}/users`)
export const addUser = (data) => { bust('users'); return post(`${API_BASE}/users`, data) }
export const removeUser = (data) => { bust('users'); return del(`${API_BASE}/users`, { email: data.email }) }

// ── AI Assistant ──────────────────────────────────────────────
// Not yet migrated — see ai/ follow-up. confirm gates data-changing tool calls.
export const askAI = (question, confirm = false) => post(`${API_BASE}/ai/ask`, { question, confirm })
