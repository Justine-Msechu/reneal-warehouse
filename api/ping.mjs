import { getSession } from './_lib/auth.mjs'
import { getPool } from './_lib/db.mjs'

// ?stats=1 is deliberately public (no session check) — it's just three
// aggregate counts, shown on the Login page before anyone signs in.
export default async function handler(req, res) {
  if (req.query.stats) {
    const { rows } = await getPool().query(`
      SELECT
        (SELECT COUNT(*) FROM schools WHERE status = 'Active') AS schools,
        (SELECT COUNT(*) FROM repairs) AS repairs,
        (SELECT COUNT(*) FROM spare_laptops
           WHERE location IS NULL OR location ILIKE '%spare%' OR location ILIKE '%warehouse%' OR location ILIKE '%box%'
        ) AS spares
    `)
    const r = rows[0]
    return res.status(200).json({ schools: Number(r.schools), repairs: Number(r.repairs), spares: Number(r.spares) })
  }

  const session = await getSession(req)
  return res.status(200).json({ ok: true, authenticated: !!session, email: session?.email })
}
