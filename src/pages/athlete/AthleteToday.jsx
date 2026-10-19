import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { useWorkoutPreview } from '../../lib/useWorkoutPreview'
import { buildWeek } from '../../lib/athleteWeek'
import { fmtLong, fmtShort, mondayOfStr, daysBetween } from '../../lib/dates'
import { shiftDateStr } from '../../lib/streaks'
import { Avatar, Button, Card, Chip, Dot, Icon, Label } from '../../components/ui'

const minutesFor = w => Math.max(5, Math.round((w.exercises * 6) + (w.prehab * 3)))
const stamp = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

function ExerciseList({ workoutId }) {
  const { exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)
  if (loading) return <div style={{ fontSize: 13, color: 'var(--mu2)' }}>Loading…</div>
  const dose = x => `${x.sets} × ${x.reps || (x.duration_seconds ? x.duration_seconds + 's' : '–')}`
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
      {prehabExercises.map(x => <li key={x.id}><span>{x.exercises?.name}</span> <span style={{ color: 'var(--mu)' }}>{dose(x)} · prehab</span></li>)}
      {exercises.map(x => <li key={x.id}><span>{x.exercises?.name}</span> <span style={{ color: 'var(--mu)' }}>{dose(x)}</span></li>)}
    </ol>
  )
}

export default function AthleteToday() {
  const navigate = useNavigate()
  const p = useAthletePortal()
  const { athlete, today, program } = p
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const plan = p.planFor(today)
  const logged = p.feedbackByDate.get(today)
  const first = athlete.full_name.split(' ')[0]
  const programWeek = useMemo(() => {
    if (!program || !athlete.program_started_on) return ''
    const mon = mondayOfStr(today)
    const diff = Math.round(daysBetween(mondayOfStr(athlete.program_started_on), mon) / 7)
    return `Week ${(((diff % program.duration_weeks) + program.duration_weeks) % program.duration_weeks) + 1}`
  }, [program, athlete, today])

  // Next scheduled training day after today.
  const next = useMemo(() => {
    for (let i = 1; i <= 21; i++) {
      const date = shiftDateStr(today, i)
      const d = p.planFor(date)
      if (d.kind === 'due' && d.workout) return { date, ...d }
    }
    return null
  }, [p.planFor, today])

  const week = buildWeek({ monday: mondayOfStr(today), athlete, program, cells: p.cells, overrides: p.overrides, feedbackByDate: p.feedbackByDate, today })
  const lastCoach = [...p.messages].reverse().find(m => m.sender !== 'athlete')

  async function logOptional() {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('submit_athlete_workout_feedback', {
      p_workout_id: plan.workoutId, p_emoji_rating: null, p_rpe: null, p_notes: null, p_exercises_completed: 0, p_completed_date: today,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    p.refresh()
  }

  const heading = (
    <div>
      <Label style={{ marginBottom: 4 }}>{fmtLong(today)}</Label>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, lineHeight: 1.05 }}>
        {logged ? 'Nice work today' : plan.kind === 'due' ? `Hey ${first}, you're up` : plan.kind === 'optional' ? 'Easy day' : 'Rest day'}
      </h1>
      {!logged && plan.kind === 'rest' && <p style={{ fontSize: 14, color: 'var(--mu2)', marginTop: 6, lineHeight: 1.5 }}>Nothing is due, so your streak is safe at {p.streak}.{next ? ` Next session is ${fmtShort(next.date).split(',')[0]}.` : ''}</p>}
    </div>
  )

  // Free day: no program, nothing scheduled, so pick from what the coach assigned.
  const freeChoice = !logged && plan.kind === 'due' && !plan.workoutId

  const main = (() => {
    if (logged) {
      return (
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(199,228,92,.14)', color: 'var(--ac)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={22} strokeWidth={2.4} /></span>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>{logged.workouts?.name || 'Workout'} logged</div><div style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 2 }}>Your streak is {p.streak} days. Your coach sees this today.</div></div>
          </div>
        </Card>
      )
    }
    if (freeChoice) {
      return (
        <Card style={{ padding: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>What are you logging today?</h2>
          <p style={{ fontSize: 13.5, color: 'var(--mu2)', margin: '6px 0 14px', lineHeight: 1.5 }}>You're not on a set program, so any completed workout keeps your streak going.</p>
          {p.assigned.length === 0
            ? <div style={{ padding: 18, textAlign: 'center', fontSize: 13.5, color: 'var(--mu2)', border: '1px solid var(--br)', borderRadius: 12 }}>No workouts assigned yet. Ask your coach.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{p.assigned.map(w => (
                <button key={w.id} type="button" onClick={() => navigate(`/athlete/run/${w.id}`)} style={{ minHeight: 56, padding: '10px 14px', textAlign: 'left', borderRadius: 12, border: '1px solid var(--br2)', background: 'transparent', color: 'var(--tx)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{w.name}</span><Icon name="forward" size={18} style={{ color: 'var(--mu)' }} />
                </button>))}</div>}
        </Card>
      )
    }
    if (plan.kind === 'due' && plan.workout) {
      const w = plan.workout
      return (
        <Card style={{ padding: 18, border: '1px solid rgba(199,228,92,.35)' }}>
          <Label style={{ marginBottom: 6 }}>Today{program ? ` · ${program.name} · ${programWeek}` : ''}</Label>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800 }}>{w.name}</h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--mu2)', margin: '8px 0 16px' }}>
            <span>{w.exercises} exercises</span>{w.prehab > 0 && <span>{w.prehab} prehab first</span>}<span>about {minutesFor(w)} min</span>
          </div>
          <Button variant="primary" onClick={() => navigate(`/athlete/run/${w.id}`)} style={{ width: '100%', minHeight: 52, fontSize: 15 }}><Icon name="forward" size={18} />Start workout</Button>
          <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ width: '100%', minHeight: 44, marginTop: 8, background: 'none', border: 'none', color: 'var(--mu2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{open ? 'Hide exercises' : 'Preview exercises'}</button>
          {open && <ExerciseList workoutId={w.id} />}
        </Card>
      )
    }
    return null
  })()

  const optional = !logged && plan.kind === 'optional' && plan.workout && (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><Label>Optional today</Label><Chip tone="accent">Counts toward streak</Chip></div>
      <h2 style={{ fontSize: 19, fontWeight: 700, margin: '8px 0 4px' }}>{plan.workout.name}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--mu2)', lineHeight: 1.5 }}>Skipping never breaks your streak.</p>
      <Button onClick={logOptional} disabled={busy} style={{ marginTop: 12, width: '100%' }}>{busy ? 'Logging…' : 'Log it as done'}</Button>
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A', marginTop: 8 }}>{error}</p>}
    </Card>
  )

  const nextCard = (!logged && plan.kind !== 'due') || logged ? next && (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><Label>Next up · {fmtShort(next.date)}</Label><span style={{ fontSize: 12, color: 'var(--mu2)' }}>{daysBetween(today, next.date) === 1 ? 'Tomorrow' : `In ${daysBetween(today, next.date)} days`}</span></div>
      <div style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 2px' }}>{next.workout.name}</div>
      <div style={{ fontSize: 13, color: 'var(--mu2)' }}>{next.workout.exercises} exercises{next.workout.prehab > 0 ? ` · ${next.workout.prehab} prehab` : ''} · about {minutesFor(next.workout)} min</div>
      <Link to="/athlete/week" style={{ display: 'inline-block', marginTop: 10, fontSize: 13.5, fontWeight: 600, color: 'var(--ac)' }}>See the full week</Link>
    </Card>
  ) : null

  const coachCard = lastCoach && (
    <Link to="/athlete/coach" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, border: '1px solid var(--br)', background: 'var(--s1)' }}>
      <Avatar name={p.coachName} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Coach {p.coachName.split(' ')[0]}</span>
          {p.coachUnread && <span role="img" aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: '#E2695A' }} />}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mu)' }}>{stamp(lastCoach.created_at)}</span>
        </span>
        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--mu2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastCoach.body}</span>
      </span>
    </Link>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {heading}
      {main}
      {optional}
      {nextCard}
      {coachCard}
      <Card style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>This week</h2><Link to="/athlete/week" style={{ fontSize: 13, color: 'var(--ac)' }}>See week</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {week.map(d => (
            <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Label>{d.label[0]}</Label>
              <Dot state={d.status === 'done' ? 'done' : d.date === today && d.kind === 'due' ? 'today' : d.status === 'missed' ? 'miss' : d.status === 'scheduled' ? 'future' : 'rest'} size={22} />
            </div>
          ))}
        </div>
        {!logged && plan.kind === 'due' && <p style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 12 }}>Log today and your streak goes to {p.streak + 1}.</p>}
        {logged && <p style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 12 }}>Streak: {p.streak} days.</p>}
      </Card>
    </div>
  )
}
