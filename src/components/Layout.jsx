import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const links = [
    { to: '/', label: user?.role === 'school' ? 'My Repairs' : 'Repair Dashboard', roles: ['admin', 'technician', 'school'] },
    { to: '/intake', label: 'Log Repair', roles: ['admin', 'technician'] },
    { to: '/schools', label: 'Schools', roles: ['admin', 'technician'] },
    { to: '/spare-laptops', label: 'Spare Laptops', roles: ['admin', 'technician'] },
    { to: '/warehouse', label: 'Warehouse', roles: ['admin', 'technician'] },
    { to: '/reports', label: 'Reports', roles: ['admin', 'technician'] },
    { to: '/users', label: 'Users', roles: ['admin'] },
  ].filter((l) => l.roles.includes(user?.role))

  const navLink = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-600'}`

  const mobileNavLink = ({ isActive }) =>
    `px-5 py-3 text-sm font-medium border-b border-blue-600 transition-colors ${isActive ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-600'}`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-800 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-bold text-lg tracking-wide shrink-0">Reneal Warehouse</span>

          {/* User info + logout — desktop */}
          <div className="hidden sm:flex items-center gap-3 ml-auto">
            {user?.picture
              ? <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border-2 border-blue-400" />
              : <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>
            }
            <span className="text-sm text-blue-100">{user?.name}</span>
            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{user?.role}</span>
            <button onClick={logout} className="text-xs text-blue-300 hover:text-white ml-1">Sign out</button>
          </div>

          {/* Hamburger — mobile */}
          <button
            className="sm:hidden p-1 rounded hover:bg-blue-700"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Desktop nav */}
        <nav className="bg-blue-700 hidden sm:block">
          <div className="max-w-6xl mx-auto px-4 flex gap-1">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navLink}>{label}</NavLink>
            ))}
          </div>
        </nav>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <nav className="bg-blue-700 sm:hidden">
            <div className="flex flex-col">
              {links.map(({ to, label }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={mobileNavLink}>
                  {label}
                </NavLink>
              ))}
              {/* User info + logout on mobile */}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-blue-600 mt-1">
                {user?.picture
                  ? <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border-2 border-blue-400" />
                  : <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>
                }
                <div className="flex-1">
                  <div className="text-sm text-blue-100">{user?.name}</div>
                  <div className="text-xs text-blue-300">{user?.email}</div>
                </div>
                <button onClick={logout} className="text-xs text-blue-300 hover:text-white">Sign out</button>
              </div>
            </div>
          </nav>
        )}
      </header>

      {!online && (
        <div className="bg-amber-500 text-white text-sm text-center py-2 px-4 font-medium">
          You are offline — showing cached data. Changes cannot be saved until you reconnect.
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t">
        Reneal Warehouse System — Tanzania
      </footer>
    </div>
  )
}
