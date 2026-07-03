import { useEffect, useState, Fragment } from 'react'
import { getSpareLaptops, addSpareLaptop, getDeployments, logDeployment, getSchools, addRepair } from '../services/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../contexts/AuthContext'

const PER_PAGE = 20

const emptyLaptop = {
  idNumber: '', manufacturer: 'Dell', model: '', cpu: '', cpuClass: '',
  memHd: '', comments: '', location: '', donor: '', date: '',
}
const emptyDeploy = {
  action: 'Deployed', school: '', takenBy: '', notes: '',
  date: new Date().toISOString().slice(0, 10),
  problemIdentified: '', otherProblem: '',
}

const REPAIR_PROBLEMS = [
  'CMOS battery', 'Overheating', 'No display', 'RAM issue', 'Keyboard/keys missing',
  'Touchpad not working', 'Power button', 'Hard drive', 'Battery issue', 'Screen damage',
  'Boot issue', 'Other',
]

export default function SpareLaptops() {
  const [laptops, setLaptops] = useState([])
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('laptops') // 'laptops' | 'history'
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyLaptop)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(null) // laptop being deployed/returned
  const [deployForm, setDeployForm] = useState(emptyDeploy)
  const [deployError, setDeployError] = useState(null)
  const [schools, setSchools] = useState([])
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'technician'
  const [page, setPage] = useState(1)
  const [historyYearFilter, setHistoryYearFilter] = useState('All')
  const [historyMonthFilter, setHistoryMonthFilter] = useState('All')
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [lapData, depData, schoolData] = await Promise.all([getSpareLaptops(), getDeployments(), getSchools()])
      setLaptops(lapData.laptops || [])
      setDeployments(depData.deployments || [])
      setSchools([...new Set((schoolData.schools || []).filter((s) => s.status === 'Active').map((s) => s.name))].sort())
    } catch {
      setError('Could not load spare laptops.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addSpareLaptop(form)
      setForm(emptyLaptop)
      setShowForm(false)
      fetchAll()
    } catch {
      alert('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeploy(e) {
    e.preventDefault()
    setDeployError(null)
    setSaving(true)
    try {
      const res = await logDeployment({
        laptopId: deploying.id,
        idNumber: deploying.idNumber,
        action: deployForm.action,
        school: deployForm.school || deploying.location,
        takenBy: deployForm.takenBy,
        notes: deployForm.notes,
        date: deployForm.date,
      })
      if (res.error) { setDeployError(res.error); return }

      // If returning from a school with a problem identified → also log repair intake
      if (deployForm.action === 'Returned' && deployForm.problemIdentified && !isInWarehouse(deploying)) {
        const problem = deployForm.problemIdentified === 'Other'
          ? deployForm.otherProblem
          : deployForm.problemIdentified
        await addRepair({
          laptopIdNumber: deploying.idNumber,
          referenceNumber: deploying.idNumber,
          model: [deploying.manufacturer, deploying.model].filter(Boolean).join(' '),
          schoolName: deploying.location,
          receivedBy: deployForm.takenBy,
          problemIdentified: problem,
          dateReceived: deployForm.date,
          status: 'Received',
          remarks: deployForm.notes || '',
        })
      }

      setLaptops((prev) => prev.map((l) =>
        l.id === deploying.id ? { ...l, location: res.newLocation } : l
      ))
      setDeployments((prev) => [{
        date: deployForm.date,
        idNumber: deploying.idNumber,
        action: deployForm.action,
        school: deployForm.school || deploying.location,
        takenBy: deployForm.takenBy,
        notes: deployForm.notes,
      }, ...prev])
      setDeploying(null)
      setDeployForm(emptyDeploy)
    } catch {
      setDeployError('Failed to log deployment.')
    } finally {
      setSaving(false)
    }
  }

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const setDep = (f) => (e) => setDeployForm((p) => ({ ...p, [f]: e.target.value }))

  const isInWarehouse = (l) => !l.location || l.location.toLowerCase().includes('spare') ||
    l.location.toLowerCase().includes('warehouse') || l.location.toLowerCase().includes('box')

  const locationOptions = ['All', 'In Warehouse', 'Deployed']

  const filtered = laptops.filter((l) => {
    const matchLoc = locationFilter === 'All' ||
      (locationFilter === 'In Warehouse' && isInWarehouse(l)) ||
      (locationFilter === 'Deployed' && !isInWarehouse(l))
    const matchSearch = search === '' ||
      [l.idNumber, l.model, l.manufacturer, l.comments, l.location].join(' ')
        .toLowerCase().includes(search.toLowerCase())
    return matchLoc && matchSearch
  })

  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const historyYears = ['All', ...new Set(
    deployments.map((d) => d.date?.slice(0, 4)).filter(Boolean)
  )].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : b.localeCompare(a)))

  const historyAvailableMonths = historyYearFilter === 'All' ? [] : [
    ...new Set(
      deployments
        .filter((d) => d.date?.startsWith(historyYearFilter))
        .map((d) => d.date?.slice(5, 7))
        .filter(Boolean)
    )
  ].sort()

  const filteredHistory = deployments.filter((d) => {
    const matchYear = historyYearFilter === 'All' || d.date?.startsWith(historyYearFilter)
    const matchMonth = historyMonthFilter === 'All' || d.date?.slice(5, 7) === historyMonthFilter
    const matchSearch = search === '' ||
      [d.idNumber, d.school, d.takenBy, d.action].join(' ').toLowerCase().includes(search.toLowerCase())
    return matchYear && matchMonth && matchSearch
  })
  const visibleHistory = filteredHistory.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE)

  const counts = {
    'In Warehouse': laptops.filter(isInWarehouse).length,
    'Deployed': laptops.filter((l) => !isInWarehouse(l)).length,
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Spare Laptops</h1>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ Add Spare Laptop'}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-bold text-gray-800">{laptops.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">{counts['In Warehouse']}</div>
          <div className="text-xs text-green-600 mt-0.5">In Warehouse</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{counts['Deployed']}</div>
          <div className="text-xs text-blue-600 mt-0.5">Deployed</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-bold text-gray-800">{deployments.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Movements</div>
        </div>
      </div>

      {/* Add laptop form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['idNumber', 'ID Number', 'AS-xxx'],
            ['manufacturer', 'Manufacturer', 'Dell'],
            ['model', 'Model', 'E7240'],
            ['cpu', 'CPU', 'i5'],
            ['cpuClass', 'CPU Class', 'i-series'],
            ['memHd', 'Mem/HD', '4+4'],
            ['location', 'Location / Box', 'Spares (Box Z)'],
            ['donor', 'Donor', '22-001'],
            ['date', 'Batch', '2023B'],
          ].map(([field, label, placeholder]) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <input type="text" value={form[field]} onChange={set(field)} placeholder={placeholder}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Comments / Known Issues</label>
            <input type="text" value={form.comments} onChange={set('comments')}
              placeholder="e.g. No battery, touchpad flaky"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <button type="submit" disabled={saving}
              className="bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Laptop'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[['laptops', 'Spare Laptops'], ['history', 'Deployment History']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
            {key === 'history' && deployments.length > 0 &&
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{deployments.length}</span>
            }
          </button>
        ))}
      </div>

      {/* Search + location filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text"
          placeholder={tab === 'laptops' ? 'Search by ID, model, location...' : 'Search history...'}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {tab === 'laptops' && (
          <div className="flex gap-1">
            {locationOptions.map((f) => (
              <button key={f} onClick={() => { setLocationFilter(f); setPage(1) }}
                className={`px-3 py-2 rounded text-xs font-medium transition whitespace-nowrap ${
                  locationFilter === f ? 'bg-blue-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
                }`}>
                {f}
              </button>
            ))}
          </div>
        )}
        {tab === 'history' && (
          <>
            <select value={historyYearFilter}
              onChange={(e) => { setHistoryYearFilter(e.target.value); setHistoryMonthFilter('All'); setHistoryPage(1) }}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {historyYears.map((y) => <option key={y}>{y}</option>)}
            </select>
            {historyYearFilter !== 'All' && historyAvailableMonths.length > 0 && (
              <select value={historyMonthFilter}
                onChange={(e) => { setHistoryMonthFilter(e.target.value); setHistoryPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="All">All months</option>
                {historyAvailableMonths.map((m) => (
                  <option key={m} value={m}>{MONTHS[parseInt(m, 10) - 1]}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : tab === 'laptops' && filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No spare laptops found.</div>
      ) : tab === 'laptops' ? (

        /* ── LAPTOP TABLE ── */
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID Number', 'Model', 'CPU', 'Mem/HD', 'Location', 'Comments', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((l) => (
                <Fragment key={l.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-blue-700 font-semibold whitespace-nowrap">{l.idNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.manufacturer} {l.model}</td>
                    <td className="px-3 py-2 text-gray-600">{l.cpu}</td>
                    <td className="px-3 py-2 text-gray-600">{l.memHd}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isInWarehouse(l)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {l.location || 'Warehouse'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate" title={l.comments}>{l.comments || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {canEdit && <button
                        onClick={() => {
                          setDeploying(l)
                          setDeployForm({ ...emptyDeploy, action: isInWarehouse(l) ? 'Deployed' : 'Returned' })
                          setDeployError(null)
                        }}
                        className={`text-xs px-2 py-1 rounded font-medium border ${
                          isInWarehouse(l)
                            ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                            : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {isInWarehouse(l) ? 'Deploy →' : '← Return'}
                      </button>}
                    </td>
                  </tr>

                  {/* Inline deploy/return form */}
                  {deploying?.id === l.id && (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 bg-blue-50 border-b border-blue-200">
                        <form onSubmit={handleDeploy} className="flex flex-wrap gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Action</label>
                            <select value={deployForm.action} onChange={setDep('action')}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                              <option>Deployed</option>
                              <option>Returned</option>
                            </select>
                          </div>
                          {deployForm.action === 'Deployed' && (
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600">School / Destination <span className="text-red-500">*</span></label>
                              <input type="text" list="deploy-school-list" value={deployForm.school} onChange={setDep('school')}
                                required placeholder="Type or pick a school"
                                className="w-44 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              <datalist id="deploy-school-list">
                                {schools.map((name) => <option key={name} value={name} />)}
                              </datalist>
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Received/Handled by <span className="text-red-500">*</span></label>
                            <input type="text" value={deployForm.takenBy} onChange={setDep('takenBy')}
                              required placeholder="Name"
                              className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Date</label>
                            <input type="date" value={deployForm.date} onChange={setDep('date')}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          {/* Repair fields — shown when returning a school laptop */}
                          {deployForm.action === 'Returned' && !isInWarehouse(deploying) && (
                            <>
                              <div className="w-full border-t border-blue-200 pt-2 mt-1">
                                <span className="text-xs font-semibold text-blue-700">Log repair intake at the same time:</span>
                              </div>
                              <div className="flex flex-col gap-1 min-w-44">
                                <label className="text-xs font-medium text-gray-600">Problem identified</label>
                                <select value={deployForm.problemIdentified} onChange={setDep('problemIdentified')}
                                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                                  <option value="">— skip repair log —</option>
                                  {REPAIR_PROBLEMS.map((p) => <option key={p}>{p}</option>)}
                                </select>
                              </div>
                              {deployForm.problemIdentified === 'Other' && (
                                <div className="flex flex-col gap-1 flex-1 min-w-40">
                                  <label className="text-xs font-medium text-gray-600">Describe problem</label>
                                  <input type="text" value={deployForm.otherProblem} onChange={setDep('otherProblem')}
                                    placeholder="Describe the issue..."
                                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex flex-col gap-1 flex-1 min-w-32">
                            <label className="text-xs font-medium text-gray-600">Notes</label>
                            <input type="text" value={deployForm.notes} onChange={setDep('notes')}
                              placeholder="Optional"
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div className="flex gap-2 items-end pb-0.5">
                            <button type="submit" disabled={saving}
                              className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
                              {saving ? '...' : 'Confirm'}
                            </button>
                            <button type="button" onClick={() => setDeploying(null)}
                              className="text-gray-400 text-sm hover:underline">Cancel</button>
                          </div>
                        </form>
                        {deployError && <p className="mt-2 text-xs text-red-600">{deployError}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>

      ) : (

        /* ── DEPLOYMENT HISTORY ── */
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Laptop ID', 'Action', 'School', 'Handled By', 'Notes'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleHistory.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No deployments recorded yet.</td></tr>
              ) : visibleHistory.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-700 font-semibold">{d.idNumber}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.action === 'Returned' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {d.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">{d.school || '—'}</td>
                  <td className="px-3 py-2">{d.takenBy}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{d.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={historyPage} total={filteredHistory.length} perPage={PER_PAGE} onChange={setHistoryPage} />
        </>
      )}
    </div>
  )
}
