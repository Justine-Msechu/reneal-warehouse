// GET /api/cron-alerts — triggered daily by Vercel Cron (see vercel.json).
// Not session-gated like every other route: Vercel invokes crons with
// `Authorization: Bearer $CRON_SECRET` (its documented pattern), so this
// checks that instead of requireRole. Requires CRON_SECRET, RESEND_API_KEY,
// and ALERTS_FROM_EMAIL to be set in the Vercel project's env vars.
import { getPool } from './_lib/db.mjs'
import { formatQuantity } from './_lib/quantity.mjs'
import { LOW_STOCK_THRESHOLD, OVERDUE_REPAIR_DAYS } from '../shared/constants.mjs'

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const pool = getPool()

  const { rows: stockRows } = await pool.query(
    `SELECT i.item, i.quantity, i.quantity_note, b.name AS box_name FROM warehouse_items i
     JOIN warehouse_boxes b ON b.id = i.box_id
     WHERE i.deleted_at IS NULL AND i.quantity IS NOT NULL AND i.quantity <= $1
     ORDER BY i.quantity ASC`,
    [LOW_STOCK_THRESHOLD]
  )
  const outOfStock = stockRows.filter((r) => Number(r.quantity) === 0)
  const lowStock = stockRows.filter((r) => Number(r.quantity) > 0)

  const { rows: overdueRepairs } = await pool.query(
    `SELECT reference_number, school_name_snapshot, status, date_received FROM repairs
     WHERE status IN ('Received','Under Repair') AND date_received < (CURRENT_DATE - $1::int)
     ORDER BY date_received ASC`,
    [OVERDUE_REPAIR_DAYS]
  )

  if (outOfStock.length === 0 && lowStock.length === 0 && overdueRepairs.length === 0) {
    return res.status(200).json({ sent: false, reason: 'Nothing below threshold' })
  }

  const { rows: admins } = await pool.query(`SELECT email FROM users WHERE role = 'admin'`)
  if (admins.length === 0) {
    return res.status(200).json({ sent: false, reason: 'No admin recipients' })
  }

  const itemRow = (r) => `<li>${r.item || '(unnamed item)'} — ${formatQuantity(r.quantity, r.quantity_note)} left, box "${r.box_name}"</li>`
  const repairRow = (r) => {
    const days = Math.floor((Date.now() - new Date(r.date_received)) / 86400000)
    return `<li>${r.reference_number} — ${r.school_name_snapshot} (${r.status}, ${days} days)</li>`
  }

  const html = `
    <h2>Reneal Warehouse — Daily Alerts</h2>
    ${outOfStock.length ? `<h3>Out of Stock (${outOfStock.length})</h3><ul>${outOfStock.map(itemRow).join('')}</ul>` : ''}
    ${lowStock.length ? `<h3>Low Stock (${lowStock.length})</h3><ul>${lowStock.map(itemRow).join('')}</ul>` : ''}
    ${overdueRepairs.length ? `<h3>Overdue Repairs (${overdueRepairs.length})</h3><ul>${overdueRepairs.map(repairRow).join('')}</ul>` : ''}
  `
  const subject = `Warehouse Alerts — ${outOfStock.length} out of stock, ${lowStock.length} low stock, ${overdueRepairs.length} overdue repairs`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM_EMAIL,
      to: admins.map((a) => a.email),
      subject,
      html,
    }),
  })
  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => '')
    return res.status(502).json({ sent: false, reason: 'Resend request failed', detail })
  }

  return res.status(200).json({
    sent: true,
    outOfStock: outOfStock.length,
    lowStock: lowStock.length,
    overdueRepairs: overdueRepairs.length,
    recipients: admins.length,
  })
}
