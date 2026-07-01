import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { getRepairs, updateRepair, getSpareLaptops, logDeployment } from '../services/api'
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
  const [monthFilter, setMonthFilter] = useState('All')
  const [updating, setUpdating] = useState(null)
  const [page, setPage] = useState(1)
  const [redeploying, setRedeploying] = useState(null) // repair.id showing re-deploy form
  const [redeployForm, setRedeployForm] = useState({ takenBy: '', date: new Date().toISOString().slice(0, 10) })
  const [redeployError, setRedeployError] = useState(null)
  const [redeployLoading, setRedeployLoading] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'technician'

  useEffect(() => {
    fetchRepairs()
  }, [])

  // Support ?school= from Schools page "View repairs →" link
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const school = params.get('school')
    if (school) {
      setSearch(school)
      setFilter('All')
      setYearFilter('All')
      setMonthFilter('All')
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

  async function handleRedeploy(repair) {
    if (!redeployForm.takenBy.trim()) { setRedeployError('Please enter a name.'); return }
    setRedeployLoading(true)
    setRedeployError(null)
    try {
      const lapData = await getSpareLaptops()
      const laptop = (lapData.laptops || []).find((l) => l.idNumber === repair.laptopIdNumber)
      if (!laptop) {
        setRedeployError(`Laptop ${repair.laptopIdNumber} not found in Spare Laptops.`)
        return
      }
      await logDeployment({
        laptopId: laptop.id,
        idNumber: laptop.idNumber,
        action: 'Deployed',
        school: repair.schoolName,
        takenBy: redeployForm.takenBy,
        date: redeployForm.date,
        notes: `Returned to school after repair (Ref: ${repair.referenceNumber})`,
      })
      await updateRepair({
        id: repair.id,
        status: 'Returned',
        dateReturnedToSchool: redeployForm.date,
        pickedUpBy: redeployForm.takenBy,
      })
      setRepairs((prev) => prev.map((r) =>
        r.id === repair.id ? { ...r, status: 'Returned', dateReturnedToSchool: redeployForm.date } : r
      ))
      setRedeploying(null)
      setRedeployForm({ takenBy: '', date: new Date().toISOString().slice(0, 10) })
    } catch {
      setRedeployError('Failed to re-deploy. Try again.')
    } finally {
      setRedeployLoading(false)
    }
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const years = ['All', ...new Set(
    repairs.map((r) => r.dateReceived?.slice(0, 4)).filter(Boolean)
  ).values()].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : b.localeCompare(a)))

  // Only show months that have repairs in the selected year
  const availableMonths = yearFilter === 'All' ? [] : [
    ...new Set(
      repairs
        .filter((r) => r.dateReceived?.startsWith(yearFilter))
        .map((r) => r.dateReceived?.slice(5, 7))
        .filter(Boolean)
    )
  ].sort()

  const filtered = repairs.filter((r) => {
    const matchStatus = filter === 'All' || r.status === filter
    const matchYear = yearFilter === 'All' || r.dateReceived?.startsWith(yearFilter)
    const matchMonth = monthFilter === 'All' || r.dateReceived?.slice(5, 7) === monthFilter
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
    return matchStatus && matchYear && matchMonth && matchSearch
  })

  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const counts = STATUSES.slice(1).reduce((acc, s) => {
    acc[s] = repairs.filter((r) => r.status === s).length
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Repair Dashboard</h1>
        {canEdit && (
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

      {new URLSearchParams(location.search).get('school') && (
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

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by school, device, technician..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setMonthFilter('All'); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        {yearFilter !== 'All' && availableMonths.length > 0 && (
          <select
            value={monthFilter}
            onChange={(e) => { setMonthFilter(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="All">All months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{MONTHS[parseInt(m, 10) - 1]}</option>
            ))}
          </select>
        )}
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
      </div>

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
                  <div>
                    <span className="font-mono text-xs text-blue-700 font-semibold">{r.referenceNumber}</span>
                    {r.laptopIdNumber && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">{r.laptopIdNumber}</span>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-sm font-medium text-gray-800 mb-0.5">{r.schoolName}</div>
                <div className="text-xs text-gray-500 mb-2 truncate">{r.problemIdentified}</div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                  <span>{r.dateReceived}</span>
                  <span>{r.technician || '—'}</span>
                </div>
                {canEdit && (
                  <div className="mt-3 space-y-2">
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
                    {r.laptopIdNumber && (r.status === 'Fixed' || r.status === 'Returned') && r.status !== 'Returned' && (
                      <button
                        onClick={() => { setRedeploying(r.id); setRedeployError(null) }}
                        className="w-full text-xs px-2 py-1.5 rounded border border-green-300 bg-green-50 text-green-700 font-medium hover:bg-green-100"
                      >
                        Re-deploy {r.laptopIdNumber} → {r.schoolName}
                      </button>
                    )}
                    {redeploying === r.id && (
                      <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                        <div className="text-xs font-semibold text-green-700">Send laptop back to school</div>
                        <input value={redeployForm.takenBy}
                          onChange={(e) => setRedeployForm(f => ({ ...f, takenBy: e.target.value }))}
                          placeholder="Handled by *"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                        <input type="date" value={redeployForm.date}
                          onChange={(e) => setRedeployForm(f => ({ ...f, date: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                        {redeployError && <p className="text-xs text-red-600">{redeployError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => handleRedeploy(r)} disabled={redeployLoading}
                            className="flex-1 bg-green-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                            {redeployLoading ? '...' : 'Confirm Re-deploy'}
                          </button>
                          <button onClick={() => setRedeploying(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </div>
                      </div>
                    )}
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
                  <>
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-mono text-xs text-blue-700 font-semibold">{r.referenceNumber}</div>
                      {r.laptopIdNumber && (
                        <div className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">{r.laptopIdNumber}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.schoolName}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={r.problemIdentified}>{r.problemIdentified}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{r.dateReceived}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.technician || '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {canEdit && (
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
                        {canEdit && r.laptopIdNumber && r.status === 'Fixed' && (
                          <button
                            onClick={() => { setRedeploying(r.id); setRedeployError(null) }}
                            className="text-xs px-2 py-1 rounded border border-green-300 bg-green-50 text-green-700 font-medium hover:bg-green-100 whitespace-nowrap"
                          >
                            Re-deploy →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {redeploying === r.id && (
                    <tr key={r.id + '-redeploy'}>
                      <td colSpan={7} className="px-3 py-3 bg-green-50 border-b border-green-200">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <div className="text-xs font-semibold text-green-700 mb-1">
                              Re-deploy {r.laptopIdNumber} → {r.schoolName}
                            </div>
                            <div className="text-xs text-green-600">This will send the laptop back to the school and mark the repair as Returned.</div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Handled by *</label>
                            <input value={redeployForm.takenBy}
                              onChange={(e) => setRedeployForm(f => ({ ...f, takenBy: e.target.value }))}
                              placeholder="Name"
                              className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Date</label>
                            <input type="date" value={redeployForm.date}
                              onChange={(e) => setRedeployForm(f => ({ ...f, date: e.target.value }))}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                          </div>
                          <div className="flex gap-2 items-end pb-0.5">
                            <button onClick={() => handleRedeploy(r)} disabled={redeployLoading}
                              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                              {redeployLoading ? '...' : 'Confirm'}
                            </button>
                            <button onClick={() => setRedeploying(null)} className="text-gray-400 text-sm hover:underline">Cancel</button>
                          </div>
                          {redeployError && <p className="text-xs text-red-600 w-full">{redeployError}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
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
