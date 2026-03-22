const API_BASE = '/api/v1'

// --- Base64url helpers (for WebAuthn API ↔ server communication) ---

function b64urlToBytes(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = b64.replace(/-/g, '+').replace(/_/g, '/') + padding
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// --- Registration (org + admin user, no password) ---

export interface RegisterPayload {
  orgName: string
  orgSlug: string
  adminEmail: string
  adminDisplayName: string
}

export interface RegisterResponse {
  orgId: string
  userId: string
  role: string
}

export interface RegisterResult {
  data?: RegisterResponse
  error?: string
  status: number
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (res.status === 409) {
    return { error: body.message || 'Organization slug already taken', status: 409 }
  }
  if (!res.ok) {
    return { error: body.message || 'Registration failed', status: res.status }
  }
  return { data: body, status: 201 }
}

// --- Passkey Registration ---

export interface PasskeyRegisterBeginResponse {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: string; alg: number }>
  timeout: number
}

export interface PasskeyAuthResponse {
  accessToken: string
  refreshToken: string
}

export async function beginPasskeyRegistration(email: string): Promise<PasskeyRegisterBeginResponse> {
  const res = await fetch(`${API_BASE}/auth/register/begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error('Failed to begin passkey registration')
  return res.json()
}

export async function completePasskeyRegistration(
  email: string,
  credential: PublicKeyCredential,
): Promise<PasskeyAuthResponse> {
  const response = credential.response as AuthenticatorAttestationResponse
  const res = await fetch(`${API_BASE}/auth/register/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      credentialId: bufToB64url(credential.rawId),
      attestationObject: bufToB64url(response.attestationObject),
      clientDataJSON: bufToB64url(response.clientDataJSON),
    }),
  })
  if (!res.ok) throw new Error('Failed to complete passkey registration')
  return res.json()
}

// --- Passkey Login ---

export interface PasskeyLoginBeginResponse {
  challenge: string
  rpId: string
  allowCredentials: Array<{ id: string; type: string }>
  timeout: number
}

export type LoginBeginResult =
  | { outcome: 'success'; options: PasskeyLoginBeginResponse }
  | { outcome: 'no_passkey' }
  | { outcome: 'error'; message: string }

export async function beginPasskeyLogin(email: string): Promise<LoginBeginResult> {
  const res = await fetch(`${API_BASE}/auth/login/begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (res.status === 409) return { outcome: 'no_passkey' }
  if (!res.ok) return { outcome: 'error', message: 'Sign-in failed. Make sure you have a passkey registered for this account.' }
  return { outcome: 'success', options: await res.json() }
}

export async function loginWithPassword(email: string, password: string): Promise<PasskeyAuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Invalid email or password')
  return res.json()
}

export async function completePasskeyLogin(
  email: string,
  assertion: PublicKeyCredential,
): Promise<PasskeyAuthResponse> {
  const response = assertion.response as AuthenticatorAssertionResponse
  const res = await fetch(`${API_BASE}/auth/login/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      credentialId: bufToB64url(assertion.rawId),
      authenticatorData: bufToB64url(response.authenticatorData),
      clientDataJSON: bufToB64url(response.clientDataJSON),
      signature: bufToB64url(response.signature),
    }),
  })
  if (!res.ok) throw new Error('Failed to complete passkey login')
  return res.json()
}

// --- Org exists check ---

export async function checkOrgExists(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/org-exists`)
    if (!res.ok) return false
    const body = await res.json()
    return body.exists === true
  } catch {
    return false
  }
}

// Re-export helpers for use in pages
export { b64urlToBytes, bufToB64url }
