// One-time data migration: pulls the full dataset from the legacy Apps
// Script backend (exportAll, key-protected) and loads it into Postgres.
//
// Idempotent and safe to re-run: truncates the target tables first, so a
// failed run is just retried, never patched by hand.
//
// Usage:
//   DATABASE_URL_UNPOOLED=... EXPORT_URL=... SCRIPT_KEY=... node db/migrate-data.mjs
//
// EXPORT_URL defaults to the known production Apps Script URL; SCRIPT_KEY
// defaults to the value already in .env (not committed).

import pg from 'pg'
import fs from 'node:fs'

const EXPORT_URL = process.env.EXPORT_URL ||
  'https://script.google.com/macros/s/AKfycbzKDtEUyvbLVaNDs941NZeNn08-Hb8ha7QPn1jbJHapndOtFte18rN-DI8tUknKZ4f9/exec'
const SCRIPT_KEY = process.env.SCRIPT_KEY
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!SCRIPT_KEY) {
  console.error('Missing SCRIPT_KEY env var (the exportAll secret from google-apps-script/.env or app/.env).')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL_UNPOOLED (or DATABASE_URL) env var.')
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────
const blank = (v) => v === undefined || v === null || String(v).trim() === ''
const dateOrNull = (v) => (blank(v) || !/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? null : v)

// 'today' literal (seen in real data) → today's date; anything else that
// isn't a real yyyy-mm-dd is dropped to NULL rather than failing the import.
function addedDateOrNull(v) {
  if (blank(v)) return null
  if (String(v).trim().toLowerCase() === 'today') return new Date().toISOString().slice(0, 10)
  return dateOrNull(v)
}

// Splits '4pc' -> {quantity: 4, note: 'pc'}, 'bunch' -> {quantity: null, note: 'bunch'},
// '' -> {quantity: null, note: null}, 5 -> {quantity: 5, note: null}.
function splitQuantity(raw) {
  if (blank(raw)) return { quantity: null, note: null }
  if (typeof raw === 'number') return { quantity: raw, note: null }
  const s = String(raw).trim()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return { quantity: null, note: s }
  const note = m[2].trim()
  return { quantity: Number(m[1]), note: note || null }
}

async function main() {
  console.log(`Fetching export from ${EXPORT_URL} ...`)
  const res = await fetch(`${EXPORT_URL}?action=exportAll&key=${encodeURIComponent(SCRIPT_KEY)}`)
  if (!res.ok) throw new Error(`exportAll HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`exportAll error: ${data.error}`)

  for (const k of ['repairs', 'laptops', 'schools', 'inventory', 'withdrawals', 'deployments', 'users', 'deletedLog']) {
    if (!Array.isArray(data[k])) throw new Error(`exportAll payload missing array field: ${k}`)
  }
  fs.writeFileSync(new URL('./last-export.json', import.meta.url), JSON.stringify(data, null, 2))
  console.log('Row counts:', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])))

  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  const skipped = { repairs: [], withdrawals: [], deployments: [] }

  try {
    await client.query('BEGIN')

    // Wipe in FK-safe order so this script is re-runnable.
    await client.query(`TRUNCATE deleted_log, deployments, withdrawals, warehouse_items,
                         warehouse_boxes, repairs, spare_laptops, users, schools RESTART IDENTITY CASCADE`)

    // ── schools (parent) ──────────────────────────────────────────────
    const schoolIdByName = new Map()
    for (const s of data.schools) {
      const r = await client.query(
        `INSERT INTO schools (legacy_id, name, district, region, status, laptop_count,
           activated_date, deactivated_date, deactivated_reason, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [s.id, s.name, s.district || null, s.region || null, s.status || 'Active',
         Number(s.laptopCount) || 0, dateOrNull(s.activatedDate), dateOrNull(s.deactivatedDate),
         s.deactivatedReason || null, s.notes || null]
      )
      schoolIdByName.set(s.name, r.rows[0].id)
    }
    console.log(`schools: ${data.schools.length} inserted`)

    // ── users (parent) ────────────────────────────────────────────────
    for (const u of data.users) {
      await client.query(
        `INSERT INTO users (legacy_id, email, name, role, school_id, added_date)
         VALUES ($1,$2,$3,$4,$5, COALESCE($6, CURRENT_DATE))`,
        [u.id, u.email, u.name || null, u.role, schoolIdByName.get(u.schoolName) || null,
         addedDateOrNull(u.addedDate)]
      )
    }
    console.log(`users: ${data.users.length} inserted`)

    // ── spare_laptops (parent) ────────────────────────────────────────
    const laptopIdByIdNumber = new Map()
    for (const l of data.laptops) {
      const r = await client.query(
        `INSERT INTO spare_laptops (legacy_id, id_number, manufacturer, model, cpu, cpu_class,
           mem_hd, comments, location, donor, date_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [l.id, l.idNumber, l.manufacturer || null, l.model || null, l.cpu || null,
         l.cpuClass || null, l.memHd || null, l.comments || null, l.location || null,
         l.donor || null, l.date || null]
      )
      laptopIdByIdNumber.set(l.idNumber, r.rows[0].id)
    }
    console.log(`spare_laptops: ${data.laptops.length} inserted`)

    // ── repairs (child of schools) ────────────────────────────────────
    for (const r of data.repairs) {
      if (blank(r.referenceNumber)) { skipped.repairs.push(r); continue }
      await client.query(
        `INSERT INTO repairs (legacy_id, reference_number, model, date_received, school_id,
           school_name_snapshot, received_by, problem_identified, status, technician,
           date_repaired, picked_up_by, date_returned_to_school, remarks, laptop_id_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [r.id, r.referenceNumber, r.model || null, dateOrNull(r.dateReceived),
         schoolIdByName.get(r.schoolName) || null, r.schoolName || '', r.receivedBy || null,
         r.problemIdentified || null, r.status || 'Received', r.technician || null,
         dateOrNull(r.dateRepaired), r.pickedUpBy || null, dateOrNull(r.dateReturnedToSchool),
         r.remarks || null, r.laptopIdNumber || null]
      )
    }
    console.log(`repairs: ${data.repairs.length - skipped.repairs.length} inserted, ${skipped.repairs.length} skipped`)

    // ── warehouse_boxes + warehouse_items ─────────────────────────────
    const boxIdByName = new Map()
    const itemIdByLegacyId = new Map()
    for (const i of data.inventory) {
      const boxName = i.boxName
      if (!boxIdByName.has(boxName)) {
        const r = await client.query(
          `INSERT INTO warehouse_boxes (name) VALUES ($1) RETURNING id`,
          [boxName]
        )
        boxIdByName.set(boxName, r.rows[0].id)
      }
      const { quantity, note } = splitQuantity(i.quantity)
      const r = await client.query(
        `INSERT INTO warehouse_items (legacy_id, box_id, item, quantity, quantity_note, description, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now())) RETURNING id`,
        [i.id, boxIdByName.get(boxName), i.item || null, quantity, note, i.description || null,
         /^\d{4}-\d{2}-\d{2}$/.test(String(i.lastUpdated)) ? i.lastUpdated : null]
      )
      itemIdByLegacyId.set(i.id, r.rows[0].id)
    }
    console.log(`warehouse_boxes: ${boxIdByName.size} inserted`)
    console.log(`warehouse_items: ${data.inventory.length} inserted`)

    // ── withdrawals (child of warehouse_items) ────────────────────────
    for (const w of data.withdrawals) {
      const itemId = itemIdByLegacyId.get(w.itemId)
      if (!itemId || blank(w.takenBy)) { skipped.withdrawals.push(w); continue }
      await client.query(
        `INSERT INTO withdrawals (legacy_id, date, item_id, box_name_snapshot, item_snapshot,
           quantity_taken, remaining_qty, taken_by, destination, notes)
         VALUES ($1, COALESCE($2, CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9,$10)`,
        [w.id, dateOrNull(w.date), itemId, w.boxName || '', w.item || '',
         Number(w.quantityTaken) || 0, Number(w.remainingQty) || 0, w.takenBy, w.destination || null,
         w.notes || null]
      )
    }
    console.log(`withdrawals: ${data.withdrawals.length - skipped.withdrawals.length} inserted, ${skipped.withdrawals.length} skipped`)

    // ── deployments (child of spare_laptops + schools) ────────────────
    for (const d of data.deployments) {
      if (blank(d.takenBy) || blank(d.action)) { skipped.deployments.push(d); continue }
      await client.query(
        `INSERT INTO deployments (legacy_id, date, laptop_id, id_number_snapshot, action,
           school_id, school_name_snapshot, taken_by, notes)
         VALUES ($1, COALESCE($2, CURRENT_DATE),$3,$4,$5,$6,$7,$8,$9)`,
        [d.id, dateOrNull(d.date), laptopIdByIdNumber.get(d.idNumber) || null, d.idNumber || null,
         d.action, schoolIdByName.get(d.school) || null, d.school || null, d.takenBy, d.notes || null]
      )
    }
    console.log(`deployments: ${data.deployments.length - skipped.deployments.length} inserted, ${skipped.deployments.length} skipped`)

    // ── deleted_log (independent audit trail) ─────────────────────────
    for (const l of data.deletedLog) {
      const { quantity } = splitQuantity(l.quantity)
      await client.query(
        `INSERT INTO deleted_log (legacy_id, "timestamp", deleted_by, type, box_name, item, quantity, description)
         VALUES ($1, COALESCE($2, now()),$3,$4,$5,$6,$7,$8)`,
        [l.id, /^\d{4}-\d{2}-\d{2}$/.test(String(l.timestamp)) ? l.timestamp : null, l.deletedBy,
         l.type, l.boxName || null, l.item || null, quantity, l.description || null]
      )
    }
    console.log(`deleted_log: ${data.deletedLog.length} inserted`)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }

  const skippedTotal = skipped.repairs.length + skipped.withdrawals.length + skipped.deployments.length
  if (skippedTotal > 0) {
    fs.writeFileSync(new URL('./skipped-rows.json', import.meta.url), JSON.stringify(skipped, null, 2))
    console.log(`\n${skippedTotal} row(s) skipped — details written to db/skipped-rows.json`)
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
