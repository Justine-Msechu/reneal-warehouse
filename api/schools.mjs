// GET/POST /api/schools         — list / create
// PATCH    /api/schools?id=:id  — update
import { getPool } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'

const toApi = (r) => ({
  id: r.id, name: r.name, district: r.district, region: r.region, status: r.status,
  laptopCount: r.laptop_count, activatedDate: r.activated_date, deactivatedDate: r.deactivated_date,
  deactivatedReason: r.deactivated_reason, notes: r.notes,
})

const COLUMN = {
  name: 'name', district: 'district', region: 'region', status: 'status',
  laptopCount: 'laptop_count', activatedDate: 'activated_date', deactivatedDate: 'deactivated_date',
  deactivatedReason: 'deactivated_reason', notes: 'notes',
}

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await getPool().query('SELECT * FROM schools ORDER BY name')
    return res.status(200).json({ schools: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    if (!body.name?.trim()) return res.status(400).json({ error: 'Missing required field(s): name' })
    try {
      const { rows } = await getPool().query(
        `INSERT INTO schools (name, district, region, status, laptop_count, activated_date, notes)
         VALUES ($1,$2,$3,'Active',$4,$5,$6) RETURNING id`,
        [body.name, body.district || null, body.region || null, Number(body.laptopCount) || 0,
         body.activatedDate || null, body.notes || null]
      )
      return res.status(200).json({ success: true, id: rows[0].id })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'A school with this name already exists' })
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
    const { rowCount } = await getPool().query(
      `UPDATE schools SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values
    )
    if (rowCount === 0) return res.status(404).json({ error: 'School not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
