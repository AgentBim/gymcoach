import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

function formatWork(we) {
  const sets = `${we.sets} sets`
  const reps = we.reps ? `× ${we.reps} reps` : we.duration_seconds ? `× ${we.duration_seconds}s` : ''
  const rest = `· Rest ${we.rest_seconds}s`
  return [sets, reps, rest].filter(Boolean).join(' ')
}

export default function AthleteView() {
  const { token } = useParams()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

    setWorkout(w)
    setExercises(ex || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)' }}>
      Loading workout...
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)', textAlign: 'center', padding: 20 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>Workout not found</p>
      <p style={{ fontSize: 14 }}>This link may be invalid or the workout was removed.</p>
    </div>
  )

  const muscleGroups = [...new Set(exercises.map(e => e.exercises?.muscle_group).filter(Boolean))]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'var(--ac)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🏆</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em' }}>GymCoach</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--mu)', background: 'var(--br)', padding: '3px 10px', borderRadius: 20 }}>Shared workout</span>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        {/* Workout meta */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>{workout.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 12 }}>
            Shared by {workout.coaches?.full_name || 'Your coach'} · {exercises.length} exercises
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {muscleGroups.map(g => {
              const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
              return <span key={g} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
            })}
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {exercises.map((we, i) => {
            const ex = we.exercises
            const c = GROUP_COLORS[ex?.muscle_group] || { bg: 'var(--br)', color: 'var(--mu)' }
            return (
              <div key={we.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 28, height: 28, background: 'rgba(168,237,82,.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ac)', flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{ex?.name}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{ex?.muscle_group}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac)', marginBottom: 6 }}>
                      {formatWork(we)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                      {ex?.description}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--mu)' }}>Made with GymCoach · <a href="/" style={{ color: 'var(--ac)' }}>gymcoach.app</a></p>
        </div>
      </div>
    </div>
  )
}
