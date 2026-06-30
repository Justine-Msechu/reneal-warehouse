import { useEffect, useState } from 'react'
import { getInventory, addInventoryItem, updateInventoryItem, getWithdrawals, logWithdrawal, getSchools } from '../services/api'

const emptyItem = { boxName: '', item: '', quantity: '', description: '' }
const emptyOut = { quantityTaken: '', takenBy: '', destination: '', notes: '', date: new Date().toISOString().slice(0, 10) }

export default function WarehouseInventory() {
  const [items, setItems] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('inventory') // 'inventory' | 'history'
  const [search, setSearch] = useState('')
  const [boxFilter, setBoxFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)
  const [takingOut, setTakingOut] = useState(null) // item being taken out
  const [outForm, setOutForm] = useState(emptyOut)
  const [outError, setOutError] = useState(null)
  const [schools, setSchools] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [invData, wData, schoolData] = await Promise.all([getInventory(), getWithdrawals(), getSchools()])
      setItems(invData.items || [])
      setWithdrawals(wData.withdrawals || [])
      setSchools((schoolData.schools || []).filter((s) => s.status === 'Active').map((s) => s.name).sort())
    } catch {
      setError('Could not load warehouse data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addInventoryItem(form)
      setForm(emptyItem)
      setShowForm(false)
      fetchAll()
    } catch {
      alert('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTakeOut(e) {
    e.preventDefault()
    setOutError(null)
    setSaving(true)
    try {
      const res = await logWithdrawal({
        itemId: takingOut.id,
        boxName: takingOut.boxName,
        item: takingOut.item,
        ...outForm,
      })
      if (res.error) { setOutError(res.error); return }
      setItems((prev) => prev.map((i) =>
        i.id === takingOut.id ? { ...i, quantity: String(res.remaining) } : i
      ))
      setWithdrawals((prev) => [{
        date: outForm.date,
        boxName: takingOut.boxName,
        item: takingOut.item,
        quantityTaken: outForm.quantityTaken,
        remainingQty: res.remaining,
        takenBy: outForm.takenBy,
        destination: outForm.destination,
        notes: outForm.notes,
      }, ...prev])
      setTakingOut(null)
      setOutForm(emptyOut)
    } catch {
      setOutError('Failed to log withdrawal.')
    } finally {
      setSaving(false)
    }
  }

  const setField = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const setOut = (f) => (e) => setOutForm((p) => ({ ...p, [f]: e.target.value }))

  const boxes = ['All', ...new Set(items.map((i) => i.boxName).filter(Boolean))]

  const visible = items.filter((i) => {
    const matchBox = boxFilter === 'All' || i.boxName === boxFilter
    const matchSearch = search === '' ||
      [i.boxName, i.item, i.description].join(' ').toLowerCase().includes(search.toLowerCase())
    return matchBox && matchSearch
  })

  const visibleHistory = withdrawals.filter((w) =>
    search === '' ||
    [w.item, w.boxName, w.takenBy, w.destination].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Warehouse Inventory</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 whitespace-nowrap"
        >
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Add item form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-5 mb-5 grid grid-cols-2 gap-3">
          {[
            ['boxName', 'Box Name', 'BOX C'],
            ['item', 'Equipment / Item', 'LAPTOP RAM'],
            ['quantity', 'Quantity', '11'],
            ['description', 'Description', 'DDR3 4GB sticks'],
          ].map(([field, label, placeholder]) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <input
                type="text"
                value={form[field]}
                onChange={setField(field)}
                placeholder={placeholder}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[['inventory', 'Stock'], ['history', 'Withdrawal History']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {key === 'history' && withdrawals.length > 0 &&
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{withdrawals.length}</span>
            }
          </button>
        ))}
      </div>

      {/* Search + box filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder={tab === 'inventory' ? 'Search items...' : 'Search withdrawals...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {tab === 'inventory' && (
          <select value={boxFilter} onChange={(e) => setBoxFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {boxes.map((b) => <option key={b}>{b}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : tab === 'inventory' ? (

        /* ── STOCK TABLE ── */
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Box', 'Item', 'Qty', 'Description', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No items found.</td></tr>
              ) : visible.map((item) => (
                <>
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-blue-700 whitespace-nowrap">{item.boxName}</td>
                    <td className="px-3 py-2">{item.item}</td>
                    <td className="px-3 py-2">
                      <span className={`font-semibold ${Number(item.quantity) === 0 ? 'text-red-500' : Number(item.quantity) <= 3 ? 'text-amber-500' : 'text-gray-800'}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate" title={item.description}>{item.description || '—'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => { setTakingOut(item); setOutForm(emptyOut); setOutError(null) }}
                        className="text-xs bg-amber-50 border border-amber-300 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 whitespace-nowrap font-medium"
                      >
                        Take out
                      </button>
                    </td>
                  </tr>

                  {/* Inline take-out form */}
                  {takingOut?.id === item.id && (
                    <tr key={item.id + '-out'}>
                      <td colSpan={5} className="px-3 py-3 bg-amber-50 border-b border-amber-200">
                        <form onSubmit={handleTakeOut} className="flex flex-wrap gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Qty taken <span className="text-red-500">*</span></label>
                            <input type="number" min="1" value={outForm.quantityTaken} onChange={setOut('quantityTaken')}
                              required placeholder="0"
                              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Taken by <span className="text-red-500">*</span></label>
                            <input type="text" value={outForm.takenBy} onChange={setOut('takenBy')}
                              required placeholder="Name"
                              className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Destination / School</label>
                            <input type="text" list="school-list" value={outForm.destination} onChange={setOut('destination')}
                              placeholder="Type or pick a school"
                              className="w-44 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                            <datalist id="school-list">
                              {schools.map((name) => <option key={name} value={name} />)}
                            </datalist>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Date</label>
                            <input type="date" value={outForm.date} onChange={setOut('date')}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-32">
                            <label className="text-xs font-medium text-gray-600">Notes</label>
                            <input type="text" value={outForm.notes} onChange={setOut('notes')}
                              placeholder="Optional note"
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          </div>
                          <div className="flex gap-2 items-end pb-0.5">
                            <button type="submit" disabled={saving}
                              className="bg-amber-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-60">
                              {saving ? '...' : 'Confirm'}
                            </button>
                            <button type="button" onClick={() => setTakingOut(null)}
                              className="text-gray-400 text-sm hover:underline">Cancel</button>
                          </div>
                        </form>
                        {outError && <p className="mt-2 text-xs text-red-600">{outError}</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

      ) : (

        /* ── WITHDRAWAL HISTORY ── */
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Box', 'Item', 'Qty Out', 'Remaining', 'Taken By', 'Destination', 'Notes'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleHistory.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No withdrawals recorded yet.</td></tr>
              ) : visibleHistory.map((w, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{w.date}</td>
                  <td className="px-3 py-2 text-blue-700 font-semibold whitespace-nowrap">{w.boxName}</td>
                  <td className="px-3 py-2">{w.item}</td>
                  <td className="px-3 py-2 font-semibold text-amber-700">-{w.quantityTaken}</td>
                  <td className="px-3 py-2 text-gray-600">{w.remainingQty}</td>
                  <td className="px-3 py-2">{w.takenBy}</td>
                  <td className="px-3 py-2 text-gray-600">{w.destination || '—'}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs max-w-xs truncate">{w.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
