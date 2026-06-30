import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'
import { getUser } from '../services/api'

function decodeJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

export default function Login() {
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSuccess(response) {
    setLoading(true)
    setError(null)
    try {
      const decoded = decodeJWT(response.credential)
      if (!decoded?.email) throw new Error('Could not read Google account info.')

      const data = await getUser(decoded.email)
      if (!data.user) {
        setError('Your Google account is not registered in the system. Contact the administrator to get access.')
        return
      }

      login({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        role: data.user.role,
        schoolName: data.user.schoolName || null,
      })
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-800 to-blue-600 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-3xl">R</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">Reneal Warehouse System</h1>
        <p className="text-sm text-gray-500 mb-6">Tanzania — Sign in to continue</p>

        {loading ? (
          <div className="text-sm text-gray-500 py-3">Checking access...</div>
        ) : (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
            />
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg text-left">
            {error}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          Only registered team members can access this system.
        </p>
      </div>
    </div>
  )
}
