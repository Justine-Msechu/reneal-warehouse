// GET/POST /api/withdrawals         — list / log a withdrawal (row-locked, see below)
// PATCH    /api/withdrawals?id=:id  — audit-metadata edits only
import { getPool, withTransaction } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'
import { formatQuantity } from './_lib/quantity.mjs'

const toApi = (r) => ({
  id: r.id, date: r.date, itemId: r.item_id, boxName: r.box_name_snapshot, item: r.item_snapshot,
  quantityTaken: r.quantity_taken, remainingQty: r.remaining_qty, takenBy: r.taken_by,
  destination: r.destination, notes: r.notes,
})

const COLUMN = { date: 'date', takenBy: 'taken_by', destination: 'destination', notes: 'notes' }

export default async function handler(req, res) {
  const { id } = req.query
  const pool = getPool()

  if (req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query('SELECT * FROM withdrawals ORDER BY created_at DESC')
    return res.status(200).json({ withdrawals: rows.map(toApi) })
  }

  if (req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const missing = ['itemId', 'quantityTaken', 'takenBy'].filter((f) => !String(body[f] ?? '').trim())
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` })
    const taken = Number(body.quantityTaken)
    if (!Number.isFinite(taken) || taken <= 0) return res.status(400).json({ error: 'quantityTaken must be a positive number' })

    try {
      // SELECT ... FOR UPDATE locks the item row for the transaction so
      // concurrent withdrawals against the same item serialize instead of
      // racing on a stale quantity read.
      const result = await withTransaction(async (client) => {
        const locked = await client.query(
          `SELECT i.quantity, i.item, b.name AS box_name FROM warehouse_items i
           JOIN warehouse_boxes b ON b.id = i.box_id
           WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE`,
          [body.itemId]
        )
        if (locked.rows.length === 0) throw Object.assign(new Error('Inventory item not found'), { httpStatus: 404 })
        const current = Number(locked.rows[0].quantity) || 0
        const remaining = current - taken
        if (remaining < 0) throw Object.assign(new Error(`Not enough stock. Available: ${current}`), { httpStatus: 400 })

        await client.query('UPDATE warehouse_items SET quantity = $1, last_updated = now() WHERE id = $2', [remaining, body.itemId])
        const w = await client.query(
          `INSERT INTO withdrawals (date, item_id, box_name_snapshot, item_snapshot, quantity_taken,
             remaining_qty, taken_by, destination, notes)
           VALUES (COALESCE($1, CURRENT_DATE),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [body.date || null, body.itemId, locked.rows[0].box_name, locked.rows[0].item, taken,
           remaining, body.takenBy, body.destination || null, body.notes || null]
        )
        return { id: w.rows[0].id, remaining }
      })
      return res.status(200).json({ success: true, id: result.id, remaining: formatQuantity(result.remaining, null) })
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
    const { rowCount } = await pool.query(`UPDATE withdrawals SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
    if (rowCount === 0) return res.status(404).json({ error: 'Withdrawal not found' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
