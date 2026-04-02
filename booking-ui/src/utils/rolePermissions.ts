import type { Role } from '../auth/AuthContext'

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  ADMIN: new Set(['inventory', 'sales', 'analytics', 'users', 'recordSale', 'addItem', 'import']),
  BUYER: new Set(['inventory', 'addItem']),
  SELLER: new Set(['inventory', 'sales', 'recordSale']),
  ACCOUNTANT: new Set(['inventory', 'sales', 'analytics']),
}

export function canAccess(role: Role | null, action: string): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.has(action) ?? false
}
