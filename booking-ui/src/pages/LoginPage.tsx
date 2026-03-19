import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { beginPasskeyLogin, completePasskeyLogin, b64urlToBytes } from '../api/authApi'
import '../components/Form.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)
    setSubmitting(true)

    try {
      const options = await beginPasskeyLogin(email.trim())

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBytes(options.challenge),
          rpId: options.rpId,
          allowCredentials: options.allowCredentials?.map(c => ({
            ...c,
            id: b64urlToBytes(c.id),
          })),
          timeout: options.timeout,
        },
      }) as PublicKeyCredential

      const auth = await completePasskeyLogin(email.trim(), assertion)
      login(auth.accessToken)
      navigate('/analytics', { replace: true })
    } catch (err: unknown) {
      const error = err as Error & { name?: string }
      setError(
        error?.name === 'NotAllowedError'
          ? 'Passkey sign-in was cancelled.'
          : 'Sign-in failed. Make sure you have a passkey registered for this account.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 400, margin: '40px auto', padding: 20 }}>
      <h1>Login</h1>
      {sessionExpired && (
        <div className="form-error" style={{ marginBottom: 12 }}>
          Your session has expired. Please sign in again.
        </div>
      )}
      <form onSubmit={handleSubmit} className="form-card">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Signing in...' : 'Sign in with passkey'}
        </button>

        <p style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          No account yet? <Link to="/setup">Set up your organization</Link>
        </p>
      </form>
    </div>
  )
}
