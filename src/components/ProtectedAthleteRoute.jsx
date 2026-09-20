import { Navigate } from 'react-router-dom'
import { useAthleteAuth } from '../hooks/useAthleteAuth'

export default function ProtectedAthleteRoute({ children }) {
  const { user, athlete, loading } = useAthleteAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--mu)' }}>
      Loading...
    </div>
  )

  if (!user || !athlete) return <Navigate to="/athlete/login" replace />

  return children
}
