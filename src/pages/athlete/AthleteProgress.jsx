import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { athleteStats } from '../../lib/athleteWeek'
import { feelOf } from '../../lib/feel'
import { fmtLong } from '../../lib/dates'
import { resolveDay } from '../../lib/streaks'
import { Button, Card, Chip, Label } from '../../components/ui'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Tile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, padding: '12px 10px', border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)' }}>
      <Label>{label}</Label>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--mu2)' }}>{sub}</div>
    </div>
  )
}

// Progress (mockup A6): streak, the month at a glance, and a tap-through to any day.
export default function AthleteProgress() {
  const p = useAthletePortal()
  const { signOut } = useAthleteAuth()
  const navigate = useNavigate()
  const { athlete, today, program } = p
  const [sel, setSel] = useState(today)

  const month = today.slice(0, 7)
  const first = `${month}-01`
  const lead = (new Date(first + 'T00:00:00').getDay() + 6) % 7
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const stats = useMemo(() => athleteStats({ feedback: p.feedback, athlete, program, cells: p.cells, overrides: p.overrides, today }), [p.feedback, athlete, program, p.cells, p.overrides, today])

  // Nothing was due before they started: the program's start, else their first log.
  const firstDate = program && athlete.program_started_on ? athlete.program_started_on : [...p.feedbackByDate.keys()].sort()[0] || today
  const kindOf = date => {
    if (p.feedbackByDate.has(date)) return 'done'
    if (date < firstDate) return 'rest'
    const d = resolveDay(date, program, athlete.program_started_on, p.cells, p.overrides)
    if (d.kind !== 'due') return 'rest'
    return date < today ? 'miss' : date === today ? 'due' : 'fut'
  }
  const monthDue = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(d => d <= today && (kindOf(d) === 'done' || kindOf(d) === 'miss'))
  const monthDone = monthDue.filter(d => kindOf(d) === 'done').length

  const log = p.feedbackByDate.get(sel)
  const kind = kindOf(sel)
  const feel = log && feelOf(log.emoji_rating)
  const reply = log && p.messages.find(m => m.sender === 'coach' && new Date(m.created_at) > new Date(log.submitted_at))
  const title = log ? log.workouts?.name : kind === 'rest' ? 'Rest day' : kind === 'due' ? p.planFor(sel).name || 'Due today' : kind === 'miss' ? 'Not logged' : 'Coming up'

  const cellStyle = k => ({
    done: { background: 'var(--ac)', color: 'var(--ac-ink)', border: '1px solid var(--ac)' },
    due: { background: 'transparent', color: 'var(--ac)', border: '1.5px solid var(--ac)' },
    rest: { background: 'transparent', color: 'var(--mu)', border: '1px solid transparent' },
    miss: { background: 'rgba(226,105,90,.14)', color: '#E2695A', border: '1px solid transparent' },
    fut: { background: 'transparent', color: 'var(--tx)', border: '1px solid var(--br)' },
  })[k]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800 }}>Progress</h1>
      <div style={{ display: 'flex', gap: 10 }}>
        <Tile label="Streak" value={p.streak} sub={`best ${p.best}`} />
        <Tile label="This month" value={stats.doneThisMonth} sub="sessions" />
        <Tile label="Avg effort" value={stats.avgRpe ?? '–'} sub="RPE" />
      </div>

      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{new Date(first + 'T00:00:00').toLocaleDateString('en-US', { month: 'long' })}</h2>
          <span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{monthDone} of {monthDue.length} due days</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>{DOW.map((d, i) => <Label key={i} style={{ textAlign: 'center' }}>{d}</Label>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`
            const k = kindOf(date)
            return (
              <button key={date} type="button" aria-pressed={sel === date} aria-label={`${fmtLong(date)}, ${k === 'done' ? 'done' : k === 'rest' ? 'rest day' : k === 'due' ? 'due today' : k === 'miss' ? 'missed' : 'upcoming'}`} onClick={() => setSel(date)}
                style={{ aspectRatio: '1', minHeight: 40, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: sel === date ? '2px solid var(--tx)' : 'none', outlineOffset: 1, ...cellStyle(k) }}>{i + 1}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--mu2)', marginTop: 12, flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--ac)' }}>●</span> Done</span><span><span style={{ color: 'var(--ac)' }}>○</span> Due today</span><span>Rest</span><span><span style={{ color: '#E2695A' }}>●</span> Missed</span>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <Label>{fmtLong(sel)}</Label>
        <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 8px' }}>{title}</div>
        {log && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {log.rpe && <Chip tone="text" mono>RPE {log.rpe}</Chip>}
            {feel && <Chip tone={feel.tone}>{feel.label}</Chip>}
            {log.exercises_total > 0 && <Chip>{log.exercises_completed}/{log.exercises_total} exercises</Chip>}
          </div>
        )}
        {log?.notes && <p style={{ fontSize: 14, color: 'var(--mu2)', marginTop: 10, lineHeight: 1.5 }}>"{log.notes}"</p>}
        {reply && <Link to="/athlete/coach" style={{ display: 'block', marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--s2)', fontSize: 13.5, lineHeight: 1.5 }}><span style={{ display: 'block', fontSize: 11.5, color: 'var(--mu)', marginBottom: 2 }}>Coach {p.coachName.split(' ')[0]} replied</span>{reply.body}</Link>}
        {!log && kind === 'rest' && <Chip>No session due</Chip>}
      </Card>

      <Button onClick={async () => { await signOut(); navigate('/athlete/login') }} style={{ alignSelf: 'flex-start' }}>Sign out</Button>
    </div>
  )
}
