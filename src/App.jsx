import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import WorkoutBuilder from './pages/WorkoutBuilder'
import AthleteView from './pages/AthleteView'
import Roster from './pages/Roster'
import AthleteForm from './pages/AthleteForm'
import AthleteProfile from './pages/AthleteProfile'
import History from './pages/History'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<AthleteView />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/workout/new" element={<ProtectedRoute><WorkoutBuilder /></ProtectedRoute>} />
          <Route path="/workout/:id/edit" element={<ProtectedRoute><WorkoutBuilder /></ProtectedRoute>} />
          <Route path="/roster" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
          <Route path="/roster/new" element={<ProtectedRoute><AthleteForm /></ProtectedRoute>} />
          <Route path="/roster/:id" element={<ProtectedRoute><AthleteProfile /></ProtectedRoute>} />
          <Route path="/roster/:id/edit" element={<ProtectedRoute><AthleteForm /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
