// GET/POST /api/deployments         — list / log a deployment or return
// PATCH    /api/deployments?id=:id  — correct the log entry (does not recompute laptop location)
import { getPool, withTransaction } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'

const toApi = (r) => ({
  id: r.id, date: r.date, laptopId: r.laptop_id, idNumber: r.id_number_snapshot, action: r.action,
  school: r.school_name_snapshot, takenBy: r.taken_by, notes: r.notes,
})

const COLUMN = {
  date: 'date', idNumber: 'id_number_snapshot', action: 'action',
  school: 'school_name_snapshot', takenBy: 'taken_by', notes: 'notes',
}

export default async function handler(req, res) {
  const { id } = req.query
  const pool = getPool()

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query('SELECT * FROM deployments ORDER BY created_at DESC')
    return res.status(200).json({ deployments: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const missing = ['laptopId', 'action', 'takenBy'].filter((f) => !String(body[f] ?? '').trim())
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` })
    if (body.action === 'Deployed' && !String(body.school || '').trim()) {
      return res.status(400).json({ error: 'School is required when action is "Deployed"' })
    }
    try {
      const newId = await withTransaction(async (client) => {
        const laptop = await client.query('SELECT id_number FROM spare_laptops WHERE id = $1', [body.laptopId])
        if (laptop.rows.length === 0) throw Object.assign(new Error('Laptop not found'), { httpStatus: 404 })

        const newLocation = body.action === 'Returned' ? 'Warehouse (Returned)' : (body.school || 'Deployed')
        await client.query('UPDATE spare_laptops SET location = $1, updated_at = now() WHERE id = $2', [newLocation, body.laptopId])

        const school = body.school ? await client.query('SELECT id FROM schools WHERE name = $1', [body.school]) : { rows: [] }
        const d = await client.query(
          `INSERT INTO deployments (date, laptop_id, id_number_snapshot, action, school_id, school_name_snapshot, taken_by, notes)
           VALUES (COALESCE($1, CURRENT_DATE),$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [body.date || null, body.laptopId, laptop.rows[0].id_number, body.action,
           school.rows[0]?.id || null, body.school || null, body.takenBy, body.notes || null]
        )
        return d.rows[0].id
      })
      return res.status(200).json({ success: true, id: newId })
    } catch (err) {
      if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message })
      throw err
    }
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const sets = []
    const values = []
    for (const [key, col] of Object.entries(COLUMN)) {
      if (body[key] !== undefined) { values.push(body[key]); sets.push(`${col} = $${values.length}`) }
    }
    if (sets.length === 0) return res.status(200).json({ success: true })
    values.push(id)
    const { rowCount } = await pool.query(`UPDATE deployments SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
    if (rowCount === 0) return res.status(404).json({ error: 'Deployment not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
