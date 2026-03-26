import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getUsers } from '../api/usersApi'
import { CreateUserForm } from '../components/CreateUserForm'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import './UsersPage.css'

const ROLE_BADGE_CLASS: Record<string, string> = {
  ADMIN: 'role-badge role-admin',
  BUYER: 'role-badge role-buyer',
  SELLER: 'role-badge role-seller',
  ACCOUNTANT: 'role-badge role-accountant',
}

export function UsersPage() {
  const { token } = useAuth()
  const [showForm, setShowForm] = useState(false)

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(token!),
    enabled: !!token,
  })

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> {/* audit-fix: vertically center header buttons */}
        <h1>Team Members</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add User
        </button>
      </div>

      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ flex: 2 }}>
          {isLoading && <LoadingSkeleton rows={4} />}
          {error && (
            <ErrorMessage
              message="Failed to load users."
              onRetry={() => refetch()}
            />
          )}
          {!isLoading && !error && users.length === 0 && (
            <div className="users-empty">
              No team members yet. Use the button above to add your first colleague.
            </div>
          )}
          {!isLoading && !error && users.length > 0 && (
            <div className="table-scroll-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.displayName}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={ROLE_BADGE_CLASS[user.role] || 'role-badge'}>
                          {user.role}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showForm && (
          <div style={{ flex: 1 }}>
            <CreateUserForm onClose={() => setShowForm(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
