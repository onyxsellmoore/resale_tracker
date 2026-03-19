export class AuthError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'AuthError'
  }
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options)
  if (res.status === 401) {
    throw new AuthError()
  }
  return res
}
