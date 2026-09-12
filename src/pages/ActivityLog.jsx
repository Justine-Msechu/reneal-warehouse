import { Fragment, useEffect, useState } from 'react'
import { getActivityLog } from '../services/api'
import Pagination from '../components/Pagination'

const PER_PAGE = 25
const ENTITY_TYPES = ['repair', 'withdrawal', 'deployment', 'user']

const actionColor = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
}

export default function ActivityLog() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [actor, setActor] = useState('')
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [page, entityType, actor])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await getActivityLog({ page, perPage: PER_PAGE, entityType: entityType || undefined, actor: actor || undefined })
      setEntries(res.entries || [])
      setTotal(res.total || 0)
    } catch {
      setError('Could not load the activity log.')
    } finally {
      setLoading(false)
    }
  }

  function onFilterChange(setter) {
    return (e) => { setter(e.target.value); setPage(1) }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">Activity Log</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={entityType}
          onChange={onFilterChange(setEntityType)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          value={actor}
          onChange={onFilterChange(setActor)}
          placeholder="Filter by actor email"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No activity recorded yet.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm bg-white">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['When', 'Actor', 'Action', 'Entity', 'Summary'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">{e.actorEmail}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[e.action] || 'bg-gray-100 text-gray-600'}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{e.entityType} #{e.entityId}</td>
                      <td className="px-3 py-2 text-sm">{e.summary}</td>
                    </tr>
                    {expanded === e.id && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 bg-gray-50">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">{JSON.stringify(e.changes, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}
    </div>
  )
}
