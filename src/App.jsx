import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AthleteAuthProvider } from './hooks/useAthleteAuth'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedAthleteRoute from './components/ProtectedAthleteRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import AthleteForgotPassword from './pages/AthleteForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Today from './pages/Today'
import Library from './pages/Library'
import Workouts from './pages/Workouts'
import WorkoutBuilder from './pages/WorkoutBuilder'
import AthleteView from './pages/AthleteView'
import Athletes from './pages/Athletes'
import AthleteForm from './pages/AthleteForm'
import AthleteHub from './pages/AthleteHub'
import Programs from './pages/Programs'
import ProgramBuilder from './pages/ProgramBuilder'
import CustomExercise from './pages/CustomExercise'
import Inbox from './pages/Inbox'
import AthleteLogin from './pages/AthleteLogin'
import AthleteInviteAccept from './pages/AthleteInviteAccept'
import AthletePortalLayout from './pages/athlete/AthletePortalLayout'
import AthleteToday from './pages/athlete/AthleteToday'
import AthleteRun from './pages/athlete/AthleteRun'
import AthleteFinish from './pages/athlete/AthleteFinish'
import AthleteWeek from './pages/athlete/AthleteWeek'
import AthleteProgress from './pages/athlete/AthleteProgress'
import AthleteCoach from './pages/athlete/AthleteCoach'

// Old coach URLs (before the Today / Athletes / Inbox / Plan layout) keep
// working so bookmarks and installed-PWA shortcuts don't break.
function Redirect({ to }) {
  const params = useParams()
  return <Navigate to={to.replace(/:(\w+)/g, (_, k) => params[k] ?? '')} replace />
}

const guard = el => <ProtectedRoute>{el}</ProtectedRoute>

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

            <Route path="/today" element={guard(<Today />)} />
            <Route path="/athletes" element={guard(<Athletes />)} />
            <Route path="/athletes/new" element={guard(<AthleteForm />)} />
            <Route path="/athletes/:id" element={guard(<AthleteHub />)} />
            <Route path="/athletes/:id/edit" element={guard(<AthleteForm />)} />
            <Route path="/inbox" element={guard(<Inbox />)} />
            <Route path="/inbox/:athleteId" element={guard(<Inbox />)} />

            <Route path="/plan" element={<Navigate to="/plan/programs" replace />} />
            <Route path="/plan/programs" element={guard(<Programs />)} />
            <Route path="/plan/programs/new" element={guard(<ProgramBuilder />)} />
            <Route path="/plan/programs/:id" element={guard(<ProgramBuilder />)} />
            <Route path="/plan/workouts" element={guard(<Workouts />)} />
            <Route path="/plan/workouts/new" element={guard(<WorkoutBuilder />)} />
            <Route path="/plan/workouts/:id/edit" element={guard(<WorkoutBuilder />)} />
            <Route path="/plan/exercises" element={guard(<Library />)} />
            <Route path="/plan/exercises/new" element={guard(<CustomExercise />)} />
            <Route path="/plan/exercises/:id/edit" element={guard(<CustomExercise />)} />

            {/* History is folded into the Athlete hub (feedback, week) and Today (completed). */}
            <Route path="/history" element={<Navigate to="/today" replace />} />

            <Route path="/dashboard" element={<Navigate to="/today" replace />} />
            <Route path="/roster" element={<Navigate to="/athletes" replace />} />
            <Route path="/roster/new" element={<Navigate to="/athletes/new" replace />} />
            <Route path="/roster/:id" element={<Redirect to="/athletes/:id" />} />
            <Route path="/roster/:id/edit" element={<Redirect to="/athletes/:id/edit" />} />
            <Route path="/programs" element={<Navigate to="/plan/programs" replace />} />
            <Route path="/programs/new" element={<Navigate to="/plan/programs/new" replace />} />
            <Route path="/programs/:id" element={<Redirect to="/plan/programs/:id" />} />
            <Route path="/workout/new" element={<Navigate to="/plan/workouts/new" replace />} />
            <Route path="/workout/:id/edit" element={<Redirect to="/plan/workouts/:id/edit" />} />
            <Route path="/library" element={<Navigate to="/plan/exercises" replace />} />
            <Route path="/library/new" element={<Navigate to="/plan/exercises/new" replace />} />
            <Route path="/library/:id/edit" element={<Redirect to="/plan/exercises/:id/edit" />} />

            <Route path="/athlete/login" element={<AthleteLogin />} />
            <Route path="/athlete/invite/:token" element={<AthleteInviteAccept />} />
            <Route path="/athlete" element={<ProtectedAthleteRoute><AthletePortalLayout /></ProtectedAthleteRoute>}>
              <Route index element={<AthleteToday />} />
              <Route path="week" element={<AthleteWeek />} />
              <Route path="progress" element={<AthleteProgress />} />
              <Route path="coach" element={<AthleteCoach />} />
              <Route path="run/:workoutId" element={<AthleteRun />} />
              <Route path="finish/:workoutId" element={<AthleteFinish />} />
              {/* Old portal URLs */}
              <Route path="history" element={<Navigate to="/athlete/progress" replace />} />
              <Route path="program" element={<Navigate to="/athlete/week" replace />} />
              <Route path="program/:workoutId" element={<Navigate to="/athlete/week" replace />} />
            </Route>

            <Route path="/" element={<Navigate to="/today" replace />} />
          </Routes>
        </BrowserRouter>
      </AthleteAuthProvider>
    </AuthProvider>
  )
}
