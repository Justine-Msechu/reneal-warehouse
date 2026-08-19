// Shared Postgres pool for all API routes. Uses the pooled Neon connection
// (DATABASE_URL) — direct/unpooled is only for one-off migrations (see
// db/migrate-data.mjs), never for request-serving code.
//
// attachDatabasePool lets Vercel's Fluid Compute runtime reuse this pool
// across concurrent invocations on the same warm instance instead of opening
// a fresh connection per request, and drains it cleanly on suspend.
import pg from 'pg'
import { attachDatabasePool } from '@vercel/functions'

// Postgres DATE (OID 1082) defaults to parsing into a JS Date, which
// JSON.stringifies as a full ISO timestamp ("2022-01-20T00:00:00.000Z").
// The frontend (and the legacy API it was built against) expects plain
// 'yyyy-MM-dd' strings for <input type="date"> and display — return the raw
// string Postgres already sends instead of round-tripping through Date.
pg.types.setTypeParser(1082, (val) => val)

let pool

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    attachDatabasePool(pool)
  }
  return pool
}

// Runs `fn` with a single client checked out of the pool inside a
// transaction — commits on success, rolls back on any thrown error.
// Use this for every write path; it's what makes concurrent writes safe
// (see warehouse_items restore / withdrawal locking patterns in routes).
export async function withTransaction(fn) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
