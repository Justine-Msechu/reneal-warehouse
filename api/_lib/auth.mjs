// Auth: verify a Google ID token once at login (cryptographic, offline after
// JWKS fetch — no per-request Google round trip), then mint our own
// short-lived session JWT in an httpOnly cookie. Every other route just
// verifies that cookie locally (HMAC check, no network call).
import { OAuth2Client } from 'google-auth-library'
import { SignJWT, jwtVerify } from 'jose'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)
const SESSION_COOKIE = 'rws_session'
const SESSION_TTL_SECONDS = 12 * 60 * 60 // 12h — covers a workday, matches old ~1hr-then-relogin UX or better

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

// Verifies a Google Sign-In credential (ID token) cryptographically.
// Returns { email } or throws.
export async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
  const payload = ticket.getPayload()
  if (!payload?.email || !payload.email_verified) throw new Error('Unverified Google account')
  return { email: payload.email, name: payload.name }
}

export async function signSession({ email, name, role, schoolName }) {
  return new SignJWT({ email, name, role, schoolName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SESSION_SECRET)
}

async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
}

// Returns the verified session payload ({email, name, role, schoolName}) or null.
export async function getSession(req) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return null
  return verifySession(token)
}

// Gate for route handlers: if the session is missing/expired, writes 401 and
// returns null. If allowedRoles is given and the session's role isn't in it,
// writes 403 and returns null. Otherwise returns the session payload.
//
// Usage: const user = await requireRole(req, res, ['admin','technician']); if (!user) return
export async function requireRole(req, res, allowedRoles) {
  const session = await getSession(req)
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return session
}
