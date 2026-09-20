import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { MUSCLE_COLORS } from '../../lib/theme'

// Read-only look at a program day's workout, reached by tapping a day in the
// Program tab. No checklist/timers/feedback here — that only happens when
// it's actually due, via the Today tab.
export default function AthleteWorkoutPreview() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchWorkout() }, [workoutId])

  async function fetchWorkout() {
    setLoading(true)
    const { data: w } = await supabase.from('workouts').select('*').eq('id', workoutId).single()
    const { data: ex } = await supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', workoutId).order('position')
    const { data: pre } = await supabase.from('workout_prehab').select('*, exercises(*)').eq('workout_id', workoutId).order('position')
    setWorkout(w)
    setExercises(ex || [])
    setPrehabExercises(pre || [])
    setLoading(false)
  }

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
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-head)', color: 'var(--tx)' }}>{workout.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 4 }}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
      </div>

      {prehabExercises.length > 0 && (
        <div style={{ background: 'rgba(199,228,92,.07)', border: '1px solid rgba(199,228,92,.28)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ac)', marginBottom: 8 }}>🛡 Prehab · {prehabExercises.length}</div>
          {prehabExercises.map(wp => (
            <div key={wp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, color: 'var(--tx)' }}>
              <span>{wp.exercises?.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{wp.sets}×{wp.reps || `${wp.duration_seconds}s`}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((we, i) => {
          const ex = we.exercises
          const c = MUSCLE_COLORS[ex?.muscle_group] || { bg: 'var(--br)', color: 'var(--mu)' }
          return (
            <div key={we.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, display: 'flex', gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--br)', color: 'var(--mu)', fontFamily: 'var(--mono)', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{ex?.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.color, flexShrink: 0 }}>{ex?.muscle_group}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ac)', margin: '4px 0' }}>
                  {we.sets} × {we.reps || `${we.duration_seconds}s`} · Rest {we.rest_seconds}s
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.4 }}>{ex?.description}</div>
              </div>
            </div>
          )
        })}
      </div>
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
