// /api/auth?action=login   POST — verify Google ID token, mint session cookie
// /api/auth?action=session GET  — rehydrate auth state from the session cookie
// /api/auth?action=logout  POST — clear the session cookie
import { getPool } from './_lib/db.mjs'
import { verifyGoogleIdToken, signSession, setSessionCookie, clearSessionCookie, getSession } from './_lib/auth.mjs'

export default async function handler(req, res) {
  const action = req.query.action

  if (action === 'login' && req.method === 'POST') {
    const { credential } = req.body || {}
    if (!credential) return res.status(400).json({ error: 'Missing credential' })

    let googleUser
    try {
      googleUser = await verifyGoogleIdToken(credential)
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { rows } = await getPool().query(
      `SELECT u.email, u.name, u.role, s.name AS school_name
       FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.email = $1`,
      [googleUser.email]
    )
    const user = rows[0]
    if (!user) return res.status(200).json({ user: null })

    const sessionUser = { email: user.email, name: user.name, role: user.role, schoolName: user.school_name }
    setSessionCookie(res, await signSession(sessionUser))
    return res.status(200).json({ user: sessionUser })
  }

  if (action === 'session' && req.method === 'GET') {
    const session = await getSession(req)
    if (!session) return res.status(200).json({ user: null })
    const { email, name, role, schoolName } = session
    return res.status(200).json({ user: { email, name, role, schoolName } })
  }

  if (action === 'logout' && req.method === 'POST') {
    clearSessionCookie(res)
    return res.status(200).json({ success: true })
  }

  return res.status(404).json({ error: 'Not found' })
}
