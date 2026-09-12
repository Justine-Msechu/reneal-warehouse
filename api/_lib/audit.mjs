// Shared by repairs.mjs, withdrawals.mjs, deployments.mjs, users.mjs.
// Must always be called with the `client` from an active withTransaction()
// — never the bare pool — so the audit row commits atomically with the
// write it's describing (mirrors how api/inventory.mjs writes deleted_log).
export async function logAudit(client, { actorEmail, action, entityType, entityId, summary, changes }) {
  await client.query(
    `INSERT INTO audit_log (actor_email, action, entity_type, entity_id, summary, changes)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [actorEmail, action, entityType, entityId, summary, changes ? JSON.stringify(changes) : null]
  )
}

// Diffs `body` (an incoming PATCH payload) against `beforeApi` (toApi(oldRow))
// for the given API-field keys. Returns { changes: null } if none of those
// keys actually changed value — callers should skip the audit insert in that
// case, mirroring each route's existing "sets.length === 0 -> no-op" check.
export function diffApi(beforeApi, body, keys) {
  const before = {}, after = {}
  const changedKeys = []
  for (const k of keys) {
    if (body[k] === undefined) continue
    const a = beforeApi[k] ?? null
    const b = body[k] ?? null
    if (String(a) !== String(b)) {
      before[k] = a
      after[k] = b
      changedKeys.push(k)
    }
  }
  return { changes: changedKeys.length ? { before, after } : null }
}
