import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import AssignWorkoutDialog from '../components/AssignWorkoutDialog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useWorkoutPreview } from '../lib/useWorkoutPreview'
import { useAthleteStreak } from '../hooks/useAthleteStreak'
import { todayLocal, shiftDateStr } from '../lib/streaks'
import { nextMondayStr, mondayOfStr, fmtShort, fmtMonthDay, DAY_LONG } from '../lib/dates'
import { athleteStats, buildWeek, programProgress, programWeekOf, weekRange, weeklyTrend } from '../lib/athleteWeek'
import { feelOf } from '../lib/rosterStatus'
import { Avatar, Button, Card, Chip, Dialog, EmptyState, Icon, Label, Page, Segmented, UndoToast } from '../components/ui'

const TYPE_OPTS = [{ value: 'training', label: 'Training' }, { value: 'rest', label: 'Rest' }, { value: 'recovery', label: 'Recovery' }]
const STATUS_TEXT = { done: 'Done', missed: 'Missed', due: 'Due, not logged', scheduled: 'Scheduled', optional: 'Optional', rest: '' }

function WorkoutList({ workoutId }) {
  const { exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)
  if (loading) return <div style={{ fontSize: 13, color: 'var(--mu2)' }}>Loading…</div>
  const rows = [...prehabExercises.map(x => ({ ...x, pre: true })), ...exercises]
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13.5 }}>
      {rows.map(x => <li key={x.id}>{x.exercises?.name}{x.pre && <span style={{ color: 'var(--mu)' }}> · prehab</span>}</li>)}
    </ol>
  )
}

function StatBox({ label, value }) {
  return (
    <Card style={{ padding: '12px 14px' }}>
      <Label>{label}</Label>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </Card>
  )
}

export default function AthleteHub() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const today = todayLocal()
  const { streak } = useAthleteStreak(id)

  const [loading, setLoading] = useState(true)
  const [athlete, setAthlete] = useState(null)
  const [programs, setPrograms] = useState([])
  const [cells, setCells] = useState(new Map())
  const [overrides, setOverrides] = useState(new Map())
  const [feedback, setFeedback] = useState([])
  const [assignments, setAssignments] = useState([])
  const [workoutOptions, setWorkoutOptions] = useState([])
  const [names, setNames] = useState({})
  const [offset, setOffset] = useState(0) // weeks from the current one
  const [day, setDay] = useState(today)
  const [adjusting, setAdjusting] = useState(false)
  const [pending, setPending] = useState({}) // date -> { day_type, workout_id } | 'revert'
  const [showList, setShowList] = useState(false)
  const [dialog, setDialog] = useState(null) // 'program' | 'shift' | 'assign' | 'reset'
  const [pickProgram, setPickProgram] = useState(null)
  const [shiftDate, setShiftDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data: a } = await supabase.from('athletes').select('*').eq('id', id).single()
    if (!a) { setLoading(false); return }
    const [progRes, daysRes, ovRes, fbRes, asRes, woRes] = await Promise.all([
      supabase.from('programs').select('id, name, duration_weeks').eq('coach_id', user.id).order('name'),
      a.active_program_id
        ? supabase.from('program_days').select('week_number, day_of_week, day_type, workout_id, notes, workouts(id, name)').eq('program_id', a.active_program_id)
        : Promise.resolve({ data: [] }),
      supabase.from('athlete_day_overrides').select('date, day_type, workout_id, notes, workouts(id, name)').eq('athlete_id', id),
      supabase.from('workout_feedback')
        .select('id, workout_id, completed_date, submitted_at, rpe, emoji_rating, notes, exercises_completed, exercises_total, workouts(id, name)')
        .eq('athlete_id', id).order('submitted_at', { ascending: false }),
      supabase.from('workout_assignments').select('id, assigned_at, assignment_token, workouts(id, name)').eq('athlete_id', id).is('revoked_at', null).order('assigned_at', { ascending: false }),
      supabase.from('workouts').select('id, name').eq('coach_id', user.id).eq('program_generated', false).is('archived_at', null).order('name'),
    ])
    const cellMap = new Map()
    const nm = {}
    ;(daysRes.data || []).forEach(d => {
      cellMap.set(`${d.week_number}:${d.day_of_week}`, { workout_id: d.workout_id, day_type: d.day_type, notes: d.notes })
      if (d.workouts) nm[d.workouts.id] = d.workouts.name
    })
    const ovMap = new Map()
    ;(ovRes.data || []).forEach(o => {
      ovMap.set(o.date, { day_type: o.day_type, workout_id: o.workout_id, notes: o.notes })
      if (o.workouts) nm[o.workouts.id] = o.workouts.name
    })
    ;(fbRes.data || []).forEach(f => { if (f.workouts) nm[f.workouts.id] = f.workouts.name })
    ;(woRes.data || []).forEach(w => { nm[w.id] = w.name })
    setAthlete(a)
    setPrograms(progRes.data || [])
    setCells(cellMap)
    setOverrides(ovMap)
    setFeedback(fbRes.data || [])
    setAssignments(asRes.data || [])
    setWorkoutOptions(woRes.data || [])
    setNames(nm)
    setLoading(false)
  }, [id, user])

  useEffect(() => { load() }, [load])

  const program = useMemo(() => programs.find(p => p.id === athlete?.active_program_id) || null, [programs, athlete])
  const feedbackByDate = useMemo(() => {
    const m = new Map()
    ;[...feedback].reverse().forEach(f => { if (f.completed_date) m.set(f.completed_date, f) })
    return m
  }, [feedback])
  const completedDates = useMemo(() => new Set(feedback.map(f => f.completed_date).filter(Boolean)), [feedback])

  const monday = shiftDateStr(mondayOfStr(today), offset * 7)
  const weekIsPast = shiftDateStr(monday, 6) < today
  const ignore = useMemo(() => new Set(Object.entries(pending).filter(([, v]) => v === 'revert').map(([d]) => d)), [pending])
  const effOverrides = useMemo(() => {
    const m = new Map(overrides)
    Object.entries(pending).forEach(([d, v]) => { if (v !== 'revert') m.set(d, { ...v, notes: null }) })
    return m
  }, [overrides, pending])

  const week = useMemo(() => athlete ? buildWeek({
    monday, athlete, program, cells, overrides: adjusting ? effOverrides : overrides, feedbackByDate, today, ignoreOverrideDates: adjusting ? ignore : new Set(),
  }) : [], [athlete, program, cells, overrides, effOverrides, ignore, adjusting, monday, feedbackByDate, today])

  const stats = athlete ? athleteStats({ feedback, athlete, program, cells, overrides, today }) : null
  const trend = useMemo(() => weeklyTrend({ feedback, today }), [feedback, today])
  const progress = athlete ? programProgress({ athlete, program, cells, completedDates, today }) : null
  const weekNo = athlete ? programWeekOf(athlete, program, monday) : null
  const hasUpcomingOverrides = [...overrides.keys()].some(d => d >= today)
  const first = athlete?.full_name?.split(' ')[0] || ''

  const pick = week.find(d => d.date === day) || week[0]
  const nameOf = wid => (wid ? names[wid] || 'Workout' : '')
  const titleOf = d => d.log ? nameOf(d.log.workout_id) || d.log.workouts?.name : d.kind === 'rest' ? (d.dayType === 'recovery' ? 'Recovery' : 'Rest') : (nameOf(d.workoutId) || (d.source === 'free' ? 'Any workout' : d.dayType === 'recovery' ? 'Recovery' : 'Rest'))

  function gotoWeek(next) {
    setOffset(next)
    const m = shiftDateStr(mondayOfStr(today), next * 7)
    setDay(next === 0 ? today : m)
    setShowList(false)
    setAdjusting(false)
    setPending({})
  }

  // ── adjust the week ──
  const editable = adjusting && pick && pick.status !== 'done' && pick.date >= today
  const pendingForDay = pending[pick?.date]
  function setType(type) {
    const keepW = pick.workoutId || workoutOptions[0]?.id || null
    setPending(p => ({ ...p, [pick.date]: { day_type: type, workout_id: type === 'rest' ? null : (type === 'training' ? keepW : null) } }))
  }
  function setWorkout(wid) {
    setPending(p => ({ ...p, [pick.date]: { day_type: pick.dayType === 'recovery' ? 'recovery' : 'training', workout_id: wid || null } }))
  }
  async function saveAdjust() {
    setBusy(true); setError('')
    const changes = Object.entries(pending).map(([date, v]) => v === 'revert'
      ? { date, day_type: null }
      : { date, day_type: v.day_type, workout_id: v.workout_id, notes: null })
    const { error: e } = await supabase.rpc('set_athlete_day_overrides', { p_athlete_id: id, p_today: today, p_changes: changes })
    setBusy(false)
    if (e) { setError(e.message); return }
    setAdjusting(false); setPending({})
    setToast(`${first}'s week updated. They see it in the portal now.`)
    load()
  }
  async function resetAll() {
    setBusy(true)
    const { error: e } = await supabase.rpc('reset_athlete_day_overrides', { p_athlete_id: id, p_from: today })
    setBusy(false)
    setDialog(null)
    if (e) { setToast(e.message); return }
    setToast(`${first} is back on the program week`)
    load()
  }

  // ── program ──
  async function changeProgram() {
    setBusy(true); setError('')
    const payload = pickProgram ? { active_program_id: pickProgram, program_started_on: nextMondayStr(today) } : { active_program_id: null, program_started_on: null }
    const { error: e } = await supabase.from('athletes').update(payload).eq('id', id)
    setBusy(false)
    if (e) { setError(e.message); return }
    setDialog(null)
    setToast(pickProgram ? `Program set to ${programs.find(p => p.id === pickProgram)?.name}` : 'Program removed')
    load()
  }
  async function shiftStart() {
    if (!shiftDate) return
    setBusy(true); setError('')
    const { error: e } = await supabase.from('athletes').update({ program_started_on: shiftDate }).eq('id', id)
    setBusy(false)
    if (e) { setError(e.message); return }
    setDialog(null)
    setToast(`Start moved to ${fmtShort(shiftDate)}`)
    load()
  }

  // ── portal ──
  async function invite() {
    const token = crypto.randomUUID()
    const { data } = await supabase.from('athletes').update({ invite_token: token, invite_sent_at: new Date().toISOString() }).eq('id', id).select().single()
    if (data) setAthlete(data)
  }
  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/athlete/invite/${athlete.invite_token}`)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }
  async function resetPortal() {
    setBusy(true)
    const { data, error: e } = await supabase.rpc('reset_athlete_portal_access', { p_athlete_id: id })
    setBusy(false)
    setDialog(null)
    if (e) { setToast(e.message); return }
    if (data) setAthlete(data)
    setToast('Portal access reset. Send a fresh invite link.')
  }
  async function removeAssignment(a) {
    await supabase.from('workout_assignments').delete().eq('id', a.id)
    setToast(`Removed ${a.workouts?.name}`)
    load()
  }
  function copyLink(a) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${a.assignment_token}`)
    setToast('Athlete link copied')
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading…</div></Layout>
  if (!athlete) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Athlete not found</div></Layout>

  const masked = athlete.email ? athlete.email.replace(/^(.).*(@.*)$/, '$1•••$2') : ''
  const portalChip = athlete.user_id ? <Chip tone="teal">Portal linked</Chip> : athlete.invite_token ? <Chip>Invite pending</Chip> : <Chip>No portal yet</Chip>
  const trendMax = Math.max(7, ...trend.map(t => t.sessions))

  // ── pieces ──
  const dayTiles = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: isMobile ? 6 : 8 }}>
      {week.map(d => {
        const on = d.date === pick.date
        return (
          <button key={d.date} type="button" aria-pressed={on} aria-label={`${d.long}, ${fmtMonthDay(d.date)}: ${titleOf(d)}`} onClick={() => { setDay(d.date); setShowList(false) }}
            style={{ minHeight: isMobile ? 64 : 92, padding: isMobile ? '8px 2px' : '10px 10px', borderRadius: 12, textAlign: isMobile ? 'center' : 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'stretch', gap: 3, color: 'var(--tx)', minWidth: 0,
              border: `1px solid ${on ? 'var(--ac)' : d.adjusted ? '#E7A23E' : d.status === 'due' ? '#4A5559' : 'var(--br)'}`,
              background: d.status === 'rest' ? 'transparent' : d.status === 'due' ? 'var(--s2)' : 'var(--s1)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: d.status === 'due' ? 'var(--ac)' : 'var(--mu)' }}>{isMobile ? d.label[0] : `${d.label.toUpperCase()} ${d.num}`}</span>
            {isMobile ? (
              <span style={{ marginTop: 6 }}>
                {d.status === 'done' ? <Icon name="check" size={18} style={{ color: 'var(--ac)' }} /> : d.status === 'due' ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--ac)' }} /> : d.status === 'missed' ? <Icon name="close" size={16} style={{ color: '#E2695A' }} /> : <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--br2)' }} />}
              </span>
            ) : (
              <>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: d.status === 'rest' ? 'var(--mu2)' : 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(d)}</span>
                {d.adjusted && <span style={{ fontSize: 10.5, color: '#E7A23E', fontWeight: 600 }}>Adjusted</span>}
                <span style={{ fontSize: 11.5, color: d.status === 'done' ? 'var(--ac)' : 'var(--mu2)', marginTop: 'auto' }}>
                  {d.status === 'done' ? `✓ Done${d.log?.rpe ? ` · RPE ${d.log.rpe}` : ''}` : STATUS_TEXT[d.status]}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )

  const sub = (pick.adjusted ? 'Adjusted for ' + first + '. ' : '') + ({
    done: `Completed and logged by ${first}`, missed: 'Due, nothing was logged', due: 'Due today, nothing logged yet', scheduled: `Scheduled for ${first}`,
    optional: 'Optional: counts toward the streak, never breaks it', rest: 'Rest day, no session scheduled',
  })[pick.status]

  const feel = pick.log && feelOf(pick.log.emoji_rating)
  const weekCard = (
    <Card>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" aria-label="Previous week" onClick={() => gotoWeek(offset - 1)} disabled={weekNo === null && offset <= -4}
            style={navBtn}><Icon name="back" size={16} /></button>
          <div style={{ minWidth: 120 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{weekNo ? `Week ${weekNo} of ${program.duration_weeks}` : offset === 0 ? 'This week' : 'Week'}</div>
            <div style={{ fontSize: 12, color: 'var(--mu2)' }}>{weekRange(monday)}</div>
          </div>
          <button type="button" aria-label="Next week" onClick={() => gotoWeek(offset + 1)} disabled={offset >= 8} style={navBtn}><Icon name="forward" size={16} /></button>
          <span style={{ flex: 1 }} />
          {program && <Chip>{program.name}</Chip>}
          {!adjusting && hasUpcomingOverrides && <><Chip tone="amber">Adjusted for {first}</Chip><Button size="sm" onClick={() => setDialog('reset')}>Reset to program</Button></>}
          {!adjusting && !weekIsPast && <Button size="sm" onClick={() => { setAdjusting(true); setPending({}) }}>Adjust week</Button>}
          {weekIsPast && <Chip>Finished, read only</Chip>}
        </div>

        {adjusting && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(231,162,62,.08)', border: '1px solid rgba(231,162,62,.4)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Adjusting {first}'s week only</div>
              <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2, lineHeight: 1.45 }}>{program ? `${program.name} and everyone else on it stay the same. ` : ''}Days {first} already did can't change. Pick a day to edit it.</div>
            </div>
            <Button variant="primary" size="sm" onClick={saveAdjust} disabled={busy || Object.keys(pending).length === 0}>{busy ? 'Saving…' : `Save for ${first}`}</Button>
            <Button size="sm" onClick={() => { setAdjusting(false); setPending({}) }}>Cancel</Button>
          </div>
        )}
        {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}

        {dayTiles}

        <div style={{ border: '1px solid var(--br)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Label>{pick.long}{pick.date === today ? ', today' : `, ${fmtMonthDay(pick.date)}`}</Label>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{pick.status === 'rest' ? 'Rest day' : titleOf(pick)}</div>
              <div style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 2 }}>{sub}</div>
            </div>
            {(pick.workoutId || pick.log?.workout_id) && <Button size="sm" onClick={() => setShowList(s => !s)}>{showList ? 'Hide workout' : 'Preview workout'}</Button>}
          </div>

          {pick.log && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pick.log.exercises_total > 0 && <Chip tone="text">Exercises {pick.log.exercises_completed}/{pick.log.exercises_total}</Chip>}
              {pick.log.rpe && <Chip tone="text" mono>RPE {pick.log.rpe}</Chip>}
              {feel && <Chip tone={feel.tone}>{feel.label}</Chip>}
            </div>
          )}

          {editable && (
            <div style={{ borderTop: '1px solid var(--br)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Change {pick.long} for {first} only</div>
              <Segmented label="Day type" value={pick.dayType === 'competition' ? 'rest' : pick.dayType} onChange={setType} options={TYPE_OPTS} />
              {(pick.dayType === 'training' || pick.dayType === 'recovery') && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label>Workout</Label>
                  <select value={pick.workoutId || ''} onChange={e => setWorkout(e.target.value)}
                    style={{ minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 14 }}>
                    <option value="">{pick.dayType === 'recovery' ? '— no workout —' : 'Pick a workout'}</option>
                    {pick.workoutId && !workoutOptions.some(w => w.id === pick.workoutId) && <option value={pick.workoutId}>{nameOf(pick.workoutId)}</option>}
                    {workoutOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              )}
              {(pendingForDay || pick.adjusted) && pendingForDay !== 'revert' && (
                <div><Button size="sm" onClick={() => setPending(p => ({ ...p, [pick.date]: 'revert' }))}>Back to the program's {pick.long}</Button></div>
              )}
            </div>
          )}
          {adjusting && pick.status === 'done' && <p style={{ fontSize: 13, color: 'var(--mu2)' }}>{first} already logged this day, so it stays as recorded.</p>}
          {showList && <WorkoutList workoutId={pick.workoutId || pick.log?.workout_id} />}
        </div>
      </div>
    </Card>
  )

  const feedbackCard = (
    <Card style={{ padding: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Recent feedback</h2>
      {feedback.length === 0 && <EmptyState>Nothing logged yet.</EmptyState>}
      {feedback.slice(0, 5).map(f => {
        const fl = feelOf(f.emoji_rating)
        return (
          <div key={f.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: '1px solid var(--br)' }}>
            <div style={{ width: 40, flexShrink: 0 }}><Label>{f.completed_date ? new Date(f.completed_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : ''}</Label></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14, fontWeight: 600 }}>
                {f.workouts?.name || 'Workout'}{fl && <Chip tone={fl.tone}>{fl.label}</Chip>}{f.rpe && <Chip mono>RPE {f.rpe}</Chip>}
              </div>
              <p style={{ fontSize: 13.5, color: f.notes ? 'var(--mu2)' : 'var(--mu)', marginTop: 4, lineHeight: 1.5 }}>{f.notes ? `"${f.notes}"` : 'No note'}</p>
            </div>
          </div>
        )
      })}
    </Card>
  )

  const programCard = (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Program</h2>
        <Chip tone={program ? 'accent' : 'neutral'}>{program ? 'Active' : 'None'}</Chip>
      </div>
      {program ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{program.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>
            {athlete.program_started_on > today ? `Starts ${fmtShort(athlete.program_started_on)}` : `Started ${fmtShort(athlete.program_started_on)}`} · repeats every {program.duration_weeks} weeks
          </div>
          {progress && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--br)' }}><div style={{ width: `${Math.min(100, progress.total ? (progress.done / progress.total) * 100 : 0)}%`, height: '100%', borderRadius: 3, background: 'var(--ac)' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mu2)', marginTop: 6 }}><span>Week {progress.week} of {program.duration_weeks}</span><span>{progress.done} of {progress.total} sessions</span></div>
            </div>
          )}
        </>
      ) : <p style={{ fontSize: 13.5, color: 'var(--mu2)', lineHeight: 1.5 }}>No program, so every day counts toward {first}'s streak.</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {program && <Button size="sm" onClick={() => navigate(`/plan/programs/${program.id}`)}>Open program</Button>}
        <Button size="sm" onClick={() => { setPickProgram(athlete.active_program_id); setError(''); setDialog('program') }}>Change</Button>
        {program && <Button size="sm" onClick={() => { setShiftDate(athlete.program_started_on || today); setError(''); setDialog('shift') }}>Shift start</Button>}
      </div>
    </Card>
  )

  const trendCard = (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Last 5 weeks</h2><Label>Sessions · RPE</Label>
      </div>
      <div role="img" aria-label={`Sessions done per week: ${trend.map(t => t.sessions).join(', ')}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
        {trend.map(t => (
          <div key={t.monday} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
            <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{t.sessions}</span>
            <span style={{ width: '100%', height: Math.max(4, (t.sessions / trendMax) * 60), borderRadius: 4, background: t.current ? 'rgba(199,228,92,.45)' : 'var(--ac)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {trend.map(t => <div key={t.monday} style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{t.label}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mu2)' }}>{t.rpe}</div></div>)}
      </div>
    </Card>
  )

  const extrasCard = (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Extra workouts</h2>
        <Button size="sm" onClick={() => setDialog('assign')}>Assign</Button>
      </div>
      {assignments.length === 0 && <p style={{ fontSize: 13, color: 'var(--mu2)', padding: '6px 0' }}>Nothing assigned outside the program.</p>}
      {assignments.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, borderTop: '1px solid var(--br)' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.workouts?.name}</span>
          <span style={{ fontSize: 12, color: 'var(--mu)' }}>Assigned {fmtMonthDay(a.assigned_at.slice(0, 10))}</span>
          <button type="button" aria-label={`Copy link for ${a.workouts?.name}`} onClick={() => copyLink(a)} style={iconBtn}><Icon name="link" size={15} /></button>
          <button type="button" aria-label={`Remove ${a.workouts?.name}`} onClick={() => removeAssignment(a)} style={iconBtn}><Icon name="close" size={15} /></button>
        </div>
      ))}
    </Card>
  )

  const portalCard = (
    <Card style={{ padding: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Portal access</h2>
      {athlete.user_id ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ac)' }}><Icon name="check" size={16} />Linked{masked ? ` to ${masked}` : ''}</div>
          <Button size="sm" variant="danger" style={{ marginTop: 12 }} onClick={() => setDialog('portal')}>Reset portal access</Button>
        </>
      ) : athlete.invite_token ? (
        <Button size="sm" icon={inviteCopied ? 'check' : 'link'} onClick={copyInvite}>{inviteCopied ? 'Copied' : 'Copy invite link'}</Button>
      ) : (
        <Button size="sm" variant="primary" onClick={invite}>Invite to portal</Button>
      )}
    </Card>
  )

  return (
    <Layout>
      <Page>
        <Link to="/athletes" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--mu2)', alignSelf: 'flex-start' }}><Icon name="back" size={15} />Athletes</Link>

        <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Avatar name={athlete.full_name} size={isMobile ? 52 : 60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-head)', fontSize: isMobile ? 30 : 40, fontWeight: 800, lineHeight: 1 }}>{athlete.full_name}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {athlete.group_name && <Chip>{athlete.group_name}</Chip>}
              {athlete.level && <Chip>{athlete.level}</Chip>}
              {portalChip}
              {isMobile && streak > 0 && <Chip tone="accent">{streak}-day streak</Chip>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate(`/athletes/${id}/edit`)}>Edit profile</Button>
          </div>
        </header>

        {!isMobile && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
            <StatBox label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
            <StatBox label="Done this month" value={stats.doneThisMonth} />
            <StatBox label="Avg RPE" value={stats.avgRpe ?? '–'} />
            <StatBox label="Follow-through" value={stats.followThrough == null ? '–' : `${stats.followThrough}%`} />
          </section>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {weekCard}
            {feedbackCard}
          </div>
          <div style={{ flex: '1 1 320px', maxWidth: isMobile ? 'none' : 400, minWidth: isMobile ? 0 : 300, width: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {programCard}
            {!isMobile && trendCard}
            {extrasCard}
            {portalCard}
            {athlete.notes && (
              <Card style={{ padding: 16 }}>
                <Label style={{ marginBottom: 6 }}>Notes</Label>
                <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{athlete.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </Page>

      {dialog === 'program' && (
        <Dialog title="Change program" subtitle={`${first} keeps their history. The new program starts next Monday, ${fmtShort(nextMondayStr(today))}.`} onClose={() => setDialog(null)} busy={busy}
          footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={changeProgram} disabled={busy}>{busy ? 'Saving…' : 'Save change'}</Button></>}>
          <div role="radiogroup" aria-label="Program" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...programs.map(p => ({ id: p.id, name: p.name, meta: `${p.duration_weeks} weeks` })), { id: null, name: 'No program', meta: `Every day counts toward ${first}'s streak` }].map(g => {
              const on = pickProgram === g.id
              return (
                <button key={g.id || 'none'} type="button" role="radio" aria-checked={on} onClick={() => setPickProgram(g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--tx)',
                    border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br2)'}`, background: on ? 'rgba(199,228,92,.07)' : 'transparent' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${on ? 'var(--ac)' : 'var(--br2)'}`, background: on ? 'radial-gradient(var(--ac) 45%, transparent 50%)' : 'transparent' }} />
                  <span><span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{g.name}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)' }}>{g.meta}</span></span>
                </button>
              )
            })}
          </div>
          {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
        </Dialog>
      )}

      {dialog === 'shift' && (
        <Dialog title="Shift start" subtitle="Week 1 is the calendar week of this date." onClose={() => setDialog(null)} busy={busy}
          footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={shiftStart} disabled={busy || !shiftDate}>{busy ? 'Saving…' : 'Save'}</Button></>}>
          <input type="date" aria-label="Program start date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
            style={{ minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 15 }} />
          {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
        </Dialog>
      )}

      {dialog === 'reset' && (
        <Dialog title={`Reset ${first}'s week?`} subtitle={`This removes every personal change from today on, so ${first} is back on the program.`} onClose={() => setDialog(null)} busy={busy}
          footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={resetAll} disabled={busy}>Reset to program</Button></>} />
      )}

      {dialog === 'portal' && (
        <Dialog title="Reset portal access?" subtitle={`${first}'s current login stops working and they'll need a fresh invite link. Workout history, streak and program stay intact.`} onClose={() => setDialog(null)} busy={busy}
          footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" onClick={resetPortal} disabled={busy}>{busy ? 'Resetting…' : 'Reset portal access'}</Button></>} />
      )}

      {dialog === 'assign' && (
        <AssignWorkoutDialog athletes={[athlete]} coachId={user.id} onClose={() => setDialog(null)} onDone={msg => { setToast(msg); load() }} />
      )}

      {toast && <UndoToast message={toast} onClose={() => setToast('')} />}
    </Layout>
  )
}

const navBtn = { width: 36, height: 36, display: 'grid', placeItems: 'center', border: '1px solid var(--br2)', borderRadius: 8, background: 'transparent', color: 'var(--tx)', cursor: 'pointer' }
const iconBtn = { width: 32, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', color: 'var(--mu2)', cursor: 'pointer' }
