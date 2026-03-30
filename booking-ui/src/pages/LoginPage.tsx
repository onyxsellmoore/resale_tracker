import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { beginPasskeyLogin, completePasskeyLogin, loginWithPassword, b64urlToBytes } from '../api/authApi'
import '../components/Form.css'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPasswordFallback, setShowPasswordFallback] = useState(false)

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    setShowPasswordFallback(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)
    setSubmitting(true)

    try {
      if (showPasswordFallback) {
        const auth = await loginWithPassword(email.trim(), password)
        login(auth.accessToken)
        navigate('/analytics', { replace: true })
        return
      }

      const result = await beginPasskeyLogin(email.trim())

      if (result.outcome === 'no_passkey') {
        setShowPasswordFallback(true)
        return
      }

      if (result.outcome === 'error') {
        setError(result.message)
        return
      }

      const options = result.options

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBytes(options.challenge) as unknown as BufferSource,
          rpId: options.rpId,
          allowCredentials: options.allowCredentials?.map(c => ({
            id: b64urlToBytes(c.id) as unknown as BufferSource,
            type: 'public-key' as const,
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
          : error?.message || 'Sign-in failed. Make sure you have a passkey registered for this account.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page page-enter">
      <div className="login-hero">
        <h1 className="login-hero-title">Inventory Ledger</h1>
        <p className="login-hero-tagline">Your resale business, organized.</p>
      </div>
      <div className="login-container">
        {sessionExpired && (
          <div className="form-error login-session-expired">
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
              onChange={handleEmailChange}
              className="form-input"
            />
          </div>

          {showPasswordFallback && (
            <>
              <div className="form-error login-no-passkey-msg">
                No passkey found for this account. Enter your temporary password to sign in.
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Temporary Password</label>
                <input
                  id="login-password"
                  aria-label="Temporary Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                />
              </div>
            </>
          )}

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Signing in...' : showPasswordFallback ? 'Sign in with password' : 'Sign in with passkey'}
          </button>

          <p className="login-footer">
            No account yet? <Link to="/setup">Set up your organization</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
