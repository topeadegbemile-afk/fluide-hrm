import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="session-loading" role="status">Checking your session…</div>
  }

  return user
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function PublicOnly() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return <div className="session-loading" role="status">Checking your session…</div>
  }
  return user ? <Navigate to="/" replace /> : <Outlet />
}
