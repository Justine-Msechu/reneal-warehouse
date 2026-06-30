import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import RepairDashboard from './pages/RepairDashboard'
import RepairIntake from './pages/RepairIntake'
import SpareLaptops from './pages/SpareLaptops'
import WarehouseInventory from './pages/WarehouseInventory'
import Schools from './pages/Schools'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function AppRoutes() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  // School role: only sees their own school's repairs
  if (user.role === 'school') {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<RepairDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<RepairDashboard />} />
        <Route path="intake" element={<RepairIntake />} />
        <Route path="schools" element={<Schools />} />
        <Route path="spare-laptops" element={<SpareLaptops />} />
        <Route path="warehouse" element={<WarehouseInventory />} />
        <Route path="reports" element={<Reports />} />
        {user.role === 'admin' && <Route path="users" element={<UserManagement />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
