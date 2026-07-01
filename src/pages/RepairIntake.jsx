import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addRepair, getSchools } from '../services/api'

const PROBLEMS = [
  'CMOS battery', 'Overheating', 'No display', 'RAM issue', 'Keyboard/keys missing',
  'Touchpad not working', 'Power button', 'Hard drive', 'Battery issue', 'Screen damage',
  'Boot issue', 'Other',
]

const empty = {
  laptopIdNumber: '',
  referenceNumber: '',
  model: '',
  dateReceived: new Date().toISOString().slice(0, 10),
  schoolName: '',
  receivedBy: '',
  problemIdentified: '',
  otherProblem: '',
  technician: '',
  remarks: '',
}

export default function RepairIntake() {
  const [form, setForm] = useState(empty)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [schools, setSchools] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    getSchools()
      .then((d) => setSchools((d.schools || []).filter((s) => s.status === 'Active').map((s) => s.name).sort()))
      .catch(() => {})
  }, [])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const problem =
        form.problemIdentified === 'Other' ? form.otherProblem : form.problemIdentified
      await addRepair({ ...form, problemIdentified: problem, status: 'Received' })
      setSuccess(true)
      setTimeout(() => navigate('/'), 1500)
    } catch {
      setError('Failed to save. Check your Apps Script URL in .env.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-green-600 text-4xl mb-3">✓</div>
        <p className="text-lg font-semibold text-gray-700">Repair logged successfully!</p>
        <p className="text-sm text-gray-500 mt-1">Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-5">Log Laptop for Repair</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Spare Laptop ID">
            <input
              type="text"
              value={form.laptopIdNumber}
              onChange={set('laptopIdNumber')}
              placeholder="e.g. AS-1960 (if tracked in Spare Laptops)"
              className={input}
            />
          </Field>

          <Field label="Device / Reference Number" required>
            <input
              type="text"
              value={form.referenceNumber}
              onChange={set('referenceNumber')}
              placeholder="e.g. AS-1329-Dell"
              required
              className={input}
            />
          </Field>

          <Field label="Model">
            <input
              type="text"
              value={form.model}
              onChange={set('model')}
              placeholder="e.g. Dell Latitude E7240"
              className={input}
            />
          </Field>

          <Field label="Date Received" required>
            <input
              type="date"
              value={form.dateReceived}
              onChange={set('dateReceived')}
              required
              className={input}
            />
          </Field>

          <Field label="School Name" required>
            <input
              type="text"
              list="intake-school-list"
              value={form.schoolName}
              onChange={set('schoolName')}
              placeholder="Type or pick a school"
              required
              className={input}
            />
            <datalist id="intake-school-list">
              {schools.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>

          <Field label="Received By" required>
            <input
              type="text"
              value={form.receivedBy}
              onChange={set('receivedBy')}
              placeholder="Your name"
              required
              className={input}
            />
          </Field>

          <Field label="Assign Technician">
            <input
              type="text"
              value={form.technician}
              onChange={set('technician')}
              placeholder="e.g. Justine, Erick, Ashura"
              className={input}
            />
          </Field>
        </div>

        <Field label="Problem Identified" required>
          <select value={form.problemIdentified} onChange={set('problemIdentified')} required className={input}>
            <option value="">Select problem...</option>
            {PROBLEMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>

        {form.problemIdentified === 'Other' && (
          <Field label="Describe the problem" required>
            <input
              type="text"
              value={form.otherProblem}
              onChange={set('otherProblem')}
              placeholder="Describe the issue..."
              required
              className={input}
            />
          </Field>
        )}

        <Field label="Remarks / Notes">
          <textarea
            value={form.remarks}
            onChange={set('remarks')}
            rows={3}
            placeholder="Any extra notes (e.g. accessories received, visible damage...)"
            className={input}
          />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-700 text-white px-6 py-2 rounded font-medium hover:bg-blue-800 disabled:opacity-60 transition"
          >
            {submitting ? 'Saving...' : 'Log Repair'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const input = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
