const API_BASE = '/api/v1'

export interface UserDTO {
  id: string
  email: string
  displayName: string
  role: string
  orgId: string
  createdAt: string
}

export interface CreateUserPayload {
  email: string
  displayName: string
  password: string
  role: string
}

export async function getUsers(token: string): Promise<UserDTO[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

export interface CreateUserResult {
  data?: UserDTO
  error?: string
  status: number
}

export async function createUser(
  payload: CreateUserPayload,
  token: string
): Promise<CreateUserResult> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (!res.ok) {
    return { error: body.message || 'Failed to create user', status: res.status }
  }
  return { data: body, status: 201 }
}
