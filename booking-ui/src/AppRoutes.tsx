import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { InventoryPage } from './pages/InventoryPage'
import { SalesPage } from './pages/SalesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { LoginPage } from './pages/LoginPage'
import { OrgSetupPage } from './pages/OrgSetupPage'
import { UsersPage } from './pages/UsersPage'
import { ImportPage } from './pages/ImportPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/inventory/*"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'BUYER', 'SELLER', 'ACCOUNTANT']}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/*"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SELLER', 'ACCOUNTANT']}>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'ACCOUNTANT']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <ImportPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<OrgSetupPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  )
}
