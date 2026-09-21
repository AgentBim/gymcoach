import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AthleteAuthProvider } from './hooks/useAthleteAuth'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedAthleteRoute from './components/ProtectedAthleteRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import AthleteForgotPassword from './pages/AthleteForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import WorkoutBuilder from './pages/WorkoutBuilder'
import AthleteView from './pages/AthleteView'
import Roster from './pages/Roster'
import AthleteForm from './pages/AthleteForm'
import AthleteProfile from './pages/AthleteProfile'
import History from './pages/History'
import Programs from './pages/Programs'
import ProgramBuilder from './pages/ProgramBuilder'
import CustomExercise from './pages/CustomExercise'
import AthleteLogin from './pages/AthleteLogin'
import AthleteInviteAccept from './pages/AthleteInviteAccept'
import AthletePortalLayout from './pages/athlete/AthletePortalLayout'
import AthleteToday from './pages/athlete/AthleteToday'
import AthleteHistory from './pages/athlete/AthleteHistory'
import AthleteProgram from './pages/athlete/AthleteProgram'
import AthleteWorkoutPreview from './pages/athlete/AthleteWorkoutPreview'

export default function App() {
  return (
    <AuthProvider>
      <AthleteAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/athlete/forgot-password" element={<AthleteForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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

            <Route path="/athlete/login" element={<AthleteLogin />} />
            <Route path="/athlete/invite/:token" element={<AthleteInviteAccept />} />
            <Route path="/athlete" element={<ProtectedAthleteRoute><AthletePortalLayout /></ProtectedAthleteRoute>}>
              <Route index element={<AthleteToday />} />
              <Route path="history" element={<AthleteHistory />} />
              <Route path="program" element={<AthleteProgram />} />
              <Route path="program/:workoutId" element={<AthleteWorkoutPreview />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AthleteAuthProvider>
    </AuthProvider>
  )
}
