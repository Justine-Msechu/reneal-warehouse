import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('rws_user')) } catch { return null }
  })

  function login(u) {
    sessionStorage.setItem('rws_user', JSON.stringify(u))
    setUser(u)
  }

  function logout() {
    sessionStorage.removeItem('rws_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
