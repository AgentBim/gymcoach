import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { WorkoutRunner } from '../components/WorkoutRunner'
import { todayLocal } from '../lib/streaks'

// ── Main page ────────────────────────────────────────────────────
export default function AthleteView() {
  const { token } = useParams()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [athleteName, setAthleteName] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  useEffect(() => { fetchWorkout() }, [token])

  async function fetchWorkout() {
    const { data: w } = await supabase
      .from('workouts')
      .select('*, coaches(full_name)')
      .eq('share_token', token)
      .single()

    if (!w) { setNotFound(true); setLoading(false); return }

    const { data: ex } = await supabase
      .from('workout_exercises')
      .select('*, exercises(*)')
      .eq('workout_id', w.id)
      .order('position')

    const { data: pre } = await supabase
      .from('workout_prehab')
      .select('*, exercises(*)')
      .eq('workout_id', w.id)
      .order('position')

    setWorkout(w)
    setExercises(ex || [])
    setPrehabExercises(pre || [])
    setLoading(false)
  }

  async function submitFeedback(payload) {
    await supabase.from('workout_feedback').insert({
      workout_id: workout.id,
      share_token: token,
      athlete_name: athleteName || null,
      completed_date: todayLocal(),
      ...payload,
    })
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
      <p style={{ fontSize: 13 }}>This link may be invalid or the workout was removed.</p>
    </div>
  )

  // Name prompt screen
  if (!nameSubmitted) {
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
          <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>What's your name?</div>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 14 }}>So your coach knows who completed this workout</div>
            <input
              value={athleteName}
              onChange={e => setAthleteName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setNameSubmitted(true)}
              placeholder="Your name..."
              autoFocus
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '11px 12px', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <button onClick={() => setNameSubmitted(true)}
              style={{ width: '100%', padding: 13, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Start workout →
            </button>
            <button onClick={() => { setAthleteName(''); setNameSubmitted(true) }}
              style={{ width: '100%', padding: 10, background: 'transparent', border: 'none', color: 'var(--mu)', fontSize: 12, cursor: 'pointer', marginTop: 6 }}>
              Skip
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
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em' }}>chalkup</span>
        </div>
        {allDone
          ? <span style={{ fontSize: 11, color: 'var(--ac)', background: 'rgba(168,237,82,.12)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>✓ Complete</span>
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
