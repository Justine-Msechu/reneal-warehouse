import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRepairs, addRepair } from './api'

// A minimal unsigned JWT-shaped token: header.payload.signature, base64url encoded.
function fakeToken(payload) {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`
}

function mockFetchOnce(jsonBody, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(jsonBody),
  })
}

// Neither jsdom nor Node's native Storage API reliably initialize
// window.localStorage/sessionStorage in this environment — a minimal
// in-memory Storage stand-in sidesteps that entirely.
function createMemoryStorage() {
  let store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage()
  globalThis.sessionStorage = createMemoryStorage()

  vi.restoreAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  // jsdom throws "not implemented" on real navigation — stub it out.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  })
})

describe('cachedGet (via getRepairs)', () => {
  it('returns fresh cached data without calling fetch', async () => {
    localStorage.setItem('rws_repairs', JSON.stringify({ data: { repairs: ['cached'] }, ts: Date.now() }))
    global.fetch = vi.fn()

    const result = await getRepairs()

    expect(result).toEqual({ repairs: ['cached'] })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches fresh data when cache is stale, and updates the cache', async () => {
    const staleTs = Date.now() - 10 * 60 * 1000 // 10 min old, TTL is 5 min
    localStorage.setItem('rws_repairs', JSON.stringify({ data: { repairs: ['old'] }, ts: staleTs }))
    mockFetchOnce({ repairs: ['fresh'] })

    const result = await getRepairs()

    expect(result).toEqual({ repairs: ['fresh'] })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('rws_repairs')).data).toEqual({ repairs: ['fresh'] })
  })

  it('falls back to stale cache if the network fetch fails', async () => {
    const staleTs = Date.now() - 10 * 60 * 1000
    localStorage.setItem('rws_repairs', JSON.stringify({ data: { repairs: ['old'] }, ts: staleTs }))
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await getRepairs()

    expect(result).toEqual({ repairs: ['old'] })
  })

  it('serves stale cache without fetching when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const staleTs = Date.now() - 10 * 60 * 1000
    localStorage.setItem('rws_repairs', JSON.stringify({ data: { repairs: ['old'] }, ts: staleTs }))
    global.fetch = vi.fn()

    const result = await getRepairs()

    expect(result).toEqual({ repairs: ['old'] })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws a clear error when offline with no cache at all', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    global.fetch = vi.fn()

    await expect(getRepairs()).rejects.toThrow(/offline/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('post (via addRepair)', () => {
  it('refuses to write while offline, without calling fetch', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    global.fetch = vi.fn()

    await expect(addRepair({ referenceNumber: 'X' })).rejects.toThrow(/offline/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('busts the relevant cache entry after a successful write', async () => {
    localStorage.setItem('rws_repairs', JSON.stringify({ data: { repairs: ['old'] }, ts: Date.now() }))
    mockFetchOnce({ success: true, id: 'ABC123' })

    await addRepair({ referenceNumber: 'X', schoolName: 'Y', problemIdentified: 'Z' })

    expect(localStorage.getItem('rws_repairs')).toBeNull()
  })
})

describe('auth error handling', () => {
  it('clears the session and throws when the server says Unauthorized', async () => {
    sessionStorage.setItem('rws_token', fakeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    mockFetchOnce({ error: 'Unauthorized' })

    await expect(addRepair({ referenceNumber: 'X' })).rejects.toThrow('Unauthorized')
    expect(sessionStorage.getItem('rws_token')).toBeNull()
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('surfaces a friendly message when the server says Forbidden', async () => {
    sessionStorage.setItem('rws_token', fakeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    mockFetchOnce({ error: 'Forbidden' })

    await expect(addRepair({ referenceNumber: 'X' })).rejects.toThrow(/permission/i)
  })
})

describe('token expiry (getToken, exercised via addRepair)', () => {
  it('clears an expired token, reloads, and sends an empty token rather than the expired one', async () => {
    const expired = fakeToken({ exp: Math.floor(Date.now() / 1000) - 60 }) // expired 1 min ago
    sessionStorage.setItem('rws_token', expired)
    mockFetchOnce({ success: true, id: 'X' })

    await addRepair({ referenceNumber: 'X', schoolName: 'Y', problemIdentified: 'Z' })

    expect(sessionStorage.getItem('rws_token')).toBeNull()
    expect(window.location.reload).toHaveBeenCalled()
    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(sentBody.token).toBe('')
  })

  it('sends a still-valid token unchanged', async () => {
    const valid = fakeToken({ exp: Math.floor(Date.now() / 1000) + 3600 })
    sessionStorage.setItem('rws_token', valid)
    mockFetchOnce({ success: true, id: 'X' })

    await addRepair({ referenceNumber: 'X', schoolName: 'Y', problemIdentified: 'Z' })

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(sentBody.token).toBe(valid)
  })
})
