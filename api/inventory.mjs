// GET/POST /api/inventory?resource=items                     — list active items / quick-add (finds-or-creates box by name)
// PATCH    /api/inventory?resource=items&id=:id               — update
// DELETE   /api/inventory?resource=items&id=:id               — soft delete + deleted_log entry (one transaction)
// POST     /api/inventory?resource=items&id=:id&restore=1     — idempotent undelete (the incident fix — see below)
// DELETE   /api/inventory?resource=boxes&id=:id                — soft delete every active item in the box
// GET      /api/inventory?resource=deleted-log                 — audit trail, most recent first
import { getPool, withTransaction } from './_lib/db.mjs'
import { requireRole } from './_lib/auth.mjs'
import { splitQuantity, formatQuantity } from './_lib/quantity.mjs'

const itemToApi = (r) => ({
  id: r.id, boxId: r.box_id, boxName: r.box_name, item: r.item,
  quantity: formatQuantity(r.quantity, r.quantity_note), description: r.description, lastUpdated: r.last_updated,
})
const logToApi = (r) => ({
  id: r.id, timestamp: r.timestamp, deletedBy: r.deleted_by, type: r.type, itemId: r.item_id,
  boxName: r.box_name, item: r.item, quantity: formatQuantity(r.quantity, null), description: r.description,
})

export default async function handler(req, res) {
  const { resource, id, restore } = req.query
  const pool = getPool()

  // ── items ──────────────────────────────────────────────────────────
  if (resource === 'items' && !id && req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query(
      `SELECT i.*, b.name AS box_name FROM warehouse_items i
       JOIN warehouse_boxes b ON b.id = i.box_id
       WHERE i.deleted_at IS NULL ORDER BY b.name, i.item`
    )
    return res.status(200).json({ items: rows.map(itemToApi) })
  }

  if (resource === 'items' && !id && req.method === 'POST') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    if (!body.boxName?.trim() || !body.item?.trim()) {
      return res.status(400).json({ error: 'Missing required field(s): boxName, item' })
    }
    const { quantity, note } = splitQuantity(body.quantity)
    const newId = await withTransaction(async (client) => {
      let box = await client.query('SELECT id FROM warehouse_boxes WHERE name = $1', [body.boxName])
      if (box.rows.length === 0) {
        box = await client.query('INSERT INTO warehouse_boxes (name) VALUES ($1) RETURNING id', [body.boxName])
      }
      const item = await client.query(
        `INSERT INTO warehouse_items (box_id, item, quantity, quantity_note, description)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [box.rows[0].id, body.item, quantity, note, body.description || null]
      )
      return item.rows[0].id
    })
    return res.status(200).json({ success: true, id: newId })
  }

  if (resource === 'items' && id && restore && req.method === 'POST') {
    // A single idempotent PK-addressed UPDATE — no box-name string matching
    // anywhere in this path. This is the direct fix for the incident that
    // motivated this migration: N concurrent duplicate restores of the same
    // item now result in exactly one real change; the rest match zero rows
    // and harmlessly no-op instead of one silently writing to the wrong box.
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const { rowCount } = await pool.query(
      'UPDATE warehouse_items SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
      [id]
    )
    return res.status(200).json({ success: true, restored: rowCount > 0 })
  }

  if (resource === 'items' && id && req.method === 'PATCH') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const body = req.body || {}
    const result = await withTransaction(async (client) => {
      const sets = ['last_updated = now()']
      const values = []
      if (body.boxName !== undefined) {
        let box = await client.query('SELECT id FROM warehouse_boxes WHERE name = $1', [body.boxName])
        if (box.rows.length === 0) {
          box = await client.query('INSERT INTO warehouse_boxes (name) VALUES ($1) RETURNING id', [body.boxName])
        }
        values.push(box.rows[0].id); sets.push(`box_id = $${values.length}`)
      }
      if (body.item !== undefined) { values.push(body.item); sets.push(`item = $${values.length}`) }
      if (body.description !== undefined) { values.push(body.description); sets.push(`description = $${values.length}`) }
      if (body.quantity !== undefined) {
        const { quantity, note } = splitQuantity(body.quantity)
        values.push(quantity); sets.push(`quantity = $${values.length}`)
        values.push(note); sets.push(`quantity_note = $${values.length}`)
      }
      values.push(id)
      return client.query(`UPDATE warehouse_items SET ${sets.join(', ')} WHERE id = $${values.length}`, values)
    })
    if (result.rowCount === 0) return res.status(404).json({ error: 'Item not found' })
    return res.status(200).json({ success: true })
  }

  if (resource === 'items' && id && req.method === 'DELETE') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const deleted = await withTransaction(async (client) => {
      const item = await client.query(
        `SELECT i.item, i.quantity, i.quantity_note, i.description, b.name AS box_name
         FROM warehouse_items i JOIN warehouse_boxes b ON b.id = i.box_id
         WHERE i.id = $1 AND i.deleted_at IS NULL`,
        [id]
      )
      if (item.rows.length === 0) return null
      const row = item.rows[0]
      await client.query('UPDATE warehouse_items SET deleted_at = now() WHERE id = $1', [id])
      await client.query(
        `INSERT INTO deleted_log (deleted_by, type, item_id, box_name, item, quantity, description)
         VALUES ($1,'item',$2,$3,$4,$5,$6)`,
        [user.email, id, row.box_name, row.item, row.quantity, row.description]
      )
      return row
    })
    if (!deleted) return res.status(404).json({ error: 'Item not found' })
    return res.status(200).json({ success: true })
  }

  // ── boxes ──────────────────────────────────────────────────────────
  if (resource === 'boxes' && id && req.method === 'DELETE') {
    const user = await requireRole(req, res, ['admin', 'technician'])
    if (!user) return
    const deleted = await withTransaction(async (client) => {
      const box = await client.query('SELECT name FROM warehouse_boxes WHERE id = $1', [id])
      if (box.rows.length === 0) return null
      const boxName = box.rows[0].name
      const items = await client.query(
        'SELECT id, item, quantity, description FROM warehouse_items WHERE box_id = $1 AND deleted_at IS NULL',
        [id]
      )
      if (items.rows.length === 0) return { boxName, count: 0 }
      await client.query('UPDATE warehouse_items SET deleted_at = now() WHERE box_id = $1 AND deleted_at IS NULL', [id])
      for (const row of items.rows) {
        await client.query(
          `INSERT INTO deleted_log (deleted_by, type, item_id, box_name, item, quantity, description)
           VALUES ($1,'box',$2,$3,$4,$5,$6)`,
          [user.email, row.id, boxName, row.item, row.quantity, row.description]
        )
      }
      return { boxName, count: items.rows.length }
    })
    if (!deleted) return res.status(404).json({ error: 'Box not found' })
    if (deleted.count === 0) return res.status(400).json({ error: 'Box is already empty' })
    return res.status(200).json({ success: true, deleted: deleted.count })
  }

  // ── deleted-log ────────────────────────────────────────────────────
  if (resource === 'deleted-log' && req.method === 'GET') {
    const user = await requireRole(req, res, ['admin', 'technician', 'viewer'])
    if (!user) return
    const { rows } = await pool.query('SELECT * FROM deleted_log ORDER BY "timestamp" DESC')
    return res.status(200).json({ log: rows.map(logToApi) })
  }

  return res.status(404).json({ error: 'Not found' })
}
