import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Login from './pages/Login'

// Lazy-loaded so each page ships as its own chunk instead of one large
// upfront bundle — Reports alone pulls in recharts, a sizeable library
// nobody needs until they actually open that page.
const RepairDashboard = lazy(() => import('./pages/RepairDashboard'))
const RepairIntake = lazy(() => import('./pages/RepairIntake'))
const SpareLaptops = lazy(() => import('./pages/SpareLaptops'))
const WarehouseInventory = lazy(() => import('./pages/WarehouseInventory'))
const Schools = lazy(() => import('./pages/Schools'))
const Reports = lazy(() => import('./pages/Reports'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const ReceiveShipment = lazy(() => import('./pages/ReceiveShipment'))
const Assistant = lazy(() => import('./pages/Assistant'))

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function PageLoading() {
  return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
}

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
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
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
