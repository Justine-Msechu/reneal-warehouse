import { useEffect, useState, Fragment } from 'react'
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, restoreInventoryItem, deleteInventoryBox, getWithdrawals, logWithdrawal, updateWithdrawal, getSchools, getDeletedLog } from '../services/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../contexts/AuthContext'
import { LOW_STOCK_THRESHOLD } from '../../shared/constants.mjs'

const PER_PAGE = 20

const emptyItem = { boxName: '', item: '', quantity: '', description: '' }
const emptyQuickAdd = { item: '', quantity: '', description: '' }
const emptyOut = { quantityTaken: '', takenBy: '', destination: '', notes: '', date: new Date().toISOString().slice(0, 10) }

export default function WarehouseInventory() {
  const [items, setItems] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('inventory') // 'inventory' | 'history'
  const [search, setSearch] = useState('')
  const [boxFilter, setBoxFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyYearFilter, setHistoryYearFilter] = useState('All')
  const [historyMonthFilter, setHistoryMonthFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)
  const [addingToBox, setAddingToBox] = useState(null) // box name being quick-added to
  const [quickAddForm, setQuickAddForm] = useState(emptyQuickAdd)
  const [quickAddError, setQuickAddError] = useState(null)
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [takingOut, setTakingOut] = useState(null) // item being taken out
  const [outForm, setOutForm] = useState(emptyOut)
  const [outError, setOutError] = useState(null)
  const [schools, setSchools] = useState([])
  const [expandedBoxes, setExpandedBoxes] = useState(new Set())
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editingWithdrawal, setEditingWithdrawal] = useState(null)
  const [wEditForm, setWEditForm] = useState({})
  const [wEditError, setWEditError] = useState(null)
  const [wEditSaving, setWEditSaving] = useState(false)
  const [deletedLog, setDeletedLog] = useState([])
  const [deletedLogLoaded, setDeletedLogLoaded] = useState(false)
  const [deletedLogPage, setDeletedLogPage] = useState(1)
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'technician'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [invData, wData, schoolData] = await Promise.all([getInventory(), getWithdrawals(), getSchools()])
      setItems(invData.items || [])
      setWithdrawals(wData.withdrawals || [])
      setSchools([...new Set((schoolData.schools || []).filter((s) => s.status === 'Active').map((s) => s.name))].sort())
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

  function openQuickAdd(boxName) {
    setAddingToBox((prev) => (prev === boxName ? null : boxName))
    setQuickAddForm(emptyQuickAdd)
    setQuickAddError(null)
    setExpandedBoxes((prev) => new Set(prev).add(boxName))
  }

  async function handleQuickAdd(e) {
    e.preventDefault()
    if (!quickAddForm.item.trim()) { setQuickAddError('Equipment / Item is required.'); return }
    setQuickAddSaving(true)
    setQuickAddError(null)
    try {
      await addInventoryItem({ boxName: addingToBox, ...quickAddForm })
      setAddingToBox(null)
      setQuickAddForm(emptyQuickAdd)
      fetchAll()
    } catch {
      setQuickAddError('Failed to save.')
    } finally {
      setQuickAddSaving(false)
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
  const setQuick = (f) => (e) => setQuickAddForm((p) => ({ ...p, [f]: e.target.value }))

  function openEdit(item) {
    setEditingItem(item)
    setEditError(null)
    setEditForm({
      boxName: item.boxName || '',
      item: item.item || '',
      quantity: item.quantity ?? '',
      description: item.description || '',
    })
  }

  async function handleEditSave(e) {
    e.preventDefault()
    if (!editForm.boxName.trim() || !editForm.item.trim()) {
      setEditError('Box Name and Equipment/Item are required.')
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      await updateInventoryItem({ id: editingItem.id, ...editForm })
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...editForm } : i)))
      setEditingItem(null)
    } catch (err) {
      setEditError(err.message === 'Unauthorized' ? 'Your session has expired. Please sign in again.' : `Failed to save: ${err.message}`)
    } finally {
      setEditSaving(false)
    }
  }

  async function loadDeletedLog() {
    try {
      const data = await getDeletedLog()
      setDeletedLog(data.log || [])
      setDeletedLogLoaded(true)
    } catch {}
  }

  function openTab(key) {
    setTab(key)
    if (key === 'deletedLog' && !deletedLogLoaded) loadDeletedLog()
  }

  async function handleRestore(d) {
    if (!d.itemId) { alert('This entry predates the restore feature and can\'t be restored automatically — re-add it manually.'); return }
    if (!confirm(`Restore "${d.item}" (qty ${d.quantity}) into box "${d.boxName}"?`)) return
    try {
      const res = await restoreInventoryItem(d.itemId)
      if (res.error) { alert(res.error); return }
      if (!res.restored) { alert('Already restored.'); return }
      fetchAll()
    } catch (err) {
      alert(err.message === 'Unauthorized' ? 'Your session has expired. Please sign in again.' : `Failed to restore: ${err.message}`)
    }
  }

  async function handleDeleteItem(item) {
    if (!confirm(`Delete "${item.item}" from ${item.boxName}? This cannot be undone.`)) return
    try {
      await deleteInventoryItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      if (deletedLogLoaded) loadDeletedLog()
    } catch (err) {
      alert(err.message === 'Unauthorized' ? 'Your session has expired. Please sign in again.' : `Failed to delete: ${err.message}`)
    }
  }

  async function handleDeleteBox(boxId, boxName, count) {
    if (!confirm(`Delete box "${boxName}" and all ${count} item(s) in it? This cannot be undone.`)) return
    try {
      await deleteInventoryBox(boxId)
      setItems((prev) => prev.filter((i) => i.boxId !== boxId))
      if (deletedLogLoaded) loadDeletedLog()
    } catch (err) {
      alert(err.message === 'Unauthorized' ? 'Your session has expired. Please sign in again.' : `Failed to delete: ${err.message}`)
    }
  }

  function openWithdrawalEdit(w) {
    setEditingWithdrawal(w)
    setWEditError(null)
    setWEditForm({
      date: w.date || '',
      takenBy: w.takenBy || '',
      destination: w.destination || '',
      notes: w.notes || '',
    })
  }

  async function handleWithdrawalEditSave(e) {
    e.preventDefault()
    if (!wEditForm.takenBy.trim()) { setWEditError('Taken by is required.'); return }
    setWEditSaving(true)
    setWEditError(null)
    try {
      await updateWithdrawal({ id: editingWithdrawal.id, ...wEditForm })
      setWithdrawals((prev) => prev.map((w) => (w.id === editingWithdrawal.id ? { ...w, ...wEditForm } : w)))
      setEditingWithdrawal(null)
    } catch (err) {
      setWEditError(err.message === 'Unauthorized' ? 'Your session has expired. Please sign in again.' : `Failed to save: ${err.message}`)
    } finally {
      setWEditSaving(false)
    }
  }

  function toggleBox(boxName) {
    setExpandedBoxes((prev) => {
      const next = new Set(prev)
      next.has(boxName) ? next.delete(boxName) : next.add(boxName)
      return next
    })
  }

  const boxes = ['All', ...new Set(items.map((i) => i.boxName).filter(Boolean))]

  const filtered = items.filter((i) => {
    const matchBox = boxFilter === 'All' || i.boxName === boxFilter
    const matchSearch = search === '' ||
      [i.boxName, i.item, i.description].join(' ').toLowerCase().includes(search.toLowerCase())
    return matchBox && matchSearch
  })
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Groups same-box items together (regardless of their original row order)
  // so the box name is shown once as a section header, not on every row.
  // Boxes are collapsed by default — but if a search or box filter is
  // active, every box still showing here necessarily contains a match
  // (filtering already happened above), so auto-expand those rather than
  // hiding results behind a collapsed header.
  const autoExpand = search.trim() !== '' || boxFilter !== 'All'
  const groupedByBox = (() => {
    const map = new Map()
    visible.forEach((item) => {
      const key = item.boxName || '(No box)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })
    return [...map.entries()].map(([boxName, boxItems]) => ({
      boxName,
      boxId: boxItems[0]?.boxId,
      boxItems,
      isExpanded: autoExpand || expandedBoxes.has(boxName),
    }))
  })()

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const historyYears = ['All', ...new Set(
    withdrawals.map((w) => w.date?.slice(0, 4)).filter(Boolean)
  )].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : b.localeCompare(a)))

  const historyAvailableMonths = historyYearFilter === 'All' ? [] : [
    ...new Set(
      withdrawals
        .filter((w) => w.date?.startsWith(historyYearFilter))
        .map((w) => w.date?.slice(5, 7))
        .filter(Boolean)
    )
  ].sort()

  const filteredHistory = withdrawals.filter((w) => {
    const matchYear = historyYearFilter === 'All' || w.date?.startsWith(historyYearFilter)
    const matchMonth = historyMonthFilter === 'All' || w.date?.slice(5, 7) === historyMonthFilter
    const matchSearch = search === '' ||
      [w.item, w.boxName, w.takenBy, w.destination].join(' ').toLowerCase().includes(search.toLowerCase())
    return matchYear && matchMonth && matchSearch
  })
  const visibleHistory = filteredHistory.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE)

  const visibleDeletedLog = deletedLog.slice((deletedLogPage - 1) * PER_PAGE, deletedLogPage * PER_PAGE)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Warehouse Inventory</h1>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800 whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ Add Item'}
          </button>
        )}
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
        {[
          ['inventory', 'Stock'],
          ['history', 'Withdrawal History'],
          ...(canEdit ? [['deletedLog', 'Deleted Log']] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => openTab(key)}
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
      {tab !== 'deletedLog' && (
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder={tab === 'inventory' ? 'Search items...' : 'Search withdrawals...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); setHistoryPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {tab === 'inventory' && (
          <select value={boxFilter} onChange={(e) => { setBoxFilter(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {boxes.map((b) => <option key={b}>{b}</option>)}
          </select>
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
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : tab === 'inventory' ? (

        /* ── STOCK TABLE ── */
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Item', 'Qty', 'Description', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No items found.</td></tr>
              ) : groupedByBox.map((group) => (
                <Fragment key={group.boxName}>
                  <tr className="bg-blue-50 hover:bg-blue-100 select-none">
                    <td colSpan={4} className="px-3 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="cursor-pointer font-bold text-blue-800 text-xs uppercase tracking-wide"
                          onClick={() => toggleBox(group.boxName)}
                        >
                          <span className="inline-block w-3">{group.isExpanded ? '▾' : '▸'}</span>
                          {' '}{group.boxName}
                          <span className="ml-2 font-normal normal-case text-blue-400">({group.boxItems.length})</span>
                        </span>
                        {canEdit && group.boxName !== '(No box)' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openQuickAdd(group.boxName)}
                              className="text-xs bg-white border border-blue-300 text-blue-700 px-2 py-1 rounded hover:bg-blue-50 whitespace-nowrap font-medium"
                            >
                              + Item
                            </button>
                            <button
                              onClick={() => handleDeleteBox(group.boxId, group.boxName, group.boxItems.length)}
                              className="text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap font-medium"
                            >
                              Delete box
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline quick-add-item form, scoped to this box */}
                  {addingToBox === group.boxName && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 bg-blue-50/60 border-b border-blue-200">
                        <form onSubmit={handleQuickAdd} className="flex flex-wrap gap-2 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Equipment / Item <span className="text-red-500">*</span></label>
                            <input type="text" value={quickAddForm.item} onChange={setQuick('item')}
                              required placeholder="LAPTOP RAM" autoFocus
                              className="w-40 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Quantity</label>
                            <input type="text" value={quickAddForm.quantity} onChange={setQuick('quantity')}
                              placeholder="11"
                              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-32">
                            <label className="text-xs font-medium text-gray-600">Description</label>
                            <input type="text" value={quickAddForm.description} onChange={setQuick('description')}
                              placeholder="Optional"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div className="flex gap-2 items-end pb-0.5">
                            <button type="submit" disabled={quickAddSaving}
                              className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
                              {quickAddSaving ? '...' : 'Add'}
                            </button>
                            <button type="button" onClick={() => setAddingToBox(null)}
                              className="text-gray-400 text-sm hover:underline">Cancel</button>
                          </div>
                        </form>
                        {quickAddError && <p className="mt-2 text-xs text-red-600">{quickAddError}</p>}
                      </td>
                    </tr>
                  )}

                  {group.isExpanded && group.boxItems.map((item) => (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2">{item.item}</td>
                        <td className="px-3 py-2">
                          <span className={`font-semibold ${Number(item.quantity) === 0 ? 'text-red-500' : Number(item.quantity) <= LOW_STOCK_THRESHOLD ? 'text-amber-500' : 'text-gray-800'}`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate" title={item.description}>{item.description || '—'}</td>
                        <td className="px-3 py-2">
                          {canEdit && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setTakingOut(item); setOutForm(emptyOut); setOutError(null) }}
                                className="text-xs bg-amber-50 border border-amber-300 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 whitespace-nowrap font-medium"
                              >
                                Take out
                              </button>
                              <button
                                onClick={() => openEdit(item)}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 whitespace-nowrap"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Inline take-out form */}
                      {takingOut?.id === item.id && (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 bg-amber-50 border-b border-amber-200">
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
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
        </>

      ) : tab === 'history' ? (

        /* ── WITHDRAWAL HISTORY ── */
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Box', 'Item', 'Qty Out', 'Remaining', 'Taken By', 'Destination', 'Notes', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleHistory.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No withdrawals recorded yet.</td></tr>
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
                  <td className="px-3 py-2">
                    {canEdit && w.id && (
                      <button onClick={() => openWithdrawalEdit(w)}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={historyPage} total={filteredHistory.length} perPage={PER_PAGE} onChange={setHistoryPage} />
        </>

      ) : (

        /* ── DELETED LOG ── */
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['When', 'Deleted By', 'Type', 'Box', 'Item', 'Qty', 'Description', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleDeletedLog.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nothing deleted yet.</td></tr>
              ) : visibleDeletedLog.map((d, i) => (
                <tr key={d.id || i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.timestamp}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{d.deletedBy}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${d.type === 'box' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {d.type === 'box' ? 'Whole box' : 'Item'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-blue-700 font-semibold whitespace-nowrap">{d.boxName}</td>
                  <td className="px-3 py-2">{d.item}</td>
                  <td className="px-3 py-2 text-gray-600">{d.quantity}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate" title={d.description}>{d.description || '—'}</td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <button
                        onClick={() => handleRestore(d)}
                        className="text-xs bg-green-50 border border-green-300 text-green-700 px-2 py-1 rounded hover:bg-green-100 whitespace-nowrap font-medium"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={deletedLogPage} total={deletedLog.length} perPage={PER_PAGE} onChange={setDeletedLogPage} />
        </>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditingItem(null)}>
          <form
            onSubmit={handleEditSave}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-gray-800">Edit Item</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['boxName', 'Box Name', 'text', true],
                ['item', 'Equipment / Item', 'text', true],
                ['quantity', 'Quantity', 'number', false],
                ['description', 'Description', 'text', false],
              ].map(([field, label, type, required]) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={type}
                    value={editForm[field]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                    required={required}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{editError}</div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={editSaving}
                className="bg-blue-700 text-white px-6 py-2 rounded font-medium hover:bg-blue-800 disabled:opacity-60 transition">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingWithdrawal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditingWithdrawal(null)}>
          <form
            onSubmit={handleWithdrawalEditSave}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-md w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-gray-800">Edit Withdrawal Log Entry</h2>
            <p className="text-xs text-gray-500">
              Quantity can't be changed here — it's tied to the current stock count. To fix a wrong quantity, adjust the item's stock directly instead.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Date</label>
                <input type="date" value={wEditForm.date}
                  onChange={(e) => setWEditForm((f) => ({ ...f, date: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Taken By <span className="text-red-500">*</span></label>
                <input type="text" value={wEditForm.takenBy} required
                  onChange={(e) => setWEditForm((f) => ({ ...f, takenBy: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs font-medium text-gray-600">Destination / School</label>
                <input type="text" value={wEditForm.destination}
                  onChange={(e) => setWEditForm((f) => ({ ...f, destination: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Notes</label>
              <input type="text" value={wEditForm.notes}
                onChange={(e) => setWEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            {wEditError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{wEditError}</div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={wEditSaving}
                className="bg-amber-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-60">
                {wEditSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditingWithdrawal(null)}
                className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
