import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { canAccess } from '../utils/rolePermissions'
import './NavBar.css'

function NavLinkItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}
      aria-current={undefined}
      end
    >
      {({ isActive }) => (
        <span aria-current={isActive ? 'page' : undefined}>{label}</span>
      )}
    </NavLink>
  )
}

export function NavBar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const { role, token, logout } = useAuth()

  const canSeeInventory = canAccess(role, 'inventory')
  const canSeeSales = canAccess(role, 'sales')
  const canSeeAnalytics = canAccess(role, 'analytics')
  const canSeeUsers = canAccess(role, 'users')
  const canRecordSale = canAccess(role, 'recordSale')
  const canAddItem = canAccess(role, 'addItem')
  const canImport = canAccess(role, 'import')

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Close drawer on click outside
  useEffect(() => {
    if (!drawerOpen) return
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [drawerOpen])

  const links = (
    <>
      {canSeeInventory && <NavLinkItem to="/inventory" label="Inventory" />}
      {canSeeSales && <NavLinkItem to="/sales" label="Sales" />}
      {canSeeAnalytics && <NavLinkItem to="/analytics" label="Analytics" />}
      {canSeeUsers && <NavLinkItem to="/users" label="Users" />}
      {canImport && <NavLinkItem to="/import" label="Import" />}
    </>
  )

  return (
    <nav className="navbar" ref={navRef}>
      <span className="navbar-brand">Inventory Ledger</span>
      <div className="navbar-links-desktop">
        {links}
      </div>
      {canRecordSale && (
        <Link to="/sales/new" className="navbar-record-sale">
          Record a Sale
        </Link>
      )}
      {canAddItem && (
        <Link to="/inventory" className="navbar-add-item navbar-add-item-ghost">
          Add Item
        </Link>
      )}
      {token && (
        <button
          type="button"
          className="navbar-logout"
          onClick={() => { logout(); navigate('/login') }}
        >
          Log Out
        </button>
      )}
      <button
        type="button"
        className={`navbar-hamburger${drawerOpen ? ' navbar-hamburger-open' : ''}`}
        aria-label="Menu"
        aria-expanded={drawerOpen ? 'true' : 'false'}
        onClick={() => setDrawerOpen((prev) => !prev)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="hamburger-icon">
          <line className="hamburger-line hamburger-line-1" x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line className="hamburger-line hamburger-line-2" x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line className="hamburger-line hamburger-line-3" x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {drawerOpen && (
        <div className="navbar-drawer" data-testid="nav-drawer">
          {links}
          {canRecordSale && (
            <Link to="/sales/new" className="navbar-record-sale-mobile">
              Record a Sale
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
