import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { useWorkoutPreview } from '../../lib/useWorkoutPreview'
import { buildWeek, programWeekOf, weekRange } from '../../lib/athleteWeek'
import { mondayOfStr, fmtShort, DAY_SHORT } from '../../lib/dates'
import { shiftDateStr } from '../../lib/streaks'
import { Button, Card, Chip, Dialog, Icon, Label, UndoToast } from '../../components/ui'

function Exercises({ workoutId }) {
  const { exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)
  if (loading) return <div style={{ fontSize: 13, color: 'var(--mu2)' }}>Loading…</div>
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
      {prehabExercises.map(x => <li key={x.id}>{x.exercises?.name} <span style={{ color: 'var(--mu)' }}>· prehab</span></li>)}
      {exercises.map(x => <li key={x.id}>{x.exercises?.name}</li>)}
    </ol>
  )
}

const STATUS = { done: 'Done', missed: 'Missed', due: 'Due today', scheduled: 'Scheduled', optional: 'Optional · counts toward streak', rest: 'Rest day' }

// Week (mockup A5): this week and next, each day expandable, with a way to ask
// the coach to move a day.
export default function AthleteWeek() {
  const p = useAthletePortal()
  const { athlete, today, program } = p
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(today)
  const [ask, setAsk] = useState(null) // the day being moved
  const [toDay, setToDay] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const monday = shiftDateStr(mondayOfStr(today), offset * 7)
  const days = buildWeek({ monday, athlete, program, cells: p.cells, overrides: p.overrides, feedbackByDate: p.feedbackByDate, today })
  const weekNo = programWeekOf(athlete, program, monday)
  const dueDays = days.filter(d => d.kind === 'due')
  const doneDays = dueDays.filter(d => d.status === 'done').length
  const titleOf = d => (d.log ? d.log.workouts?.name : d.workoutId ? p.meta[d.workoutId]?.name : d.kind === 'optional' ? 'Recovery' : d.source === 'free' ? 'Any workout' : 'Rest')
  const pendingFor = date => p.requests.find(r => r.status === 'pending' && r.from_date === date)

  // Days the athlete could move to: upcoming, not the same day.
  const options = ask ? Array.from({ length: 14 }, (_, i) => shiftDateStr(today, i)).filter(d => d !== ask.date) : []

  async function sendRequest() {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('create_schedule_request', { p_from: ask.date, p_to: toDay, p_note: note.trim() || null })
    setBusy(false)
    if (e) { setError(e.message); return }
    setAsk(null); setToDay(null); setNote('')
    setToast('Request sent. Your coach will confirm or suggest another day.')
    p.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Label>{program ? program.name : 'Your week'}</Label>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginTop: 4 }}>{program && weekNo ? `Week ${weekNo} of ${program.duration_weeks}` : 'This week'}</h1>
        {dueDays.length > 0 && <div style={{ height: 6, borderRadius: 3, background: 'var(--br)', marginTop: 12 }}><div style={{ height: '100%', width: `${(doneDays / dueDays.length) * 100}%`, borderRadius: 3, background: 'var(--ac)' }} /></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--mu2)', marginTop: 6 }}>
          <span>{offset === 0 ? `${doneDays} of ${dueDays.length} sessions done` : 'Starts Monday'}</span><span>{weekRange(monday)}</span>
        </div>
      </div>

      <div role="group" aria-label="Week" style={{ display: 'flex', gap: 8 }}>
        {[[0, 'This week'], [1, 'Next week']].map(([n, label]) => (
          <button key={n} type="button" aria-pressed={offset === n} onClick={() => { setOffset(n); setOpen(n === 0 ? today : null) }}
            style={{ flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${offset === n ? 'var(--ac)' : 'var(--br2)'}`, background: offset === n ? 'var(--ac)' : 'transparent', color: offset === n ? 'var(--ac-ink)' : 'var(--tx)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      <Card style={{ overflow: 'hidden' }}>
        {days.map((d, i) => {
          const isOpen = open === d.date && (d.workoutId || d.log)
          const isToday = d.date === today
          const pending = pendingFor(d.date)
          const canAsk = !pending && d.date >= today && (d.status === 'due' || d.status === 'scheduled')
          return (
            <div key={d.date} style={{ borderTop: i ? '1px solid var(--br)' : 'none', background: isToday ? 'var(--s2)' : 'transparent' }}>
              <button type="button" aria-expanded={!!isOpen} onClick={() => setOpen(open === d.date ? null : d.date)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px', border: 'none', background: 'transparent', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 40, flexShrink: 0 }}><Label style={{ color: isToday ? 'var(--ac)' : undefined }}>{d.label.toUpperCase()}</Label><span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: isToday ? 'var(--ac)' : 'var(--tx)' }}>{d.num}</span></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: d.status === 'rest' ? 'var(--mu2)' : 'var(--tx)' }}>{titleOf(d)}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: pending ? '#E7A23E' : d.status === 'done' ? 'var(--ac)' : 'var(--mu2)', marginTop: 2 }}>
                    {pending ? 'Move requested. Your coach will reply.' : d.status === 'done' ? `Done${d.log?.rpe ? ` · RPE ${d.log.rpe}` : ''}` : STATUS[d.status] + (d.adjusted ? ' · changed by your coach' : '')}
                  </span>
                </span>
                {isToday && <Chip tone="accent">Today</Chip>}
                {(d.workoutId || d.log) && <Icon name="down" size={18} style={{ color: 'var(--mu)', transform: isOpen ? 'rotate(180deg)' : 'none' }} />}
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px 66px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Exercises workoutId={d.workoutId || d.log?.workout_id} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isToday && d.status === 'due' && d.workoutId && <Link to={`/athlete/run/${d.workoutId}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px', borderRadius: 10, background: 'var(--ac)', color: 'var(--ac-ink)', fontWeight: 700, fontSize: 14 }}>Start now</Link>}
                    {canAsk && <Button onClick={() => { setAsk(d); setToDay(null); setError('') }}>Ask coach to move</Button>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
      <p style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.5 }}>Your coach can change days for you. Changes show up here and in your Coach inbox.</p>

      {ask && (
        <Dialog title={`Move ${ask.long}?`} subtitle="Pick the day you would rather train. Your coach will confirm or suggest another." onClose={() => setAsk(null)} busy={busy}
          footer={<><Button onClick={() => setAsk(null)}>Cancel</Button><Button variant="primary" onClick={sendRequest} disabled={busy || !toDay}>{busy ? 'Sending…' : 'Send request'}</Button></>}>
          <div role="radiogroup" aria-label="New day" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: '38vh', overflowY: 'auto' }}>
            {options.map(date => {
              const on = toDay === date
              const plan = p.planFor(date)
              return (
                <button key={date} type="button" role="radio" aria-checked={on} onClick={() => setToDay(date)}
                  style={{ minHeight: 56, padding: '6px 10px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--tx)', border: `1px solid ${on ? 'var(--ac)' : 'var(--br2)'}`, background: on ? 'rgba(199,228,92,.07)' : 'transparent' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{fmtShort(date)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--mu2)' }}>{plan.kind === 'due' ? plan.name || 'Workout' : plan.kind === 'optional' ? 'Recovery' : 'Rest'}</span>
                </button>
              )
            })}
          </div>
          <textarea aria-label="Note for your coach" placeholder="Why? (optional)" value={note} onChange={e => setNote(e.target.value)} rows={2}
            style={{ width: '100%', resize: 'none', background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 12, color: 'var(--tx)', font: 'inherit', fontSize: 14, padding: '10px 12px', outline: 'none' }} />
          {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
        </Dialog>
      )}
      {toast && <UndoToast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
