// GET /api/export-all?key=... — key-protected full data export, kept for the
// local ai/ RAG assistant (see ai/fetch_data.py), which is out of scope for
// this migration's critical path but still depends on this shape existing.
import { getPool } from './_lib/db.mjs'
import { formatQuantity } from './_lib/quantity.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const scriptKey = process.env.SCRIPT_KEY
  if (!scriptKey || req.query.key !== scriptKey) return res.status(401).json({ error: 'Unauthorized' })

  const pool = getPool()
  const [repairs, laptops, schools, inventory, withdrawals, deployments, users, deletedLog] = await Promise.all([
    pool.query('SELECT * FROM repairs'),
    pool.query('SELECT * FROM spare_laptops'),
    pool.query('SELECT * FROM schools'),
    pool.query(`SELECT i.*, b.name AS box_name FROM warehouse_items i
                JOIN warehouse_boxes b ON b.id = i.box_id WHERE i.deleted_at IS NULL`),
    pool.query('SELECT * FROM withdrawals'),
    pool.query('SELECT * FROM deployments'),
    pool.query('SELECT u.*, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id'),
    pool.query('SELECT * FROM deleted_log'),
  ])

  return res.status(200).json({
    repairs: repairs.rows.map((r) => ({
      id: r.id, referenceNumber: r.reference_number, model: r.model, dateReceived: r.date_received,
      schoolName: r.school_name_snapshot, receivedBy: r.received_by, problemIdentified: r.problem_identified,
      status: r.status, technician: r.technician, dateRepaired: r.date_repaired, pickedUpBy: r.picked_up_by,
      dateReturnedToSchool: r.date_returned_to_school, remarks: r.remarks, laptopIdNumber: r.laptop_id_number,
    })),
    laptops: laptops.rows.map((r) => ({
      id: r.id, idNumber: r.id_number, manufacturer: r.manufacturer, model: r.model, cpu: r.cpu,
      cpuClass: r.cpu_class, memHd: r.mem_hd, comments: r.comments, location: r.location,
      donor: r.donor, date: r.date_label,
    })),
    schools: schools.rows.map((r) => ({
      id: r.id, name: r.name, district: r.district, region: r.region, status: r.status,
      laptopCount: r.laptop_count, activatedDate: r.activated_date, deactivatedDate: r.deactivated_date,
      deactivatedReason: r.deactivated_reason, notes: r.notes,
    })),
    inventory: inventory.rows.map((r) => ({
      id: r.id, boxName: r.box_name, item: r.item,
      quantity: formatQuantity(r.quantity, r.quantity_note), description: r.description, lastUpdated: r.last_updated,
    })),
    withdrawals: withdrawals.rows.map((r) => ({
      id: r.id, date: r.date, itemId: r.item_id, boxName: r.box_name_snapshot, item: r.item_snapshot,
      quantityTaken: r.quantity_taken, remainingQty: r.remaining_qty, takenBy: r.taken_by,
      destination: r.destination, notes: r.notes,
    })),
    deployments: deployments.rows.map((r) => ({
      id: r.id, date: r.date, laptopId: r.laptop_id, idNumber: r.id_number_snapshot, action: r.action,
      school: r.school_name_snapshot, takenBy: r.taken_by, notes: r.notes,
    })),
    users: users.rows.map((r) => ({
      id: r.id, email: r.email, name: r.name, role: r.role, schoolName: r.school_name, addedDate: r.added_date,
    })),
    deletedLog: deletedLog.rows.map((r) => ({
      id: r.id, timestamp: r.timestamp, deletedBy: r.deleted_by, type: r.type,
      boxName: r.box_name, item: r.item, quantity: formatQuantity(r.quantity, null), description: r.description,
    })),
  })
}
