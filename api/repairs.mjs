// GET/POST /api/repairs         — list / create
// PATCH    /api/repairs?id=:id  — update
import { getPool, withTransaction } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'
import { logAudit, diffApi } from './_lib/audit.mjs'

const toApi = (r) => ({
  id: r.id, referenceNumber: r.reference_number, model: r.model, dateReceived: r.date_received,
  schoolName: r.school_name_snapshot, receivedBy: r.received_by, problemIdentified: r.problem_identified,
  status: r.status, technician: r.technician, dateRepaired: r.date_repaired, pickedUpBy: r.picked_up_by,
  dateReturnedToSchool: r.date_returned_to_school, remarks: r.remarks, laptopIdNumber: r.laptop_id_number,
})

const COLUMN = {
  referenceNumber: 'reference_number', model: 'model', dateReceived: 'date_received',
  receivedBy: 'received_by', problemIdentified: 'problem_identified', status: 'status',
  technician: 'technician', dateRepaired: 'date_repaired', pickedUpBy: 'picked_up_by',
  dateReturnedToSchool: 'date_returned_to_school', remarks: 'remarks', laptopIdNumber: 'laptop_id_number',
}

export default async function handler(req, res) {
  const { id } = req.query
  const pool = getPool()

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query('SELECT * FROM repairs ORDER BY created_at DESC')
    return res.status(200).json({ repairs: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const missing = ['referenceNumber', 'schoolName', 'problemIdentified'].filter((f) => !String(body[f] || '').trim())
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` })

    const newId = await withTransaction(async (client) => {
      const school = await client.query('SELECT id FROM schools WHERE name = $1', [body.schoolName])
      const { rows } = await client.query(
        `INSERT INTO repairs (reference_number, model, date_received, school_id, school_name_snapshot,
           received_by, problem_identified, status, technician, remarks, laptop_id_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'Received'),$9,$10,$11) RETURNING *`,
        [body.referenceNumber, body.model || null, body.dateReceived || null, school.rows[0]?.id || null,
         body.schoolName, body.receivedBy || null, body.problemIdentified, body.status || null,
         body.technician || null, body.remarks || null, body.laptopIdNumber || null]
      )
      const row = rows[0]
      await logAudit(client, {
        actorEmail: user.email, action: 'create', entityType: 'repair', entityId: row.id,
        summary: `Logged repair ${row.reference_number} for ${row.school_name_snapshot}`,
        changes: { after: toApi(row) },
      })
      return row.id
    })
    return res.status(200).json({ success: true, id: newId })
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const sets = []
    const values = []
    if (body.schoolName !== undefined) {
      const school = await pool.query('SELECT id FROM schools WHERE name = $1', [body.schoolName])
      values.push(body.schoolName); sets.push(`school_name_snapshot = $${values.length}`)
      values.push(school.rows[0]?.id || null); sets.push(`school_id = $${values.length}`)
    }
    for (const [key, col] of Object.entries(COLUMN)) {
      if (body[key] !== undefined) { values.push(body[key]); sets.push(`${col} = $${values.length}`) }
    }
    if (sets.length === 0) return res.status(200).json({ success: true })

    const notFound = await withTransaction(async (client) => {
      const before = await client.query('SELECT * FROM repairs WHERE id = $1', [id])
      if (before.rows.length === 0) return true
      const vals = [...values, id]
      await client.query(`UPDATE repairs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals)
      const { changes } = diffApi(toApi(before.rows[0]), body, [...Object.keys(COLUMN), 'schoolName'])
      if (changes) {
        await logAudit(client, {
          actorEmail: user.email, action: 'update', entityType: 'repair', entityId: Number(id),
          summary: `Updated repair ${before.rows[0].reference_number}`,
          changes,
        })
      }
      return false
    })
    if (notFound) return res.status(404).json({ error: 'Repair not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
