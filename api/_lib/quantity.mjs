// Warehouse item quantities are sometimes free text in real data ('4pc',
// 'bunch', '6(BOX)'), not pure numbers. `quantity` (NUMERIC) holds the
// parsed leading number when there is one; `quantity_note` holds whatever
// text followed it. splitQuantity/formatQuantity round-trip losslessly so
// the frontend can keep treating "quantity" as a single free-text field.

const blank = (v) => v === undefined || v === null || String(v).trim() === ''

export function splitQuantity(raw) {
  if (blank(raw)) return { quantity: null, note: null }
  if (typeof raw === 'number') return { quantity: raw, note: null }
  const s = String(raw).trim()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return { quantity: null, note: s }
  const note = m[2].trim()
  return { quantity: Number(m[1]), note: note || null }
}

export function formatQuantity(quantity, note) {
  if (quantity === null || quantity === undefined) return note || ''
  const q = Number(quantity) % 1 === 0 ? String(Number(quantity)) : String(quantity)
  return note ? `${q}${note}` : q
}
