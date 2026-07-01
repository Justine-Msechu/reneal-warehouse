import { useEffect, useState } from 'react'
import { getUsers, addUser, removeUser } from '../services/api'

const ROLES = ['admin', 'technician', 'viewer']
const emptyForm = { email: '', name: '', role: 'technician' }

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const ud = await getUsers()
      setUsers(ud.users || [])
    } catch { setError('Could not load users.') }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.email.includes('@')) { alert('Enter a valid Gmail address.'); return }
    setSaving(true)
    try {
      await addUser(form)
      setForm(emptyForm)
      setShowForm(false)
      fetchAll()
    } catch { alert('Failed to save user.') }
    finally { setSaving(false) }
  }

  async function handleRemove(user) {
    if (!confirm(`Remove access for ${user.name || user.email}?`)) return
    try {
      await removeUser({ email: user.email })
      setUsers((prev) => prev.filter((u) => u.email !== user.email))
    } catch { alert('Failed to remove user.') }
  }

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const roleColor = { admin: 'bg-purple-100 text-purple-700', technician: 'bg-blue-100 text-blue-700', viewer: 'bg-gray-100 text-gray-600' }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">User Management</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-800"
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Gmail Address <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} required
              placeholder="user@gmail.com"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Full Name</label>
            <input type="text" value={form.name} onChange={set('name')}
              placeholder="e.g. Justine Msechu"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Role <span className="text-red-500">*</span></label>
            <select value={form.role} onChange={set('role')}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving}
              className="bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'Saving...' : 'Add User'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg mb-4 p-4 text-xs text-gray-600 space-y-1">
        <p><span className="font-semibold text-purple-700">Admin</span> — full access including user management</p>
        <p><span className="font-semibold text-blue-700">Technician</span> — full edit access: repairs, laptops, warehouse, schools (troubleshooting &amp; warehouse teams)</p>
        <p><span className="font-semibold text-gray-600">Viewer</span> — read-only access to all data, no editing</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading users...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No users yet. Add the first user above.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Gmail', 'Role', 'Added', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{u.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{u.addedDate}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleRemove(u)}
                      className="text-xs text-red-500 hover:underline font-medium">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
