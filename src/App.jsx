import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Login from './pages/Login'
import RepairDashboard from './pages/RepairDashboard'
import RepairIntake from './pages/RepairIntake'
import SpareLaptops from './pages/SpareLaptops'
import WarehouseInventory from './pages/WarehouseInventory'
import Schools from './pages/Schools'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import ReceiveShipment from './pages/ReceiveShipment'
import Assistant from './pages/Assistant'

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

  const canEdit = user.role === 'admin' || user.role === 'technician'

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<RepairDashboard />} />
        {canEdit && <Route path="intake" element={<RepairIntake />} />}
        {canEdit && <Route path="receive-shipment" element={<ReceiveShipment />} />}
        <Route path="schools" element={<Schools />} />
        <Route path="spare-laptops" element={<SpareLaptops />} />
        <Route path="warehouse" element={<WarehouseInventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="assistant" element={<Assistant />} />
        {user.role === 'admin' && <Route path="users" element={<UserManagement />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <AuthProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  )
}
