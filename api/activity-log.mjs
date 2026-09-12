// GET /api/activity-log?page=1&perPage=25&entityType=repair&actor=x@y.com — admin only
//
// Real server-side pagination (LIMIT/OFFSET + COUNT), deliberately different
// from every other list endpoint in this codebase (which fetches the full
// collection and paginates client-side over an in-memory array) — audit_log
// is append-only and expected to grow unbounded, so it gets real pagination
// from the start.
import { getPool } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'

const toApi = (r) => ({
  id: r.id, timestamp: r.timestamp, actorEmail: r.actor_email, action: r.action,
  entityType: r.entity_type, entityId: r.entity_id, summary: r.summary, changes: r.changes,
})

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireRole(req, res, ['admin'])
  if (!user) return

  const pool = getPool()
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage, 10) || 25))
  const offset = (page - 1) * perPage

  const where = []
  const values = []
  if (req.query.entityType) { values.push(req.query.entityType); where.push(`entity_type = $${values.length}`) }
  if (req.query.actor) { values.push(req.query.actor); where.push(`actor_email = $${values.length}`) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM audit_log ${whereSql}`, values)
  const total = Number(countRows[0].count)

  const listValues = [...values, perPage, offset]
  const { rows } = await pool.query(
    `SELECT * FROM audit_log ${whereSql} ORDER BY "timestamp" DESC LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  )

  return res.status(200).json({ entries: rows.map(toApi), total, page, perPage })
}
