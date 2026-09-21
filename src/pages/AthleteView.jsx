import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { WorkoutRunner } from '../components/WorkoutRunner'

// ── Main page ────────────────────────────────────────────────────
// Anonymous, no-account flow: the URL token is a per-assignment
// workout_assignments.assignment_token, resolved through the
// get_shared_workout/submit_workout_feedback RPCs (RLS has no anon table
// access at all here — those RPCs are the only sanctioned way in). This
// path doesn't count toward streaks, which require an authenticated
// athlete account (see the /athlete portal).
export default function AthleteView() {
  const { token } = useParams()
  const [workout, setWorkout] = useState(null)
  const [athleteName, setAthleteName] = useState('')
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [ready, setReady] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  useEffect(() => { fetchWorkout() }, [token])

  async function fetchWorkout() {
    const { data, error } = await supabase.rpc('get_shared_workout', { p_share_token: token })

    if (error || !data?.workout) { setNotFound(true); setLoading(false); return }

    setWorkout(data.workout)
    setAthleteName(data.workout.athlete_name || '')
    setExercises(data.exercises || [])
    setPrehabExercises(data.prehab || [])
    setLoading(false)
  }

  async function submitFeedback(payload) {
    const { error } = await supabase.rpc('submit_workout_feedback', {
      p_share_token: token,
      p_emoji_rating: payload.emoji_rating,
      p_rpe: payload.rpe,
      p_notes: payload.notes,
      p_exercises_completed: payload.exercises_completed,
    })
    if (error) throw error
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)' }}>
      Loading workout...
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)', textAlign: 'center', padding: 20 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }}>Workout not found</p>
      <p style={{ fontSize: 13 }}>This link may be invalid, expired, or revoked.</p>
    </div>
  )

  // Welcome screen — the assignment link already identifies the athlete,
  // no name prompt needed.
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, background: 'var(--ac)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>🏆</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ac)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>chalkup</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{workout?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--mu)' }}>
              {workout?.coaches?.full_name ? `From Coach ${workout.coaches.full_name.split(' ')[0]}` : 'Shared workout'}
            </div>
          </div>
          <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
            {athleteName && (
              <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 14 }}>Hey {athleteName.split(' ')[0]}, ready to go?</div>
            )}
            <button onClick={() => setReady(true)}
              style={{ width: '100%', padding: 13, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Start workout →
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalCount = exercises.length
  const allDone = feedbackDone

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
      {/* Header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '13px 20px', paddingTop: 'max(13px, calc(var(--sat) + 6px))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChalkUpLogo size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ac)', fontFamily: 'var(--font-head)' }}>chalkup</span>
        </div>
        {allDone
          ? <span style={{ fontSize: 11, color: 'var(--ac)', background: 'rgba(199,228,92,.12)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>✓ Complete</span>
          : <span style={{ fontSize: 11, color: 'var(--mu)' }}>{totalCount} exercises</span>
        }
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 12 }}>
            {workout.coaches?.full_name ? `Coach ${workout.coaches.full_name.split(' ')[0]}` : 'Your coach'}
          </p>
        </div>

        <WorkoutRunner
          workout={workout}
          exercises={exercises}
          prehabExercises={prehabExercises}
          onSubmitFeedback={submitFeedback}
          onFeedbackSubmitted={() => setFeedbackDone(true)}
        />

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--mu)' }}>Made with chalkup</p>
        </div>
      </div>
    </div>
  )
}
