import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, coach, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--mu)' }}>
      Loading...
    </div>
  )

  // Being signed in isn't enough — an authenticated athlete account has no
  // `coaches` row and shouldn't land on coach screens.
  if (!user || !coach) return <Navigate to="/login" replace />

  return children
}
