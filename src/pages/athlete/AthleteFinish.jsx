import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { useWorkoutPreview } from '../../lib/useWorkoutPreview'
import { clearRun, readRun, runItems, runTotals } from '../../lib/runState'
import { shiftDateStr } from '../../lib/streaks'
import { fmtShort, fmtLong, daysBetween } from '../../lib/dates'
import { Button, Icon, Label } from '../../components/ui'

const FEELS = [['easy', 'Too easy', 'Could do more'], ['good', 'Good', 'Just right'], ['hard', 'Challenging', 'Had to work'], ['veryhard', 'Very hard', 'Near my limit']]

function Stat({ value, label }) {
  return (
    <div style={{ flex: 1, padding: '12px 8px', border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800 }}>{value}</div>
      <Label>{label}</Label>
    </div>
  )
}

// Finish and feedback (mockup A4): how it felt, effort, a note; then the
// streak result.
export default function AthleteFinish() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const p = useAthletePortal()
  const { workout, exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)
  const [feel, setFeel] = useState(null)
  const [rpe, setRpe] = useState(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const run = useMemo(() => readRun(p.athlete.id, p.today, workoutId), [])
  const items = useMemo(() => runItems(exercises, prehabExercises), [exercises, prehabExercises])
  const t = runTotals(items, run.done)
  const minutes = Math.max(1, Math.round((Date.now() - (run.startedAt || Date.now())) / 60000))
  const first = (p.coachName || 'your coach').split(' ')[0]

  const next = useMemo(() => {
    for (let i = 1; i <= 21; i++) {
      const date = shiftDateStr(p.today, i)
      const d = p.planFor(date)
      if (d.kind === 'due' && d.workout) return { date, ...d }
    }
    return null
  }, [p.planFor, p.today])

  if (!sent && p.feedbackByDate.has(p.today)) return <Navigate to="/athlete" replace />
  if (loading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading…</div>

  async function send() {
    setSending(true); setError('')
    const { error: e } = await supabase.rpc('submit_athlete_workout_feedback', {
      p_workout_id: workoutId, p_emoji_rating: feel, p_rpe: rpe, p_notes: note.trim() || null,
      p_exercises_completed: Math.min(t.exercisesDone, exercises.length), p_completed_date: p.today,
    })
    if (e) { setSending(false); setError(e.message); return }
    clearRun(p.athlete.id, p.today, workoutId)
    await p.refresh()
    setSending(false)
    setSent(true)
  }

  const wrap = { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }
  const body = { flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', boxSizing: 'border-box', padding: 'max(24px, calc(var(--sat) + 16px)) 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }
  const foot = { position: 'sticky', bottom: 0, background: 'var(--s1)', borderTop: '1px solid var(--br)', padding: '12px 16px calc(14px + env(safe-area-inset-bottom))' }

  if (sent) {
    const gap = p.best > p.streak ? p.best - p.streak : 0
    return (
      <div style={wrap}>
        <div style={body}>
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <span style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(199,228,92,.14)', color: 'var(--ac)', display: 'inline-grid', placeItems: 'center' }}><Icon name="flame" size={38} /></span>
            <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 40, fontWeight: 800, marginTop: 14 }}>{p.streak} day streak</h1>
            <p style={{ fontSize: 14.5, color: 'var(--mu2)', marginTop: 6 }}>Sent to Coach {first}. You'll see their reply under Coach.</p>
          </div>
          {next && (
            <div style={{ padding: 18, border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)' }}>
              <Label>Next up · {fmtShort(next.date)}</Label>
              <div style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 2px' }}>{next.workout.name}</div>
              <div style={{ fontSize: 13, color: 'var(--mu2)' }}>{daysBetween(p.today, next.date) === 1 ? 'Tomorrow' : fmtLong(next.date)} · {next.workout.exercises} exercises{next.workout.prehab ? ` with ${next.workout.prehab} prehab` : ''}.</div>
            </div>
          )}
          {gap > 0 && <div style={{ padding: '14px 18px', border: '1px solid var(--br)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><span style={{ fontSize: 14 }}>Your best streak is {p.best} days. {gap} to go.</span><span style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, color: 'var(--ac)' }}>{p.streak}</span></div>}
        </div>
        <div style={{ ...foot, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="primary" onClick={() => navigate('/athlete')} style={{ minHeight: 52 }}>Back to Today</Button>
          <Button onClick={() => navigate('/athlete/coach')} style={{ minHeight: 48 }}>Open Coach inbox</Button>
        </div>
      </div>
    )
  }

  const missing = !feel && !rpe
  return (
    <div style={wrap}>
      <div style={body}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(199,228,92,.14)', color: 'var(--ac)', display: 'inline-grid', placeItems: 'center' }}><Icon name="check" size={30} strokeWidth={2.6} /></span>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, marginTop: 10 }}>{workout?.name || 'Workout'} done</h1>
          <p style={{ fontSize: 14, color: 'var(--mu2)', marginTop: 4 }}>Streak goes to <b style={{ color: 'var(--tx)' }}>{p.streak + 1} days</b> once you send this.</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Stat value={t.totalSets ? `${t.doneSets}/${t.totalSets}` : '–'} label="Sets" />
          <Stat value={`${minutes}m`} label="Time" />
          <Stat value={t.prehabTotal ? (t.prehabDone >= t.prehabTotal ? 'Done' : `${t.prehabDone}/${t.prehabTotal}`) : '–'} label="Prehab" />
        </div>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>How did it feel?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {FEELS.map(([k, label, sub]) => (
              <button key={k} type="button" aria-pressed={feel === k} onClick={() => setFeel(feel === k ? null : k)}
                style={{ minHeight: 60, borderRadius: 14, border: `1px solid ${feel === k ? 'var(--ac)' : 'var(--br2)'}`, background: feel === k ? 'var(--ac)' : 'transparent', color: feel === k ? 'var(--ac-ink)' : 'var(--tx)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
                {label}<small style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8 }}>{sub}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Effort <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--mu2)' }}>1 easy, 10 maximum</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? null : n)}
                style={{ minHeight: 48, borderRadius: 12, border: `1px solid ${rpe === n ? 'var(--ac)' : 'var(--br2)'}`, background: rpe === n ? 'var(--ac)' : 'transparent', color: rpe === n ? 'var(--ac-ink)' : 'var(--tx)', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Anything your coach should know? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--mu2)' }}>Optional</span></h2>
          <textarea aria-label="Note for coach" placeholder="Shoulder felt tight on dips…" value={note} onChange={e => setNote(e.target.value)} rows={3}
            style={{ width: '100%', resize: 'none', background: 'var(--s1)', border: '1px solid var(--br2)', borderRadius: 12, color: 'var(--tx)', font: 'inherit', fontSize: 14.5, lineHeight: 1.5, padding: '10px 12px', outline: 'none' }} />
        </section>
        {error && <p role="alert" style={{ fontSize: 13, color: '#E2695A' }}>{error}</p>}
      </div>
      <div style={foot}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Button variant="primary" onClick={send} disabled={missing || sending} style={{ width: '100%', minHeight: 52, fontSize: 15 }}>{sending ? 'Sending…' : `Send to Coach ${first}`}</Button>
          <div style={{ fontSize: 12, color: 'var(--mu2)', textAlign: 'center', marginTop: 6 }}>{missing ? 'Pick how it felt or an effort number to send. Your streak counts either way.' : 'Your coach sees this today.'}</div>
        </div>
      </div>
    </div>
  )
}
