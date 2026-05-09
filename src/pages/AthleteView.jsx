import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChalkUpLogo } from '../components/ChalkUpLogo'

const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

const EMOJIS = [
  { key: 'easy',      icon: '😴', label: 'Too easy' },
  { key: 'good',      icon: '😊', label: 'Good' },
  { key: 'hard',      icon: '💪', label: 'Challenging' },
  { key: 'veryhard',  icon: '🔥', label: 'Very hard' },
]

function formatWork(we) {
  const sets = `${we.sets} sets`
  const reps = we.reps
    ? `× ${we.reps} reps`
    : we.duration_seconds
    ? `× ${we.duration_seconds}s`
    : ''
  const rest = `· Rest ${we.rest_seconds}s`
  return [sets, reps, rest].filter(Boolean).join(' ')
}

// ── Timer component ──────────────────────────────────────────────
function ExerciseTimer({ duration, onDone }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            onDone && onDone()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const pct = ((duration - timeLeft) / duration) * 100
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ

  function toggle() { setRunning(r => !r) }
  function reset() { clearInterval(intervalRef.current); setRunning(false); setTimeLeft(duration) }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const display = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${timeLeft}s`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 8px' }}>
      <svg width={90} height={90} style={{ marginBottom: 10 }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="var(--br)" strokeWidth={5} />
        <circle cx={45} cy={45} r={r} fill="none" stroke="var(--ac)" strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" transform="rotate(-90 45 45)"
          style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }} />
        <text x={45} y={49} textAnchor="middle" fill="var(--ac)" fontSize={timeLeft === 0 ? 14 : 18} fontWeight={500} fontFamily="var(--font-sans)">
          {timeLeft === 0 ? 'Done!' : display}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={toggle} style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: running ? 'var(--br)' : 'var(--ac)', color: running ? 'var(--mu)' : '#0C1118',
          fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {running ? '⏸' : timeLeft === 0 ? '↺' : '▶'}
        </button>
        {timeLeft !== duration && (
          <button onClick={reset} style={{
            width: 44, height: 44, borderRadius: '50%', background: 'var(--br)', border: 'none',
            color: 'var(--mu)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↺</button>
        )}
      </div>
    </div>
  )
}

// ── Rest timer ───────────────────────────────────────────────────
function RestTimer({ seconds, onDone }) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            onDone && onDone()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '8px 10px', background: 'rgba(168,237,82,.06)', border: '1px solid rgba(168,237,82,.15)', borderRadius: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--mu)' }}>Rest — {timeLeft}s remaining</span>
      <div style={{ width: 80, height: 4, background: 'var(--br)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${(timeLeft / seconds) * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 4, transition: 'width 1s linear' }} />
      </div>
      <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--ac)', cursor: 'pointer' }}>Skip</button>
    </div>
  )
}

// ── Feedback form ────────────────────────────────────────────────
function FeedbackForm({ workout, exercises, shareToken, athleteName, onSubmit }) {
  const [emoji, setEmoji] = useState(null)
  const [rpe, setRpe] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setSaving(true)
    await supabase.from('workout_feedback').insert({
      workout_id: workout.id,
      share_token: shareToken,
      emoji_rating: emoji,
      rpe,
      notes: notes.trim() || null,
      exercises_completed: exercises.length,
      exercises_total: exercises.length,
      athlete_name: athleteName || null,
    })
    setSaving(false)
    setDone(true)
    onSubmit && onSubmit()
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }}>Feedback sent!</div>
      <div style={{ fontSize: 13, color: 'var(--mu)' }}>Your coach will see this.</div>
    </div>
  )

  return (
    <div style={{ padding: '20px 0 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--tx)', marginBottom: 4 }}>Workout complete!</div>
        <div style={{ fontSize: 13, color: 'var(--mu)' }}>Let your coach know how it went</div>
      </div>

      {/* Emoji */}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>How did it feel?</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {EMOJIS.map(e => (
            <div key={e.key} onClick={() => setEmoji(e.key)} style={{ textAlign: 'center', cursor: 'pointer', opacity: emoji && emoji !== e.key ? 0.35 : 1, transition: 'opacity .15s' }}>
              <div style={{ fontSize: 28, marginBottom: 4, filter: emoji === e.key ? 'none' : 'grayscale(0.3)' }}>{e.icon}</div>
              <div style={{ fontSize: 10, color: emoji === e.key ? 'var(--ac)' : 'var(--mu)', fontWeight: emoji === e.key ? 600 : 400 }}>{e.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RPE */}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Effort level (RPE)</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12 }}>1 = very easy · 10 = maximum effort</div>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => setRpe(n)} style={{
              width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: rpe === n ? 'var(--ac)' : 'var(--br)',
              color: rpe === n ? '#0C1118' : 'var(--mu)',
              transition: 'all .1s',
            }}>{n}</button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Note for coach (optional)</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Struggled with L-sit, wrists felt sore..."
          style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'none', height: 72, fontFamily: 'var(--font-sans)', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
      </div>

      <button onClick={submit} disabled={saving || (!emoji && !rpe)}
        style={{ width: '100%', padding: 14, background: emoji || rpe ? 'var(--ac)' : 'var(--br)', color: emoji || rpe ? '#0C1118' : 'var(--mu)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: emoji || rpe ? 'pointer' : 'default', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Sending...' : 'Send feedback to coach'}
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function AthleteView() {
  const { token } = useParams()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [checked, setChecked] = useState({})
  const [activeTimer, setActiveTimer] = useState(null) // exercise id
  const [restingAfter, setRestingAfter] = useState(null) // exercise id
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [athleteName, setAthleteName] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)

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

  const totalCount = exercises.length
  const checkedCount = Object.values(checked).filter(Boolean).length
  const allDone = totalCount > 0 && checkedCount === totalCount
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  function toggleCheck(id) {
    const nowChecked = !checked[id]
    setChecked(prev => ({ ...prev, [id]: nowChecked }))
    if (nowChecked && checkedCount + 1 === totalCount) {
      setTimeout(() => setShowFeedback(true), 600)
    }
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

  const muscleGroups = [...new Set(exercises.map(e => e.exercises?.muscle_group).filter(Boolean))]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChalkUpLogo size={24} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em' }}>chalkup</span>
        </div>
        {allDone
          ? <span style={{ fontSize: 11, color: 'var(--ac)', background: 'rgba(168,237,82,.12)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>✓ Complete</span>
          : <span style={{ fontSize: 11, color: 'var(--mu)' }}>{checkedCount}/{totalCount} done</span>
        }
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>
        {/* Workout meta */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>{workout.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 12 }}>
            {workout.coaches?.full_name ? `Coach ${workout.coaches.full_name.split(' ')[0]}` : 'Your coach'} · {exercises.length} exercises
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {muscleGroups.map(g => {
              const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
              return <span key={g} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
            })}
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--br)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ac)', borderRadius: 6, transition: 'width .4s ease' }} />
          </div>
          {checkedCount > 0 && (
            <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 5 }}>
              {checkedCount === totalCount ? '🎉 All done!' : `${checkedCount} of ${totalCount} completed`}
            </div>
          )}
        </div>

        {/* Exercise list */}
        {!showFeedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {exercises.map((we, i) => {
              const ex = we.exercises
              const c = GROUP_COLORS[ex?.muscle_group] || { bg: 'var(--br)', color: 'var(--mu)' }
              const isDone = checked[we.id]
              const isTimed = !!we.duration_seconds
              const timerActive = activeTimer === we.id
              const restActive = restingAfter === we.id

              return (
                <div key={we.id} style={{
                  background: isDone ? 'rgba(168,237,82,.04)' : 'var(--s2)',
                  border: `1px solid ${isDone ? 'rgba(168,237,82,.2)' : 'var(--br)'}`,
                  borderRadius: 14, padding: 16,
                  transition: 'all .2s',
                  opacity: isDone ? 0.75 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Number */}
                    <div style={{ width: 26, height: 26, background: isDone ? 'rgba(168,237,82,.15)' : 'rgba(168,237,82,.08)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ac)', flexShrink: 0, marginTop: 1 }}>
                      {isDone ? '✓' : i + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Name + badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{ex?.name}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{ex?.muscle_group}</span>
                      </div>

                      {/* Sets/reps/duration */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac)', marginBottom: 6 }}>
                        {formatWork(we)}
                      </div>

                      {/* Description */}
                      <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: isTimed && !isDone ? 10 : 0 }}>
                        {ex?.description}
                      </div>

                      {/* Timer (timed exercises) */}
                      {isTimed && !isDone && (
                        <>
                          {timerActive ? (
                            <ExerciseTimer
                              duration={we.duration_seconds}
                              onDone={() => {
                                setActiveTimer(null)
                                setRestingAfter(we.id)
                              }}
                            />
                          ) : (
                            <button onClick={() => setActiveTimer(we.id)} style={{
                              marginTop: 8, padding: '8px 16px', background: 'rgba(168,237,82,.1)', border: '1px solid rgba(168,237,82,.25)', borderRadius: 8, color: 'var(--ac)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}>
                              ▶ Start {we.duration_seconds}s timer
                            </button>
                          )}

                          {/* Rest timer */}
                          {restActive && (
                            <RestTimer
                              seconds={we.rest_seconds}
                              onDone={() => setRestingAfter(null)}
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div onClick={() => toggleCheck(we.id)} style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                      background: isDone ? 'var(--ac)' : 'transparent',
                      border: `2px solid ${isDone ? 'var(--ac)' : 'var(--br2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: '#0C1118', transition: 'all .15s',
                    }}>
                      {isDone ? '✓' : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Feedback form */}
        {showFeedback && (
          <FeedbackForm
            workout={workout}
            exercises={exercises}
            shareToken={token}
            athleteName={athleteName}
            onSubmit={() => setFeedbackDone(true)}
          />
        )}

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--mu)' }}>Made with chalkup</p>
        </div>
      </div>
    </div>
  )
}
