import { Navigate } from 'react-router-dom'
import { useAuth, type Role, isTokenExpired } from '../auth/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: Role[]
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { token, role, logout } = useAuth()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (isTokenExpired(token)) {
    logout()
    return <Navigate to="/login?expired=1" replace />
  }

  if (requiredRoles && role && !requiredRoles.includes(role)) {
    return <Navigate to="/inventory" replace />
  }

  return <>{children}</>
}
