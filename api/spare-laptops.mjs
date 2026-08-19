// GET/POST /api/spare-laptops         — list / create
// PATCH    /api/spare-laptops?id=:id  — update
import { getPool } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'

const toApi = (r) => ({
  id: r.id, idNumber: r.id_number, manufacturer: r.manufacturer, model: r.model, cpu: r.cpu,
  cpuClass: r.cpu_class, memHd: r.mem_hd, comments: r.comments, location: r.location,
  donor: r.donor, date: r.date_label,
})

const COLUMN = {
  idNumber: 'id_number', manufacturer: 'manufacturer', model: 'model', cpu: 'cpu',
  cpuClass: 'cpu_class', memHd: 'mem_hd', comments: 'comments', location: 'location',
  donor: 'donor', date: 'date_label',
}

export default async function handler(req, res) {
  const { id } = req.query
  const pool = getPool()

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query('SELECT * FROM spare_laptops ORDER BY created_at DESC')
    return res.status(200).json({ laptops: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    if (!body.idNumber?.trim()) return res.status(400).json({ error: 'Missing required field(s): idNumber' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO spare_laptops (id_number, manufacturer, model, cpu, cpu_class, mem_hd, comments, location, donor, date_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [body.idNumber, body.manufacturer || null, body.model || null, body.cpu || null,
         body.cpuClass || null, body.memHd || null, body.comments || null, body.location || null,
         body.donor || null, body.date || null]
      )
      return res.status(200).json({ success: true, id: rows[0].id })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'A laptop with this ID number already exists' })
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
    const { rowCount } = await pool.query(
      `UPDATE spare_laptops SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values
    )
    if (rowCount === 0) return res.status(404).json({ error: 'Laptop not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
