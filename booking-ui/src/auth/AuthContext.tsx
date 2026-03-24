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

// In-memory token storage (not localStorage) to mitigate XSS token theft.
// Note: tokens do not survive page refresh. A refresh-token mechanism
// (ideally via httpOnly cookie) should be used for session persistence.
let inMemoryToken: string | null = null

/** Reset in-memory token — for test isolation only */
export function _resetTokenForTest() {
  inMemoryToken = null
}

function loadFromMemory(): AuthState {
  const token = inMemoryToken
  if (!token) return { token: null, userId: null, orgId: null, role: null }
  if (isTokenExpired(token)) {
    inMemoryToken = null
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
  const [state, setState] = useState<AuthState>(loadFromMemory)

  const login = useCallback((token: string) => {
    inMemoryToken = token
    const payload = parseJwtPayload(token)
    setState({
      token,
      userId: payload.sub ?? null,
      orgId: payload.orgId ?? null,
      role: (payload.role as Role) ?? null,
    })
  }, [])

  const logout = useCallback(() => {
    inMemoryToken = null
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
