import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'

export function AppLayout() {
  return (
    <div>
      <NavBar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        <Outlet />
      </div>
    </div>
  )
}
