import { createContext, useContext, useEffect, useState } from 'react'
import { getSessionUser, logout as apiLogout } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // The session lives in an httpOnly cookie the server verifies — rehydrate
  // from it on load rather than trusting anything cached client-side.
  useEffect(() => {
    getSessionUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  function login(u) {
    sessionStorage.setItem('rws_user', JSON.stringify(u))
    setUser(u)
  }

  function logout() {
    sessionStorage.removeItem('rws_user')
    setUser(null)
    apiLogout().catch(() => {})
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
