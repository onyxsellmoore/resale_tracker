import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import './AppLayout.css'

export function AppLayout() {
  return (
    <div>
      <NavBar />
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  )
}
