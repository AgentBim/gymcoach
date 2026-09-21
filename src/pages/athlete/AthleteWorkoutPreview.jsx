import { useParams, useNavigate } from 'react-router-dom'
import { useWorkoutPreview } from '../../lib/useWorkoutPreview'
import WorkoutPreviewCard from '../../components/WorkoutPreviewCard'

// Read-only look at a program day's workout, reached by tapping a day in the
// Program tab. No checklist/timers/feedback here — that only happens when
// it's actually due, via the Today tab.
export default function AthleteWorkoutPreview() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { workout, exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)

  if (loading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading...</div>
  if (!workout) return (
    <div>
      <BackLink navigate={navigate} />
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mu)' }}>Workout not found</div>
    </div>
  )

  return (
    <div>
      <BackLink navigate={navigate} />
      <WorkoutPreviewCard workout={workout} exercises={exercises} prehabExercises={prehabExercises} />
    </div>
  )
}

function BackLink({ navigate }) {
  return (
    <div onClick={() => navigate('/athlete/program')} style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      ← Back to program
    </div>
  )
}
