// GET    /api/users              — list (any authenticated role)
// POST   /api/users              — add or update-by-email (admin only)
// DELETE /api/users?email=:email — remove (admin only)
import { getPool, withTransaction } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'
import { logAudit, diffApi } from './_lib/audit.mjs'

const toApi = (r) => ({
  id: r.id, email: r.email, name: r.name, role: r.role, schoolName: r.school_name, addedDate: r.added_date,
})

export default async function handler(req, res) {
  const { email } = req.query
  const pool = getPool()

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query(
      `SELECT u.*, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id ORDER BY u.email`
    )
    return res.status(200).json({ users: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin'])
    if (!user) return
    const body = req.body || {}
    if (!body.email?.trim()) return res.status(400).json({ error: 'Missing required field: email' })

    const newId = await withTransaction(async (client) => {
      const before = await client.query(
        `SELECT u.*, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.email = $1`,
        [body.email]
      )
      const existed = before.rows.length > 0

      const school = body.schoolName ? await client.query('SELECT id FROM schools WHERE name = $1', [body.schoolName]) : { rows: [] }
      const { rows } = await client.query(
        `INSERT INTO users (email, name, role, school_id)
         VALUES ($1,$2,COALESCE($3,'viewer'),$4)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, school_id = EXCLUDED.school_id
         RETURNING *`,
        [body.email, body.name || null, body.role || null, school.rows[0]?.id || null]
      )
      const row = rows[0]
      const after = { name: row.name, role: row.role, schoolName: body.schoolName || null }

      if (!existed) {
        await logAudit(client, {
          actorEmail: user.email, action: 'create', entityType: 'user', entityId: row.id,
          summary: `Added user ${row.email} as ${row.role}`,
          changes: { after },
        })
      } else {
        const beforeState = { name: before.rows[0].name, role: before.rows[0].role, schoolName: before.rows[0].school_name }
        const { changes } = diffApi(beforeState, after, ['name', 'role', 'schoolName'])
        if (changes) {
          await logAudit(client, {
            actorEmail: user.email, action: 'update', entityType: 'user', entityId: row.id,
            summary: `Updated user ${row.email}`,
            changes,
          })
        }
      }
      return row.id
    })
    return res.status(200).json({ success: true, id: newId })
  }

  if (req.method === 'DELETE') {
    if (!email) return res.status(400).json({ error: 'Missing email' })
    const user = await requireRole(req, res, ['admin'])
    if (!user) return
    const notFound = await withTransaction(async (client) => {
      const before = await client.query(
        `SELECT u.*, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.email = $1`,
        [email]
      )
      if (before.rows.length === 0) return true
      await client.query('DELETE FROM users WHERE email = $1', [email])
      await logAudit(client, {
        actorEmail: user.email, action: 'delete', entityType: 'user', entityId: before.rows[0].id,
        summary: `Removed user ${email} (was ${before.rows[0].role})`,
        changes: { before: toApi(before.rows[0]) },
      })
      return false
    })
    if (notFound) return res.status(404).json({ error: 'User not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
