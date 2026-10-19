import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayLocal, shiftDateStr } from '../lib/streaks'
import { nextMondayStr, fmtShort } from '../lib/dates'
import { Button, Dialog, Label, Segmented } from './ui'

const cellType = c => c?.day_type || 'training'

// Bulk "Assign a program" from the Athletes table: choose when it starts and
// which program, see who it replaces and what each athlete sees first.
export default function AssignProgramDialog({ athletes, programs, coachId, onClose, onDone }) {
  const today = todayLocal()
  const monday = nextMondayStr(today)
  const [start, setStart] = useState('mon')
  const [pick, setPick] = useState(programs[0]?.id || null)
  const [days, setDays] = useState([]) // program_days for all programs
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!programs.length) return
    supabase.from('program_days')
      .select('program_id, week_number, day_of_week, day_type, workout_id, workouts(name, workout_prehab(id))')
      .in('program_id', programs.map(p => p.id))
      .then(({ data }) => setDays(data || []))
  }, [])

  const byProgram = useMemo(() => {
    const m = new Map()
    days.forEach(d => {
      if (!m.has(d.program_id)) m.set(d.program_id, new Map())
      m.get(d.program_id).set(`${d.week_number}:${d.day_of_week}`, d)
    })
    return m
  }, [days])

  const startDate = start === 'mon' ? monday : today
  const program = programs.find(p => p.id === pick)
  const perWeek = p => [...(byProgram.get(p.id)?.values() || [])].filter(d => d.week_number === 1 && d.workout_id && cellType(d) === 'training').length

  // First training day on or after the start date, inside the program's first two weeks.
  function firstSession() {
    const cells = byProgram.get(pick)
    if (!cells) return null
    for (let k = 0; k < 14; k++) {
      const date = shiftDateStr(startDate, k)
      const dow = (new Date(date + 'T00:00:00').getDay() + 6) % 7
      const week = Math.min(Math.floor((k + ((new Date(startDate + 'T00:00:00').getDay() + 6) % 7)) / 7) + 1, program.duration_weeks)
      const c = cells.get(`${week}:${dow}`)
      if (c?.workout_id && cellType(c) === 'training') return { date, name: c.workouts?.name, prehab: c.workouts?.workout_prehab?.length || 0 }
    }
    return null
  }
  const first = program ? firstSession() : null

  const moving = program ? athletes.filter(a => a.active_program_id && a.active_program_id !== program.id) : []
  const names = list => list.map(a => a.full_name).join(', ')

  async function confirm() {
    setSaving(true)
    setError('')
    const { error: e } = await supabase.from('athletes')
      .update({ active_program_id: program.id, program_started_on: startDate })
      .in('id', athletes.map(a => a.id)).eq('coach_id', coachId)
    setSaving(false)
    if (e) { setError(e.message); return }
    onDone(`Assigned ${program.name} to ${athletes.length} athlete${athletes.length === 1 ? '' : 's'}`)
    onClose()
  }

  return (
    <Dialog title="Assign a program" subtitle={`To ${names(athletes)}.`} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={confirm} disabled={!program || saving}>{saving ? 'Assigning…' : `Assign to ${athletes.length}`}</Button></>}>
      <div>
        <Label style={{ marginBottom: 8 }}>Starts</Label>
        <Segmented label="Start date" value={start} onChange={setStart}
          options={[{ value: 'mon', label: `Next Monday, ${fmtShort(monday).split(', ')[1]}` }, { value: 'today', label: `Today, ${fmtShort(today).split(', ')[1]}` }]} />
      </div>
      <div role="radiogroup" aria-label="Program" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {programs.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--mu2)' }}>No programs yet. Create one under Plan.</div>}
        {programs.map(p => {
          const on = pick === p.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--tx)',
                border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br2)'}`, background: on ? 'rgba(199,228,92,.07)' : 'transparent' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${on ? 'var(--ac)' : 'var(--br2)'}`, background: on ? 'radial-gradient(var(--ac) 45%, transparent 50%)' : 'transparent' }} />
              <span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)' }}>{p.duration_weeks} weeks · {perWeek(p)} sessions a week</span>
              </span>
            </button>
          )
        })}
      </div>
      {moving.length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(231,162,62,.08)', border: '1px solid rgba(231,162,62,.4)', fontSize: 13, lineHeight: 1.5 }}>
          <Label style={{ color: '#E7A23E' }}>Replaces a program</Label>
          <div style={{ marginTop: 3 }}>{names(moving)} {moving.length === 1 ? 'is' : 'are'} on another program and will move to {program.name}. Their streak and history stay.</div>
        </div>
      )}
      {program && (
        <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid var(--br2)', fontSize: 13, lineHeight: 1.5 }}>
          <Label>What they see first</Label>
          <div style={{ marginTop: 3 }}>
            {first ? `${fmtShort(first.date)} · first session is ${first.name}${first.prehab ? `, with ${first.prehab} prehab exercise${first.prehab === 1 ? '' : 's'} before it` : ''}.` : `${fmtShort(startDate)} · the program's first week.`}
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
    </Dialog>
  )
}
