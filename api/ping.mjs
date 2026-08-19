import { getSession } from './_lib/auth.mjs'

export default async function handler(req, res) {
  const session = await getSession(req)
  return res.status(200).json({ ok: true, authenticated: !!session, email: session?.email })
}
