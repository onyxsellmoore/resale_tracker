import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

export type Role = 'ADMIN' | 'BUYER' | 'SELLER' | 'ACCOUNTANT'

interface AuthState {
  token: string | null
  userId: string | null
  orgId: string | null
  role: Role | null
}

interface AuthContextValue extends AuthState {
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseJwtPayload(token: string): { sub?: string; orgId?: string; role?: string; exp?: number } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return {}
    const payload = parts[1]
    // Base64url → base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload.exp) return false
  return payload.exp * 1000 < Date.now()
}

function loadFromStorage(): AuthState {
  const token = localStorage.getItem('auth_token')
  if (!token) return { token: null, userId: null, orgId: null, role: null }
  if (isTokenExpired(token)) {
    localStorage.removeItem('auth_token')
    return { token: null, userId: null, orgId: null, role: null }
  }
  const payload = parseJwtPayload(token)
  return {
    token,
    userId: payload.sub ?? null,
    orgId: payload.orgId ?? null,
    role: (payload.role as Role) ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage)

  const login = useCallback((token: string) => {
    localStorage.setItem('auth_token', token)
    const payload = parseJwtPayload(token)
    setState({
      token,
      userId: payload.sub ?? null,
      orgId: payload.orgId ?? null,
      role: (payload.role as Role) ?? null,
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setState({ token: null, userId: null, orgId: null, role: null })
  }, [])

  const value = useMemo(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
