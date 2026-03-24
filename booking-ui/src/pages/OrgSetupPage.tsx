import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { register, beginPasskeyRegistration, completePasskeyRegistration, b64urlToBytes } from '../api/authApi'
import '../components/Form.css'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function OrgSetupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  function handleOrgNameChange(value: string) {
    setOrgName(value)
    setSlug(toSlug(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors: string[] = []
    if (!orgName.trim()) validationErrors.push('Organization name is required')
    if (!displayName.trim()) validationErrors.push('Your name is required')
    if (!email.trim()) validationErrors.push('Email is required')
    if (email.trim() && !email.includes('@')) validationErrors.push('Invalid email format')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setSubmitting(true)
    setStatus(null)

    try {
      const result = await register({
        orgName: orgName.trim(),
        orgSlug: slug.trim(),
        adminEmail: email.trim(),
        adminDisplayName: displayName.trim(),
      })

      if (result.status === 409) {
        setStatus('Organization found! Setting up your passkey...')
      } else if (!result.data) {
        setErrors([result.error || 'Registration failed'])
        return
      } else {
        setStatus('Organization created! Now set up your passkey...')
      }

      const options = await beginPasskeyRegistration(email.trim())

      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: b64urlToBytes(options.challenge) as unknown as BufferSource,
          user: { ...options.user, id: b64urlToBytes(options.user.id) as unknown as BufferSource },
          pubKeyCredParams: options.pubKeyCredParams.map(p => ({ ...p, type: 'public-key' as const })),
        },
      }) as PublicKeyCredential

      const auth = await completePasskeyRegistration(email.trim(), credential)

      login(auth.accessToken)
      navigate('/analytics', { replace: true })
    } catch {
      setErrors(['Registration failed'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 480, margin: '40px auto', padding: 20 }}>
      <h1>Set Up Your Organization</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        Create your organization and admin account to get started.
      </p>

      <form onSubmit={handleSubmit} className="form-card">
        {errors.map((err, i) => (
          <div key={i} className="form-error">{err}</div>
        ))}

        {status && (
          <div style={{ color: 'var(--color-success)', marginBottom: 12, fontSize: '0.9rem' }}>
            {status}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="org-name">Organization Name</label>
          <input
            id="org-name"
            aria-label="Organization Name"
            value={orgName}
            onChange={(e) => handleOrgNameChange(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-name">Your Name</label>
          <input
            id="admin-name"
            aria-label="Your Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating...' : 'Create Organization'}
        </button>
      </form>
    </div>
  )
}
