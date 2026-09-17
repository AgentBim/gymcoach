import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Library = lazy(() => import('./pages/Library'))
const WorkoutBuilder = lazy(() => import('./pages/WorkoutBuilder'))
const AthleteView = lazy(() => import('./pages/AthleteView'))
const Roster = lazy(() => import('./pages/Roster'))
const AthleteForm = lazy(() => import('./pages/AthleteForm'))
const AthleteProfile = lazy(() => import('./pages/AthleteProfile'))
const History = lazy(() => import('./pages/History'))
const Programs = lazy(() => import('./pages/Programs'))
const ProgramBuilder = lazy(() => import('./pages/ProgramBuilder'))
const CustomExercise = lazy(() => import('./pages/CustomExercise'))
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="cu-container cu-page" role="status">Loading page…</div>}><Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/update-password" element={<ProtectedRoute><UpdatePassword /></ProtectedRoute>} />
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
          <Route path="/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
          <Route path="/programs/new" element={<ProtectedRoute><ProgramBuilder /></ProtectedRoute>} />
          <Route path="/programs/:id" element={<ProtectedRoute><ProgramBuilder /></ProtectedRoute>} />
          <Route path="/library/new" element={<ProtectedRoute><CustomExercise /></ProtectedRoute>} />
          <Route path="/library/:id/edit" element={<ProtectedRoute><CustomExercise /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes></Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
