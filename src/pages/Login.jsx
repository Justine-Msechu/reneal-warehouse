import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'
import { loginWithGoogle, getPublicStats } from '../services/api'

function Stat({ n, label }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-[11px] uppercase tracking-wide text-blue-300 mt-0.5">{label}</div>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  // Public counts, shown before anyone signs in — best-effort: if this
  // fails for any reason, the stats row just doesn't render.
  useEffect(() => { getPublicStats().then(setStats).catch(() => {}) }, [])

  async function handleSuccess(response) {
    setLoading(true)
    setError(null)
    try {
      // The server verifies the Google credential cryptographically and
      // looks up the role by email — nothing from the client is trusted.
      const data = await loginWithGoogle(response.credential)
      if (!data.user) {
        setError('Your Google account is not registered in the system. Contact the administrator to get access.')
        return
      }
      login(data.user)
    } catch (err) {
      if (err.message === 'Unauthorized') {
        setError('Sign-in failed. Please try again.')
      } else {
        setError(err.message || 'Failed to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="bg-gradient-to-br from-blue-800 to-blue-900 text-white px-8 py-10 md:py-16 flex flex-col justify-between">
        <div>
          <img src="/logo.png" alt="Reneal" className="h-10 w-auto object-contain mb-8" />
          <h1 className="text-2xl md:text-3xl font-bold leading-snug max-w-sm">
            Refurbished laptops, back in classrooms across Tanzania.
          </h1>
          <p className="text-blue-200 text-sm mt-3 max-w-sm">
            Reneal tracks every repair, spare, and deployment from warehouse intake to the school it ends up in.
          </p>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-6 sm:gap-8 mt-10">
            <Stat n={stats.schools} label="Schools equipped" />
            <Stat n={stats.repairs} label="Repairs logged" />
            <Stat n={stats.spares} label="Spares ready" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <div className="max-w-sm w-full">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Sign in to continue</h2>
          <p className="text-sm text-gray-500 mb-6">Only registered team members have access.</p>

          {loading ? (
            <div className="text-sm text-gray-500 py-3">Checking access...</div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
            />
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <p className="mt-6 text-xs text-gray-400">
            Contact an admin if you need access.
          </p>
        </div>
      </div>
    </div>
  )
}
