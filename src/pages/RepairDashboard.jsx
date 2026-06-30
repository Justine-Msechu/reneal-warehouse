import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { getRepairs, updateRepair } from '../services/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../contexts/AuthContext'

const PER_PAGE = 20

const STATUSES = ['All', 'Received', 'Under Repair', 'Fixed', 'Returned']

export default function RepairDashboard() {
  const [repairs, setRepairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('All')
  const [updating, setUpdating] = useState(null)
  const [page, setPage] = useState(1)
  const location = useLocation()
  const { user } = useAuth()
  const isSchool = user?.role === 'school'

  useEffect(() => {
    fetchRepairs()
  }, [])

  // Auto-filter for school role
  useEffect(() => {
    if (isSchool && user?.schoolName) {
      setSearch(user.schoolName)
      setFilter('All')
      setYearFilter('All')
    }
  }, [isSchool, user?.schoolName])

  // Support ?school= from Schools page "View repairs →" link
  useEffect(() => {
    if (isSchool) return // school role has fixed filter
    const params = new URLSearchParams(location.search)
    const school = params.get('school')
    if (school) {
      setSearch(school)
      setFilter('All')
      setYearFilter('All')
      setPage(1)
    }
  }, [location.search])

  async function fetchRepairs() {
    setLoading(true)
    setError(null)
    try {
      const data = await getRepairs()
      setRepairs(data.repairs || [])
    } catch {
      setError('Could not load repairs. Check your Apps Script URL in .env.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(repair, newStatus) {
    setUpdating(repair.id)
    try {
      await updateRepair({ id: repair.id, status: newStatus })
      setRepairs((prev) =>
        prev.map((r) => (r.id === repair.id ? { ...r, status: newStatus } : r))
      )
    } catch {
      alert('Failed to update status.')
    } finally {
      setUpdating(null)
    }
  }

  const years = ['All', ...new Set(
    repairs.map((r) => r.dateReceived?.slice(0, 4)).filter(Boolean)
  ).values()].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : b.localeCompare(a)))

  const filtered = repairs.filter((r) => {
    const matchStatus = filter === 'All' || r.status === filter
    const matchYear = yearFilter === 'All' || r.dateReceived?.startsWith(yearFilter)
    const combined = [r.referenceNumber, r.schoolName, r.technician, r.problemIdentified]
      .map((v) => (v || '').toString().trim())
      .join(' ')
      .toLowerCase()
    const q = search.toLowerCase().trim()
    const STOP = new Set(['secondary', 'school', 'primary', 'technical', 'vocational', 'college', 'institute', 'high', 'junior'])
    const sigWords = q.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w))
    const matchSearch =
      search === '' ||
      combined.includes(q) ||
      (sigWords.length > 0 && sigWords.every((w) => combined.includes(w)))
    return matchStatus && matchYear && matchSearch
  })

  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const counts = STATUSES.slice(1).reduce((acc, s) => {
    acc[s] = repairs.filter((r) => r.status === s).length
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {isSchool ? `Repairs — ${user.schoolName}` : 'Repair Dashboard'}
          </h1>
          {isSchool && <p className="text-xs text-gray-500 mt-0.5">Read-only view of your school's repairs</p>}
        </div>
        {!isSchool && (
          <Link to="/intake" className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 whitespace-nowrap">
            + Log New Repair
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {STATUSES.slice(1).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg border p-3 text-left transition ${
              filter === s ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-800">{counts[s] ?? 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </button>
        ))}
      </div>

      {/* School filter banner (not shown for school role — they always see their school) */}
      {!isSchool && new URLSearchParams(location.search).get('school') && (
        <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800">
          <span>Showing repairs for: <strong>{new URLSearchParams(location.search).get('school')}</strong></span>
          <button
            onClick={() => { setSearch(''); window.history.replaceState(null, '', window.location.pathname) }}
            className="ml-auto text-blue-500 hover:text-blue-800 font-bold"
          >
            × Clear
          </button>
        </div>
      )}

      {/* Filters — hidden for school role */}
      {!isSchool && <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by school, device, technician..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                filter === s
                  ? 'bg-blue-700 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading repairs...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No repairs found.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {visible.map((r) => (
              <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-blue-700 font-semibold">{r.referenceNumber}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-sm font-medium text-gray-800 mb-0.5">{r.schoolName}</div>
                <div className="text-xs text-gray-500 mb-2 truncate">{r.problemIdentified}</div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                  <span>{r.dateReceived}</span>
                  <span>{r.technician || '—'}</span>
                </div>
                {!isSchool && (
                  <div className="mt-3">
                    <select
                      value={r.status}
                      disabled={updating === r.id}
                      onChange={(e) => handleStatusChange(r, e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    >
                      {STATUSES.slice(1).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm bg-white">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Device ID', 'School', 'Problem', 'Received', 'Technician', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-blue-700 whitespace-nowrap">{r.referenceNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.schoolName}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={r.problemIdentified}>{r.problemIdentified}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{r.dateReceived}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.technician || '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">
                      {!isSchool && (
                        <select
                          value={r.status}
                          disabled={updating === r.id}
                          onChange={(e) => handleStatusChange(r, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                        >
                          {STATUSES.slice(1).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}
    </div>
  )
}
