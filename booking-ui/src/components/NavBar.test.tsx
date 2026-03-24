import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { NavBar } from './NavBar'
import { useEffect } from 'react'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function LoginThenRender({ token, children }: { token: string; children: React.ReactNode }) {
  const { login } = useAuth()
  useEffect(() => { login(token) }, [token, login])
  return <>{children}</>
}

function renderNavBar(role: string, initialRoute = '/inventory') {
  const token = fakeJwt({ sub: 'u1', orgId: 'org1', role })
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <LoginThenRender token={token}>
          <NavBar />
        </LoginThenRender>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('NavBar', () => {
  it('adminSeesInventorySalesAnalyticsAndUsersLinks', () => {
    renderNavBar('ADMIN')
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sales/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
  })

  it('buyerSeesInventoryOnlyAndAddItemButton', () => {
    renderNavBar('BUYER')
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^sales$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /analytics/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add item/i })).toBeInTheDocument()
  })

  it('sellerSeesInventoryAndSalesAndRecordSaleButton', () => {
    renderNavBar('SELLER')
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sales$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /record a sale/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /analytics/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument()
  })

  it('accountantSeesInventoryAndSalesAndAnalytics', () => {
    renderNavBar('ACCOUNTANT')
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sales$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument()
  })

  it('nonAdminDoesNotSeeUsersLink', () => {
    renderNavBar('BUYER')
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument()
  })

  it('nonAdminWithoutSalesAccessDoesNotSeeRecordSaleButton', () => {
    renderNavBar('BUYER')
    expect(screen.queryByRole('link', { name: /record a sale/i })).not.toBeInTheDocument()
  })

  it('the link matching the current route has aria-current="page"', () => {
    renderNavBar('ADMIN', '/analytics')
    const analyticsSpan = screen.getByText('Analytics')
    expect(analyticsSpan).toHaveAttribute('aria-current', 'page')
  })
})
