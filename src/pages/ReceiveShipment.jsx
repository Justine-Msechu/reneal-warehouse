import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addSchool, addSpareLaptop, addInventoryItem } from '../services/api'

const STEPS = ['Details', 'Schools', 'School Laptops', 'Spare Laptops', 'Warehouse Items', 'Review']

const emptySchool   = () => ({ name: '', district: '', region: '', activatedDate: '', notes: '' })
const emptySchoolLaptop = () => ({ idNumber: '', model: '', school: '', comments: '' })
const emptySpare    = () => ({ idNumber: '', model: '', comments: '' })
const emptyWHItem   = () => ({ boxName: '', item: '', quantity: '', description: '' })

const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'
const btnCls   = 'px-4 py-2 rounded text-sm font-medium'

function StepBar({ step }) {
  return (
    <div className="flex items-center mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none min-w-0">
          <div className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
            i < step ? 'text-green-600' : i === step ? 'text-blue-700' : 'text-gray-400'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < step ? 'bg-green-100 text-green-700' : i === step ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className="hidden sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 min-w-4 ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function PastePanel({ onApply, placeholder = 'AS-1960\nAS-1972\n...' }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const ids = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline font-medium">
      Paste multiple IDs at once
    </button>
  )
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
      <label className="text-xs font-medium text-gray-600 block mb-1">Paste ID numbers — one per line</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
      <div className="flex gap-2 mt-2">
        <button disabled={ids.length === 0} onClick={() => { onApply(ids); setText(''); setOpen(false) }}
          className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800 disabled:opacity-40">
          Add {ids.length} IDs
        </button>
        <button onClick={() => { setText(''); setOpen(false) }}
          className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-500 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ReceiveShipment() {
  const [step, setStep] = useState(0)

  // Step 0
  const [shipment, setShipment] = useState({ name: '', date: new Date().toISOString().slice(0, 10) })

  // Step 1 — schools
  const [schools, setSchools] = useState([emptySchool()])

  // Step 2 — school laptops (go directly to schools, tracked as deployed spare laptops)
  const [schoolLaptopDefaults, setSchoolLaptopDefaults] = useState({ manufacturer: 'Dell', donor: 'Apto Solutions' })
  const [schoolLaptops, setSchoolLaptops] = useState([emptySchoolLaptop()])

  // Step 3 — spare laptops → warehouse
  const [spareDefaults, setSpareDefaults] = useState({ manufacturer: 'Dell', model: '', donor: 'Apto Solutions' })
  const [spareLaptops, setSpareLaptops] = useState([emptySpare()])

  // Step 4 — warehouse items
  const [items, setItems] = useState([emptyWHItem()])

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState([])
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState({ schools: 0, schoolLaptops: 0, spareLaptops: 0, items: 0 })

  // ── Schools helpers ──────────────────────────────────────────
  const addSchoolRow    = () => setSchools(s => [...s, emptySchool()])
  const removeSchoolRow = (i) => setSchools(s => s.filter((_, idx) => idx !== i))
  const setSchoolField  = (i, f, v) => setSchools(s => s.map((r, idx) => idx === i ? { ...r, [f]: v } : r))

  // ── School laptop helpers ────────────────────────────────────
  const addSchoolLaptopRow    = () => setSchoolLaptops(s => [...s, emptySchoolLaptop()])
  const removeSchoolLaptopRow = (i) => setSchoolLaptops(s => s.filter((_, idx) => idx !== i))
  const setSchoolLaptopField  = (i, f, v) => setSchoolLaptops(s => s.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  function applySchoolLaptopIDs(ids) {
    const newRows = ids.map(id => emptySchoolLaptop({ idNumber: id }))
    setSchoolLaptops(prev => [...prev.filter(l => l.idNumber.trim()), ...ids.map(id => ({ ...emptySchoolLaptop(), idNumber: id }))])
  }

  // ── Spare laptop helpers ─────────────────────────────────────
  const addSpareRow    = () => setSpareLaptops(s => [...s, emptySpare()])
  const removeSpareRow = (i) => setSpareLaptops(s => s.filter((_, idx) => idx !== i))
  const setSpareField  = (i, f, v) => setSpareLaptops(s => s.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  function applySpareIDs(ids) {
    setSpareLaptops(prev => [...prev.filter(l => l.idNumber.trim()), ...ids.map(id => ({ ...emptySpare(), idNumber: id }))])
  }

  // ── Warehouse item helpers ───────────────────────────────────
  const addItemRow    = () => setItems(s => [...s, emptyWHItem()])
  const removeItemRow = (i) => setItems(s => s.filter((_, idx) => idx !== i))
  const setItemField  = (i, f, v) => setItems(s => s.map((r, idx) => idx === i ? { ...r, [f]: v } : r))

  // ── Valid rows ───────────────────────────────────────────────
  const validSchools        = schools.filter(s => s.name.trim())
  const validSchoolLaptops  = schoolLaptops.filter(l => l.idNumber.trim() && l.school.trim())
  const validSpareLaptops   = spareLaptops.filter(l => l.idNumber.trim())
  const validItems          = items.filter(i => i.item.trim() && i.boxName.trim())

  // School options for dropdown in Step 2
  const schoolOptions = validSchools.map(s => s.name)

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    const total = validSchools.length + validSchoolLaptops.length + validSpareLaptops.length + validItems.length
    let done = 0
    const errs = []
    let sc = 0, slc = 0, spc = 0, itc = 0
    setProgress({ done: 0, total })
    setErrors([])

    for (const s of validSchools) {
      try {
        await addSchool({ ...s, activatedDate: s.activatedDate || shipment.date })
        sc++
      } catch { errs.push(`School "${s.name}" — failed`) }
      done++; setProgress({ done, total })
    }

    for (const l of validSchoolLaptops) {
      try {
        await addSpareLaptop({
          idNumber: l.idNumber,
          manufacturer: schoolLaptopDefaults.manufacturer,
          model: l.model,
          donor: schoolLaptopDefaults.donor,
          comments: l.comments,
          location: l.school,   // set to school name → appears as "Deployed" in Spare Laptops
          date: shipment.date,
        })
        slc++
      } catch { errs.push(`School laptop "${l.idNumber}" → ${l.school} — failed`) }
      done++; setProgress({ done, total })
    }

    for (const l of validSpareLaptops) {
      try {
        await addSpareLaptop({
          idNumber: l.idNumber,
          manufacturer: spareDefaults.manufacturer,
          model: l.model || spareDefaults.model,
          donor: spareDefaults.donor,
          comments: l.comments,
          location: 'Warehouse',
          date: shipment.date,
        })
        spc++
      } catch { errs.push(`Spare laptop "${l.idNumber}" — failed`) }
      done++; setProgress({ done, total })
    }

    for (const item of validItems) {
      try {
        await addInventoryItem({ ...item })
        itc++
      } catch { errs.push(`Item "${item.item}" (${item.boxName}) — failed`) }
      done++; setProgress({ done, total })
    }

    setErrors(errs)
    setResults({ schools: sc, schoolLaptops: slc, spareLaptops: spc, items: itc })
    setFinished(true)
    setSubmitting(false)
  }

  function resetWizard() {
    setStep(0); setFinished(false)
    setShipment({ name: '', date: new Date().toISOString().slice(0, 10) })
    setSchools([emptySchool()])
    setSchoolLaptops([emptySchoolLaptop()])
    setSpareLaptops([emptySpare()])
    setItems([emptyWHItem()])
  }

  // ── Finished screen ──────────────────────────────────────────
  if (finished) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center mb-6">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-green-700 mb-1">Shipment "{shipment.name}" logged!</h2>
          <div className="text-sm text-green-600 space-y-0.5 mt-3">
            {results.schools > 0       && <div>{results.schools} school{results.schools !== 1 ? 's' : ''} added</div>}
            {results.schoolLaptops > 0 && <div>{results.schoolLaptops} laptop{results.schoolLaptops !== 1 ? 's' : ''} deployed to schools</div>}
            {results.spareLaptops > 0  && <div>{results.spareLaptops} spare laptop{results.spareLaptops !== 1 ? 's' : ''} added to warehouse</div>}
            {results.items > 0         && <div>{results.items} warehouse item{results.items !== 1 ? 's' : ''} added</div>}
          </div>
        </div>
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-red-700 mb-2">{errors.length} item{errors.length !== 1 ? 's' : ''} failed:</p>
            <ul className="text-xs text-red-600 space-y-1">{errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          {(results.schools > 0)                              && <Link to="/schools"       className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">View Schools →</Link>}
          {(results.schoolLaptops > 0 || results.spareLaptops > 0) && <Link to="/spare-laptops" className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">View Spare Laptops →</Link>}
          {results.items > 0                                  && <Link to="/warehouse"     className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium hover:bg-blue-800">View Warehouse →</Link>}
          <button onClick={resetWizard} className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-600 hover:bg-gray-50">
            Log another shipment
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Receive Shipment</h1>
      <StepBar step={step} />

      {/* ── STEP 0: Details ── */}
      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Shipment Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Shipment Name <span className="text-red-500">*</span></label>
              <input value={shipment.name} onChange={e => setShipment(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g. 2025B" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Date Received</label>
              <input type="date" value={shipment.date} onChange={e => setShipment(s => ({ ...s, date: e.target.value }))}
                className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button disabled={!shipment.name.trim()} onClick={() => setStep(1)}
              className={`${btnCls} bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40`}>
              Next: Schools →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Schools ── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-700">New Schools</h2>
            <span className="text-xs text-gray-400">Leave rows empty to skip</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Add schools being activated in this shipment. You'll assign laptops to them in the next step.</p>
          <div className="space-y-3 mb-4">
            {schools.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="col-span-12 sm:col-span-4">
                  <input value={s.name} onChange={e => setSchoolField(i, 'name', e.target.value)}
                    placeholder="School name *" className={inputCls} />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <input value={s.district} onChange={e => setSchoolField(i, 'district', e.target.value)}
                    placeholder="District" className={inputCls} />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <input value={s.region} onChange={e => setSchoolField(i, 'region', e.target.value)}
                    placeholder="Region" className={inputCls} />
                </div>
                <div className="col-span-10 sm:col-span-3">
                  <input type="date" value={s.activatedDate} onChange={e => setSchoolField(i, 'activatedDate', e.target.value)}
                    className={inputCls} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  <button onClick={() => removeSchoolRow(i)} className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addSchoolRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add school</button>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(0)} className={`${btnCls} border border-gray-300 text-gray-600 hover:bg-gray-50`}>← Back</button>
            <button onClick={() => setStep(2)} className={`${btnCls} bg-blue-700 text-white hover:bg-blue-800`}>
              Next: School Laptops →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: School Laptops ── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-700">School Laptops</h2>
            <span className="text-xs text-gray-400">Leave empty to skip</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Laptops going directly to schools. Each will be tracked in Spare Laptops as deployed to that school —
            so you can see exactly which model is where.
          </p>

          {validSchools.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
              No schools added in Step 1. Go back to add schools, or skip this step.
            </div>
          )}

          {/* Shared defaults */}
          <div className="grid grid-cols-2 gap-3 mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Manufacturer (all)</label>
              <input value={schoolLaptopDefaults.manufacturer}
                onChange={e => setSchoolLaptopDefaults(d => ({ ...d, manufacturer: e.target.value }))}
                placeholder="Dell" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Donor (all)</label>
              <input value={schoolLaptopDefaults.donor}
                onChange={e => setSchoolLaptopDefaults(d => ({ ...d, donor: e.target.value }))}
                placeholder="Apto Solutions" className={inputCls} />
            </div>
          </div>

          <PastePanel onApply={applySchoolLaptopIDs} />

          <div className="overflow-x-auto mt-3 mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">ID Number *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Model *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">School *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Comments</th>
                  <th className="pb-2 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schoolLaptops.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 min-w-28">
                      <input value={l.idNumber} onChange={e => setSchoolLaptopField(i, 'idNumber', e.target.value)}
                        placeholder="AS-1001" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3 min-w-24">
                      <input value={l.model} onChange={e => setSchoolLaptopField(i, 'model', e.target.value)}
                        placeholder="e.g. 7480" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3 min-w-40">
                      {schoolOptions.length > 0 ? (
                        <select value={l.school} onChange={e => setSchoolLaptopField(i, 'school', e.target.value)}
                          className={inputCls}>
                          <option value="">— select school —</option>
                          {schoolOptions.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                      ) : (
                        <input value={l.school} onChange={e => setSchoolLaptopField(i, 'school', e.target.value)}
                          placeholder="School name" className={inputCls} />
                      )}
                    </td>
                    <td className="py-1.5 pr-3 min-w-32">
                      <input value={l.comments} onChange={e => setSchoolLaptopField(i, 'comments', e.target.value)}
                        placeholder="Optional" className={inputCls} />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeSchoolLaptopRow(i)} className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addSchoolLaptopRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add laptop</button>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className={`${btnCls} border border-gray-300 text-gray-600 hover:bg-gray-50`}>← Back</button>
            <button onClick={() => setStep(3)} className={`${btnCls} bg-blue-700 text-white hover:bg-blue-800`}>
              Next: Spare Laptops →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Spare Laptops (Warehouse) ── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-700">Spare Laptops → Warehouse</h2>
            <span className="text-xs text-gray-400">Leave empty to skip</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Laptops staying in the warehouse as spares (e.g. Boxes Q–T).</p>

          <div className="grid grid-cols-3 gap-3 mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Manufacturer (all)</label>
              <input value={spareDefaults.manufacturer}
                onChange={e => setSpareDefaults(d => ({ ...d, manufacturer: e.target.value }))}
                placeholder="Dell" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Default Model</label>
              <input value={spareDefaults.model}
                onChange={e => setSpareDefaults(d => ({ ...d, model: e.target.value }))}
                placeholder="e.g. 7480" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Donor (all)</label>
              <input value={spareDefaults.donor}
                onChange={e => setSpareDefaults(d => ({ ...d, donor: e.target.value }))}
                placeholder="Apto Solutions" className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">Default model fills rows where model is blank.</p>

          <PastePanel onApply={applySpareIDs} />

          <div className="overflow-x-auto mt-3 mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">ID Number *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Model override</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Comments</th>
                  <th className="pb-2 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {spareLaptops.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3">
                      <input value={l.idNumber} onChange={e => setSpareField(i, 'idNumber', e.target.value)}
                        placeholder="AS-1960" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input value={l.model} onChange={e => setSpareField(i, 'model', e.target.value)}
                        placeholder={spareDefaults.model || 'same as default'} className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input value={l.comments} onChange={e => setSpareField(i, 'comments', e.target.value)}
                        placeholder="e.g. Remove battery" className={inputCls} />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeSpareRow(i)} className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addSpareRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add laptop</button>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(2)} className={`${btnCls} border border-gray-300 text-gray-600 hover:bg-gray-50`}>← Back</button>
            <button onClick={() => setStep(4)} className={`${btnCls} bg-blue-700 text-white hover:bg-blue-800`}>
              Next: Warehouse Items →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Warehouse Items ── */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-700">Warehouse Items</h2>
            <span className="text-xs text-gray-400">Leave empty to skip</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Non-laptop equipment going into warehouse inventory (monitors, adapters, switches, cables, etc.).</p>

          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Box Name *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Item *</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3 w-20">Qty</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pr-3">Description</th>
                  <th className="pb-2 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 min-w-28">
                      <input value={item.boxName} onChange={e => setItemField(i, 'boxName', e.target.value)}
                        placeholder="BOX Q" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3 min-w-32">
                      <input value={item.item} onChange={e => setItemField(i, 'item', e.target.value)}
                        placeholder="Monitor" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3 min-w-16">
                      <input type="number" value={item.quantity} onChange={e => setItemField(i, 'quantity', e.target.value)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className="py-1.5 pr-3 min-w-40">
                      <input value={item.description} onChange={e => setItemField(i, 'description', e.target.value)}
                        placeholder="Details..." className={inputCls} />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeItemRow(i)} className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addItemRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add item</button>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(3)} className={`${btnCls} border border-gray-300 text-gray-600 hover:bg-gray-50`}>← Back</button>
            <button onClick={() => setStep(5)} className={`${btnCls} bg-blue-700 text-white hover:bg-blue-800`}>
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Review ── */}
      {step === 5 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Review & Submit</h2>

          <div className="space-y-4 mb-6">
            {/* Shipment */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Shipment</div>
              <div className="font-semibold text-gray-800">{shipment.name}</div>
              <div className="text-sm text-gray-500">{shipment.date}</div>
            </div>

            {/* Schools */}
            <ReviewSection color="green" title="Schools" count={validSchools.length}>
              {validSchools.map((s, i) => (
                <div key={i}>• {s.name}{s.region ? ` — ${s.region}` : ''}</div>
              ))}
            </ReviewSection>

            {/* School laptops grouped by school */}
            <ReviewSection color="blue" title="School Laptops" count={validSchoolLaptops.length}
              subtitle={`${schoolLaptopDefaults.manufacturer} · Donor: ${schoolLaptopDefaults.donor || '—'}`}>
              {(() => {
                const bySchool = {}
                validSchoolLaptops.forEach(l => {
                  if (!bySchool[l.school]) bySchool[l.school] = []
                  bySchool[l.school].push(l)
                })
                return Object.entries(bySchool).map(([school, laps]) => (
                  <div key={school} className="mt-1">
                    <div className="font-medium">{school} ({laps.length})</div>
                    <div className="ml-3 space-y-0.5">
                      {laps.slice(0, 5).map((l, i) => (
                        <div key={i}>• {l.idNumber}{l.model ? ` — ${l.model}` : ''}</div>
                      ))}
                      {laps.length > 5 && <div className="opacity-60">…and {laps.length - 5} more</div>}
                    </div>
                  </div>
                ))
              })()}
            </ReviewSection>

            {/* Spare laptops */}
            <ReviewSection color="purple" title="Spare Laptops → Warehouse" count={validSpareLaptops.length}
              subtitle={`${spareDefaults.manufacturer}${spareDefaults.model ? ` · ${spareDefaults.model}` : ''} · Donor: ${spareDefaults.donor || '—'}`}>
              {validSpareLaptops.slice(0, 8).map((l, i) => (
                <div key={i}>• {l.idNumber}{(l.model || spareDefaults.model) ? ` — ${l.model || spareDefaults.model}` : ''}</div>
              ))}
              {validSpareLaptops.length > 8 && <div className="opacity-60">…and {validSpareLaptops.length - 8} more</div>}
            </ReviewSection>

            {/* Warehouse items */}
            <ReviewSection color="amber" title="Warehouse Items" count={validItems.length}>
              {validItems.map((item, i) => (
                <div key={i}>• {item.boxName} — {item.item}{item.quantity ? ` × ${item.quantity}` : ''}</div>
              ))}
            </ReviewSection>
          </div>

          {validSchools.length === 0 && validSchoolLaptops.length === 0 && validSpareLaptops.length === 0 && validItems.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
              Nothing to submit — go back and fill in at least one item.
            </div>
          )}

          {submitting && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Saving…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }} />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(4)} disabled={submitting}
              className={`${btnCls} border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40`}>
              ← Back
            </button>
            <button onClick={handleSubmit}
              disabled={submitting || (validSchools.length + validSchoolLaptops.length + validSpareLaptops.length + validItems.length === 0)}
              className={`${btnCls} bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 font-semibold`}>
              {submitting
                ? 'Saving…'
                : `Submit — ${validSchools.length + validSchoolLaptops.length + validSpareLaptops.length + validItems.length} records`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewSection({ color, title, count, subtitle, children }) {
  const colors = {
    green:  { wrap: 'bg-green-50 border-green-100',  title: 'text-green-700',  body: 'text-green-800' },
    blue:   { wrap: 'bg-blue-50 border-blue-100',    title: 'text-blue-700',   body: 'text-blue-800' },
    purple: { wrap: 'bg-purple-50 border-purple-100',title: 'text-purple-700', body: 'text-purple-800' },
    amber:  { wrap: 'bg-amber-50 border-amber-100',  title: 'text-amber-700',  body: 'text-amber-800' },
  }
  const c = colors[color]
  return (
    <div className={`rounded-lg p-4 border ${count > 0 ? c.wrap : 'bg-gray-50 border-gray-100'}`}>
      <div className={`text-sm font-semibold mb-1 ${count > 0 ? c.title : 'text-gray-400'}`}>
        {title} — {count}
        {count === 0 && <span className="text-xs font-normal ml-2">(none, will skip)</span>}
      </div>
      {subtitle && count > 0 && <div className={`text-xs mb-1 opacity-75 ${c.title}`}>{subtitle}</div>}
      {count > 0 && <div className={`text-xs space-y-0.5 ${c.body}`}>{children}</div>}
    </div>
  )
}
