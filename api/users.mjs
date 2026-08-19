// GET    /api/users              — list (any authenticated role)
// POST   /api/users              — add or update-by-email (admin only)
// DELETE /api/users?email=:email — remove (admin only)
import { getPool } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'

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

    const school = body.schoolName ? await pool.query('SELECT id FROM schools WHERE name = $1', [body.schoolName]) : { rows: [] }
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, role, school_id)
       VALUES ($1,$2,COALESCE($3,'viewer'),$4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, school_id = EXCLUDED.school_id
       RETURNING id`,
      [body.email, body.name || null, body.role || null, school.rows[0]?.id || null]
    )
    return res.status(200).json({ success: true, id: rows[0].id })
  }

  if (req.method === 'DELETE') {
    if (!email) return res.status(400).json({ error: 'Missing email' })
    const user = await requireRole(req, res, ['admin'])
    if (!user) return
    const { rowCount } = await pool.query('DELETE FROM users WHERE email = $1', [email])
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
