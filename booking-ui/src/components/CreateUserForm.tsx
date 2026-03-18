import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { createUser } from '../api/usersApi'
import { Toast } from './Toast'
import './Form.css'

interface CreateUserFormProps {
  onClose: () => void
}

export function CreateUserForm({ onClose }: CreateUserFormProps) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('BUYER')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors: string[] = []
    if (!displayName.trim()) validationErrors.push('Display name is required')
    if (!email.trim()) validationErrors.push('Email is required')
    if (email.trim() && !email.includes('@')) validationErrors.push('Invalid email format')
    if (!password) validationErrors.push('Password is required')
    if (password && password.length < 8) validationErrors.push('Password must be at least 8 characters')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setSubmitting(true)

    try {
      const result = await createUser(
        {
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          role,
        },
        token!
      )

      if (!result.data) {
        setErrors([result.error || 'Failed to create user'])
        return
      }

      queryClient.invalidateQueries({ queryKey: ['users'] })
      setToast('User created. They can now log in.')
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('BUYER')
    } catch {
      setErrors(['Failed to create user'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Add Team Member</h2>

      {errors.map((err, i) => (
        <div key={i} className="form-error">{err}</div>
      ))}

      <div className="form-group">
        <label htmlFor="user-name">Display Name</label>
        <input
          id="user-name"
          aria-label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="user-email">Email</label>
        <input
          id="user-email"
          aria-label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="user-password">Temporary Password</label>
        <input
          id="user-password"
          aria-label="Temporary Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="user-role">Role</label>
        <select
          id="user-role"
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="form-input"
        >
          <option value="ADMIN">Admin</option>
          <option value="BUYER">Buyer</option>
          <option value="SELLER">Seller</option>
          <option value="ACCOUNTANT">Accountant</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating...' : 'Create User'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </form>
  )
}
