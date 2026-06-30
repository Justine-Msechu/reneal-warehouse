import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSchools, addSchool, updateSchool } from '../services/api'
import Pagination from '../components/Pagination'

const PER_PAGE = 25

const empty = {
  name: '', district: '', region: '', laptopCount: '', activatedDate: '', notes: '',
}

const DISTRICTS = [
  'Arusha DC', 'Arusha CC', 'Meru DC', 'Monduli DC', 'Longido DC',
  'Ngorongoro DC', 'Karatu DC', 'Arumeru DC',
]

export default function Schools() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('Active')
  const [regionFilter, setRegionFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(null) // school being deactivated
  const [deactivateReason, setDeactivateReason] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchSchools() }, [])

  async function fetchSchools() {
    setLoading(true)
    setError(null)
    try {
      const data = await getSchools()
      setSchools(data.schools || [])
    } catch {
      setError('Could not load schools.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addSchool(form)
      setForm(empty)
      setShowForm(false)
      fetchSchools()
    } catch {
      alert('Failed to save school.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(school) {
    if (!deactivateReason.trim()) { alert('Please enter a reason.'); return }
    setSaving(true)
    try {
      await updateSchool({
        id: school.id,
        status: 'Deactivated',
        deactivatedDate: new Date().toISOString().slice(0, 10),
        deactivatedReason: deactivateReason,
      })
      setDeactivating(null)
      setDeactivateReason('')
      fetchSchools()
    } catch {
      alert('Failed to deactivate school.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate(school) {
    if (!confirm(`Reactivate ${school.name}?`)) return
    try {
      await updateSchool({ id: school.id, status: 'Active', deactivatedDate: '', deactivatedReason: '' })
      fetchSchools()
    } catch {
      alert('Failed to reactivate.')
    }
  }

  async function handleLaptopCount(school, count) {
    try {
      await updateSchool({ id: school.id, laptopCount: count })
      setSchools((prev) => prev.map((s) => s.id === school.id ? { ...s, laptopCount: count } : s))
    } catch {
      alert('Failed to update laptop count.')
    }
  }

  const set = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))

  const regions = ['All', ...new Set(schools.map((s) => s.region).filter(Boolean)).values()].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b))

  const filtered = schools.filter((s) => {
    const matchFilter = filter === 'All' || s.status === filter
    const matchRegion = regionFilter === 'All' || s.region === regionFilter
    const matchSearch = search === '' ||
      [s.name, s.district, s.region].join(' ').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchRegion && matchSearch
  })

  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const counts = {
    All: schools.length,
    Active: schools.filter((s) => s.status === 'Active').length,
    Deactivated: schools.filter((s) => s.status === 'Deactivated').length,
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Schools</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 whitespace-nowrap"
        >
          {showForm ? 'Cancel' : '+ Add School'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {['All', 'Active', 'Deactivated'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border p-3 text-left transition ${
              filter === f ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-800">{counts[f]}</div>
            <div className="text-xs text-gray-500 mt-0.5">{f}</div>
          </button>
        ))}
      </div>

      {/* Add school form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['name', 'School Name', 'e.g. Mlangarini SS', true],
            ['district', 'District', 'e.g. Arusha DC', false],
            ['region', 'Region', 'e.g. Arusha', false],
            ['laptopCount', 'Number of Laptops', '0', false],
            ['activatedDate', 'Date Activated', '', false],
          ].map(([field, label, placeholder, required]) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={field === 'activatedDate' ? 'date' : field === 'laptopCount' ? 'number' : 'text'}
                value={form[field]}
                onChange={set(field)}
                placeholder={placeholder}
                required={required}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any extra info about this school"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add School'}
            </button>
          </div>
        </form>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, district, region..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={regionFilter}
          onChange={(e) => { setRegionFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {regions.map((r) => (
            <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {['All', 'Active', 'Deactivated'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-2 rounded text-xs font-medium transition ${
                filter === f ? 'bg-blue-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading schools...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No schools found.</div>
      ) : (
        <>
        <div className="space-y-3">
          {visible.map((school) => (
            <div key={school.id} className={`bg-white rounded-lg border p-4 ${
              school.status === 'Deactivated' ? 'border-red-200 bg-red-50' : 'border-gray-200'
            }`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{school.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      school.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {school.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                    {school.district && <span>{school.district}</span>}
                    {school.region && <span>{school.region}</span>}
                    {school.activatedDate && <span>Activated: {school.activatedDate}</span>}
                  </div>
                  {school.status === 'Deactivated' && school.deactivatedReason && (
                    <div className="mt-1 text-xs text-red-600">
                      Deactivated {school.deactivatedDate}: {school.deactivatedReason}
                    </div>
                  )}
                  {school.notes && (
                    <div className="mt-1 text-xs text-gray-400">{school.notes}</div>
                  )}
                </div>

                {/* Laptop count */}
                <LaptopCounter school={school} onSave={handleLaptopCount} />
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => navigate(`/?school=${encodeURIComponent(school.name)}`)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  View repairs →
                </button>
                {school.status === 'Active' ? (
                  <button
                    onClick={() => { setDeactivating(school); setDeactivateReason('') }}
                    className="text-red-500 hover:underline"
                  >
                    Deactivate lab
                  </button>
                ) : (
                  <button onClick={() => handleReactivate(school)} className="text-green-600 hover:underline">
                    Reactivate lab
                  </button>
                )}
              </div>

              {/* Deactivate form inline */}
              {deactivating?.id === school.id && (
                <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Reason for deactivation..."
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    className="border border-red-300 rounded px-2 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={() => handleDeactivate(school)}
                    disabled={saving}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeactivating(null)}
                    className="text-gray-400 text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}
    </div>
  )
}

function LaptopCounter({ school, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(school.laptopCount)

  function save() {
    onSave(school, val)
    setEditing(false)
  }

  return (
    <div className="flex flex-col items-center bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 min-w-[80px]">
      <div className="text-xs text-gray-500 mb-1">Laptops</div>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-14 border border-gray-300 rounded px-1 py-0.5 text-sm text-center"
          />
          <button onClick={save} className="text-green-600 text-xs font-medium">✓</button>
          <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setVal(school.laptopCount) }} className="text-center">
          <div className="text-2xl font-bold text-blue-700">{school.laptopCount || 0}</div>
          <div className="text-xs text-blue-400 hover:underline">edit</div>
        </button>
      )}
    </div>
  )
}
