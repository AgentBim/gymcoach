import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import WorkoutPreviewPanel from '../components/WorkoutPreviewPanel'
import GenerateProgramModal from '../components/GenerateProgramModal'
import CopyWeeksModal from '../components/CopyWeeksModal'
import ProgramToolsSheet from '../components/ProgramToolsSheet'
import FullProgramModal from '../components/FullProgramModal'
import { MUSCLE_COLORS } from '../lib/theme'
import { todayLocal } from '../lib/streaks'
import { nextMondayStr, fmtShort } from '../lib/dates'
import { impactForWeek, athleteWeek } from '../lib/programImpact'
import { DAYS, buildSavePayload, cellKey, copyWeeks, draftPreview, parseCellKey, pruneDraftWorkouts, weekHasDays } from '../lib/programGenerator'
import { Avatar, Button, Card, Chip, Dialog, Icon, Label, Segmented, UndoToast } from '../components/ui'

const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_TYPES = [['training', 'Training'], ['rest', 'Rest'], ['recovery', 'Recovery'], ['competition', 'Meet']]
const EMPTY_CELL = { day_type: 'training', workout_id: null, workout_ref: null, notes: '' }
const HISTORY_CAP = 10
const REF_PREFIX = 'ref:'
const WORKOUT_SELECT = 'id, name, program_generated, archived_at, workout_exercises(exercise_id, exercises(muscle_group)), workout_prehab(id)'

// Cell picker value -> cell fields. Draft workouts have no id yet, so their
// option values carry the draft ref instead.
function pickerUpdates(value) {
  if (!value) return { workout_id: null, workout_ref: null }
  if (value.startsWith(REF_PREFIX)) return { workout_id: null, workout_ref: value.slice(REF_PREFIX.length) }
  return { workout_id: value, workout_ref: null }
}
function pickerValue(cell) {
  if (cell?.workout_ref) return REF_PREFIX + cell.workout_ref
  return cell?.workout_id || ''
}

// Generated names read "{Program} · {Focus} {n} · W{week}". Inside the
// editor the program and the week are already on screen, so cells show just
// the part that tells workouts apart.
function cellLabel(workoutName, programName, week) {
  let label = workoutName
  const prefix = `${programName.trim()} · `
  if (programName.trim() && label.startsWith(prefix)) label = label.slice(prefix.length)
  const suffix = ` · W${week}`
  if (label.endsWith(suffix)) label = label.slice(0, -suffix.length)
  return label || workoutName
}

function GenTag() {
  return (
    <span title="Generated for this program"
      style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, letterSpacing: '.06em', color: 'var(--ac)', background: 'rgba(199,228,92,.12)', padding: '1px 5px', borderRadius: 4, lineHeight: 1.3 }}>GEN</span>
  )
}

const cellSig = c => (c ? `${c.day_type}|${c.workout_id || ''}|${c.workout_ref || ''}|${c.notes || ''}` : '')

export default function ProgramBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const today = todayLocal()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState(4)
  // The whole program is one in-memory draft until Save (see
  // docs/handoffs/program-tools.md):
  //   days:          { 'w1d0': { day_type, workout_id, workout_ref, notes } }
  //   draftWorkouts: { [ref]: { ref, id, name, focus, exercises, prehab } }
  //   history:       [{ days, draftWorkouts, weeks, label }], undo stack for tools
  const [days, setDays] = useState({})
  const [savedDays, setSavedDays] = useState({})
  const [draftWorkouts, setDraftWorkouts] = useState({})
  const [history, setHistory] = useState([])
  const [workouts, setWorkouts] = useState([]) // cell picker: hand-built + this program's generated
  const [linkedWorkouts, setLinkedWorkouts] = useState([]) // workouts the saved schedule already uses
  const [athletes, setAthletes] = useState([]) // all of the coach's athletes
  const [pool, setPool] = useState(null) // exercise library, loaded once
  const [poolError, setPoolError] = useState('')
  const [activeCell, setActiveCell] = useState(null) // 'w1d0'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewWeek, setViewWeek] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [previewPanel, setPreviewPanel] = useState(null)
  const [fillOpen, setFillOpen] = useState(false)
  const [copySource, setCopySource] = useState(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [fullOpen, setFullOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [toast, setToast] = useState('')
  const errorRef = useRef(null)

  useEffect(() => { fetchWorkouts() }, [user, id])
  useEffect(() => { if (isEdit) fetchProgram() }, [id])
  useEffect(() => { fetchAthletes() }, [user])
  useEffect(() => { ensurePool() }, [])
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [error])

  const workoutsById = useMemo(
    () => Object.fromEntries([...linkedWorkouts, ...workouts].map(w => [w.id, w])),
    [linkedWorkouts, workouts]
  )
  const poolById = useMemo(() => Object.fromEntries((pool || []).map(e => [e.id, e])), [pool])
  const pendingWorkouts = useMemo(
    () => buildSavePayload(days, draftWorkouts, weeks).p_workouts.filter(w => !w.id).length,
    [days, draftWorkouts, weeks]
  )
  const onProgram = useMemo(() => athletes.filter(a => isEdit && a.active_program_id === id), [athletes, id, isEdit])

  async function fetchWorkouts() {
    if (!user) return
    // Program-generated workouts stay out of the picker unless they belong
    // to this program.
    let query = supabase.from('workouts').select(WORKOUT_SELECT).eq('coach_id', user.id)
    query = isEdit
      ? query.or(`program_generated.eq.false,source_program_id.eq.${id}`)
      : query.eq('program_generated', false)
    const { data } = await query.order('name')
    setWorkouts(data || [])
  }

  async function fetchAthletes() {
    if (!user) return
    const { data } = await supabase.from('athletes')
      .select('id, full_name, program_started_on, active_program_id').eq('coach_id', user.id).order('full_name')
    setAthletes(data || [])
  }

  async function fetchProgram() {
    const { data: prog } = await supabase.from('programs').select('*').eq('id', id).single()
    if (!prog) { setError('Program not found'); return }
    setName(prog.name)
    setDescription(prog.description || '')
    setWeeks(prog.duration_weeks)

    const { data: progDays } = await supabase
      .from('program_days')
      .select('*, workouts(' + WORKOUT_SELECT + ')')
      .eq('program_id', id)
    const dayMap = {}
    const linked = []
    ;(progDays || []).forEach(d => {
      dayMap[cellKey(d.week_number, d.day_of_week)] = {
        day_type: d.day_type,
        workout_id: d.workout_id,
        workout_ref: null,
        notes: d.notes || '',
      }
      if (d.workouts) linked.push(d.workouts)
    })
    setDays(dayMap)
    setSavedDays(dayMap)
    setLinkedWorkouts(linked)
    setDraftWorkouts({})
    setHistory([])
    setDirty(false)
  }

  async function ensurePool() {
    if (pool) return
    setPoolError('')
    const { data, error: poolFetchError } = await supabase.from('exercises').select('*')
    if (poolFetchError) { setPoolError(poolFetchError.message); return }
    setPool(data || [])
  }

  function setCell(key, updates) {
    setDirty(true)
    setDays(prev => ({ ...prev, [key]: { ...(prev[key] || EMPTY_CELL), ...updates } }))
  }

  function clearCell(key) {
    setDirty(true)
    setDays(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  // Cells beyond the new count stay in the draft (growing the count again
  // brings them back) but are never saved: buildSavePayload drops them.
  function changeWeeks(delta) {
    const next = Math.min(12, Math.max(1, weeks + delta))
    if (next === weeks) return
    setWeeks(next)
    setDirty(true)
    setViewWeek(v => Math.min(v, next))
    setActiveCell(c => (c && parseCellKey(c).week > next ? null : c))
  }

  // Every tool snapshots the draft first, so each run can be undone. The
  // week count is part of the snapshot: Generate full program sets it.
  function applyTool(label, nextDays, nextDraftWorkouts, nextWeeks = weeks) {
    setHistory(prev => [...prev, { days, draftWorkouts, weeks, label }].slice(-HISTORY_CAP))
    setDays(nextDays)
    setDraftWorkouts(pruneDraftWorkouts(nextDays, nextDraftWorkouts))
    if (nextWeeks !== weeks) {
      setWeeks(nextWeeks)
      setViewWeek(v => Math.min(v, nextWeeks))
    }
    setDirty(true)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setDays(last.days)
    setDraftWorkouts(last.draftWorkouts)
    setWeeks(last.weeks)
    setViewWeek(v => Math.min(v, last.weeks))
    setActiveCell(null)
    setPreviewPanel(null)
  }

  function openTool(toolId) {
    setToolsOpen(false)
    if (toolId === 'full') { ensurePool(); setFullOpen(true) }
    if (toolId === 'fill') { ensurePool(); setFillOpen(true) }
    if (toolId === 'copy') openCopyWeeks(isMobile ? viewWeek : 1)
  }

  // Replaces the whole draft (hand-picked cells included) and the week
  // count; Undo brings both back.
  function handleFullProgram({ days: nextDays, draftWorkouts: nextDrafts, weeks: nextWeeks }) {
    applyTool('Generate full program', nextDays, nextDrafts, nextWeeks)
    setFullOpen(false)
    setViewWeek(1)
    setActiveCell(null)
  }

  function handleFillWeek({ week, results, restDayIdxs }) {
    const nextDays = { ...days }
    const nextDrafts = { ...draftWorkouts }
    results.forEach(({ dayIdx, workout }) => {
      const key = cellKey(week, dayIdx)
      nextDays[key] = { ...EMPTY_CELL, ...days[key], day_type: 'training', workout_id: null, workout_ref: workout.ref }
      nextDrafts[workout.ref] = workout
    })
    restDayIdxs.forEach(dayIdx => {
      const key = cellKey(week, dayIdx)
      nextDays[key] = { ...EMPTY_CELL, ...days[key], day_type: 'rest', workout_id: null, workout_ref: null }
    })
    applyTool('Fill a week', nextDays, nextDrafts)
    setFillOpen(false)
    if (isMobile) setViewWeek(week)
  }

  // Clones are draft workouts too, so load the exercise pool for previewing them.
  function openCopyWeeks(week) {
    ensurePool()
    setCopySource(week)
  }

  function handleCopyWeeks({ days: nextDays, draftWorkouts: nextDrafts }) {
    applyTool('Copy weeks', nextDays, nextDrafts)
    setCopySource(null)
  }

  // "Copy down": week N onto week N+1, linked to the same workouts.
  function copyDown(week) {
    const r = copyWeeks({ days, draftWorkouts }, { source: week, targets: [week + 1], mode: 'link', conflict: 'replace', copyDayTypes: true, copyNotes: true, progress: false })
    applyTool('Copy down', r.days, r.draftWorkouts)
    setToast(`Week ${week} copied to week ${week + 1}`)
  }

  // What a cell's workout is, whether saved or still a draft.
  function cellWorkout(cell) {
    if (cell?.workout_ref) {
      const draft = draftWorkouts[cell.workout_ref]
      return draft ? { draftRef: draft.ref, name: draft.name, generated: true, count: draft.exercises.length } : null
    }
    if (cell?.workout_id) {
      const saved = workoutsById[cell.workout_id]
      return { id: cell.workout_id, name: saved?.name || 'Workout', generated: Boolean(saved?.program_generated), count: saved?.workout_exercises?.length ?? null }
    }
    return null
  }

  function leave() {
    if (dirty && !window.confirm('You have unsaved changes to this program. Leave without saving?')) return
    navigate('/plan/programs')
  }

  // Editing a workout leaves this page, which would lose the draft.
  function viewWorkout(workoutId, { confirmIfDirty = false } = {}) {
    if (!workoutId) return
    if (confirmIfDirty && dirty && !window.confirm('You have unsaved changes to this program. Leave without saving?')) return
    navigate(`/plan/workouts/${workoutId}/edit`)
  }

  function openPreview(workout, anchorEl, confirmIfDirty) {
    if (!workout) return
    setPreviewPanel({ workoutId: workout.id || null, draftRef: workout.draftRef || null, anchorRect: anchorEl.getBoundingClientRect(), confirmIfDirty })
  }

  // ── save ──
  const changedDays = useMemo(() => {
    const keys = new Set([...Object.keys(days), ...Object.keys(savedDays)])
    let n = 0
    keys.forEach(k => { if (parseCellKey(k)?.week <= weeks && cellSig(days[k]) !== cellSig(savedDays[k])) n++ })
    return n
  }, [days, savedDays, weeks])

  function askSave() {
    if (!name.trim()) { setError('Program name is required'); return }
    if (!dirty) { setToast('Nothing to save'); return }
    setError('')
    if (isEdit && onProgram.length > 0) setConfirmOpen(true)
    else save()
  }

  // One transaction (save_program): the program, its new generated workouts
  // and the full schedule. On failure nothing changed server-side, so the
  // draft stays as it is and the error shows here.
  async function save() {
    setConfirmOpen(false)
    setSaving(true); setError('')
    const { p_days, p_workouts } = buildSavePayload(days, draftWorkouts, weeks)
    const { data, error: saveError } = await supabase.rpc('save_program', {
      p_program_id: id || null,
      p_name: name.trim(),
      p_description: description,
      p_weeks: weeks,
      p_workouts,
      p_days,
    })
    setSaving(false)
    if (saveError) { setError(saveError.message || 'Could not save the program'); return }
    setDirty(false)
    if (!isEdit) { navigate(`/plan/programs/${data}`, { replace: true }); return }
    await Promise.all([fetchProgram(), fetchWorkouts()])
    setToast(onProgram.length ? `Saved. ${onProgram.length} athlete${onProgram.length === 1 ? ' sees' : 's see'} it in their portal.` : 'Saved.')
  }

  // ── athletes on this program (applies immediately, separate from the draft) ──
  const startDate = nextMondayStr(today)
  async function addAthlete(a) {
    const { error: e } = await supabase.from('athletes').update({ active_program_id: id, program_started_on: startDate }).eq('id', a.id)
    if (e) { setToast(e.message); return }
    setToast(`${a.full_name} added, starts ${fmtShort(startDate)}`)
    fetchAthletes()
  }
  async function removeAthlete(a) {
    const { error: e } = await supabase.from('athletes').update({ active_program_id: null, program_started_on: null }).eq('id', a.id)
    if (e) { setToast(e.message); return }
    setToast(`${a.full_name} removed from program`)
    fetchAthletes()
  }

  // ── derived view data ──
  const handBuilt = workouts.filter(w => !w.program_generated && !w.archived_at)
  const programGenerated = workouts.filter(w => w.program_generated)
  const drafts = Object.values(draftWorkouts)
  const perWeek = Array.from({ length: 7 }, (_, d) => days[cellKey(1, d)]).filter(c => c?.day_type === 'training').length

  const weekNow = week => onProgram.some(a => athleteWeek(a, weeks, today).week === week)

  const balance = useMemo(() => {
    const counts = {}
    let total = 0
    const add = g => { if (g) { counts[g] = (counts[g] || 0) + 1; total++ } }
    Object.entries(days).forEach(([key, cell]) => {
      if (parseCellKey(key)?.week > weeks) return
      if (cell.workout_ref && draftWorkouts[cell.workout_ref]) draftWorkouts[cell.workout_ref].exercises.forEach(x => add(poolById[x.exercise_id]?.muscle_group))
      else if (cell.workout_id) (workoutsById[cell.workout_id]?.workout_exercises || []).forEach(x => add(x.exercises?.muscle_group))
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ name: g, pct: Math.round((n / total) * 100) }))
  }, [days, draftWorkouts, workoutsById, poolById, weeks])

  const renderWorkoutOptions = (cell, emptyLabel) => {
    const extra = cell?.workout_id && !workouts.some(w => w.id === cell.workout_id) ? workoutsById[cell.workout_id] : null
    return (
      <>
        <option value="">{emptyLabel}</option>
        {extra && <option value={extra.id}>{extra.name}</option>}
        <optgroup label="Your workouts">
          {handBuilt.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </optgroup>
        {(programGenerated.length > 0 || drafts.length > 0) && (
          <optgroup label="This program's workouts">
            {programGenerated.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            {drafts.map(d => <option key={d.ref} value={REF_PREFIX + d.ref}>{d.name} (unsaved)</option>)}
          </optgroup>
        )}
      </>
    )
  }

  // How a cell reads in the grid and day list.
  function describeCell(cell, week) {
    if (!cell) return { title: 'Rest', meta: isMobile ? 'No session' : '', color: 'var(--mu2)', workout: null }
    const workout = cellWorkout(cell)
    if (cell.day_type === 'training') {
      return {
        title: workout ? cellLabel(workout.name, name, week) : 'No workout',
        meta: workout ? (workout.count != null ? `${workout.count} exercises` : '') : 'Pick a workout',
        color: 'var(--tx)', workout,
      }
    }
    if (cell.day_type === 'recovery') return { title: 'Recovery', meta: workout ? cellLabel(workout.name, name, week) : 'Easy day', color: '#6BA9DE', workout }
    if (cell.day_type === 'competition') return { title: 'Meet day', meta: 'Competition', color: '#E2695A', workout }
    return { title: 'Rest', meta: isMobile ? 'No session' : '', color: 'var(--mu2)', workout: null }
  }

  const lastTool = history[history.length - 1]
  const previewDraft = previewPanel?.draftRef && draftWorkouts[previewPanel.draftRef]
  const [selWeek, selDay] = activeCell ? [parseCellKey(activeCell).week, parseCellKey(activeCell).dayIdx] : [0, 0]
  const selCell = activeCell ? (days[activeCell] || EMPTY_CELL) : null
  const selWorkout = selCell ? cellWorkout(selCell) : null
  const impact = activeCell ? impactForWeek({ athletes: onProgram, week: selWeek, weeks, today }) : null
  const impactTone = impact && { amber: ['#E7A23E', 'rgba(231,162,62,.08)', 'rgba(231,162,62,.4)'], green: ['#4FB88A', 'rgba(79,184,138,.08)', 'rgba(79,184,138,.35)'], muted: ['var(--mu2)', 'var(--s2)', 'var(--br2)'] }[impact.tone]

  const setType = key => {
    const patch = { day_type: key }
    if (key === 'rest' || key === 'competition') { patch.workout_id = null; patch.workout_ref = null }
    setCell(activeCell, patch)
  }

  const inspector = selCell && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Label style={{ marginBottom: 8 }}>Day type</Label>
        <Segmented label="Day type" value={selCell.day_type} onChange={setType} options={DAY_TYPES.map(([value, label]) => ({ value, label }))} />
      </div>
      {(selCell.day_type === 'training' || selCell.day_type === 'recovery') && (
        <div>
          <label htmlFor="cell-workout"><Label style={{ marginBottom: 8 }}>Workout</Label></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select id="cell-workout" value={pickerValue(selCell)} onChange={e => setCell(activeCell, pickerUpdates(e.target.value))}
              style={{ flex: 1, minWidth: 0, minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 14 }}>
              {renderWorkoutOptions(selCell, '— no workout —')}
            </select>
          </div>
          {selWorkout && selWorkout.count != null && <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 6 }}>{selWorkout.count} exercises, about {selWorkout.count * 6} minutes</div>}
        </div>
      )}
      <div>
        <label htmlFor="cell-note"><Label style={{ marginBottom: 8 }}>Note for athletes</Label></label>
        <input id="cell-note" value={selCell.notes || ''} onChange={e => setCell(activeCell, { notes: e.target.value })} placeholder="Optional note for this day…"
          style={{ width: '100%', minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 14, outline: 'none' }} />
      </div>
      {isEdit && impact && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: impactTone[1], border: `1px solid ${impactTone[2]}`, fontSize: 13, lineHeight: 1.5 }}>
          <Label style={{ color: impactTone[0] }}>{impact.head}</Label>
          <div style={{ marginTop: 3 }}>{impact.text}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {selWorkout && <Button onClick={e => openPreview(selWorkout, e.currentTarget, true)}>Preview</Button>}
        {selWorkout?.id && <Button onClick={() => viewWorkout(selWorkout.id, { confirmIfDirty: true })}>Edit workout</Button>}
        {days[activeCell] && <Button variant="danger" onClick={() => { clearCell(activeCell); setActiveCell(null) }}>Clear</Button>}
      </div>
    </div>
  )

  const statusChip = dirty
    ? <Chip tone="amber">Unsaved changes</Chip>
    : <Chip tone={isEdit ? 'teal' : 'amber'}>{isEdit ? 'All changes saved' : 'Not saved yet'}</Chip>

  const toolsBtn = <Button onClick={() => setToolsOpen(true)} icon="tools" aria-label="Program tools" title="Generate, fill or copy weeks in this draft">{isMobile ? '' : 'Tools'}</Button>

  const banners = (
    <>
      {error && <div ref={errorRef} role="alert" style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(226,105,90,.1)', border: '1px solid rgba(226,105,90,.35)', color: '#E2695A', fontSize: 12.5, lineHeight: 1.45 }}>{error}</div>}
      {lastTool && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(199,228,92,.08)', border: '1px solid rgba(199,228,92,.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Generated draft, not saved yet</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginTop: 2 }}>
              {pendingWorkouts > 0 ? `${pendingWorkouts} program workout${pendingWorkouts === 1 ? ' is' : 's are'} created when you save` : 'Nothing changes until you save'}
            </div>
          </div>
          <Button size="sm" onClick={undo} title={`Undo ${lastTool.label}`}>Undo</Button>
        </div>
      )}
    </>
  )

  // ── desktop grid ──
  const grid = (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '68px repeat(7, minmax(0, 1fr))', gap: 6, alignItems: 'stretch' }}>
        <span />
        {DAYS.map(d => <Label key={d} style={{ textAlign: 'center', paddingBottom: 2 }}>{d}</Label>)}
        {Array.from({ length: weeks }, (_, w) => w + 1).map(week => renderWeekRow(week))}
      </div>
    </Card>
  )
  function renderWeekRow(week) {
    return (
      <Fragment key={week}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: weekNow(week) ? 'var(--ac)' : 'var(--mu2)' }}>Week {week}</span>
          {week < weeks && weekHasDays(days, week) && (
            <button type="button" onClick={() => copyDown(week)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--mu)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Copy down</button>
          )}
        </div>
        {DAYS.map((d, di) => {
          const key = cellKey(week, di)
          const cell = days[key]
          const info = describeCell(cell, week)
          const on = activeCell === key
          return (
            <button key={di} type="button" aria-pressed={on} aria-label={`Week ${week} ${d}: ${info.title}`} onClick={() => setActiveCell(on ? null : key)}
              style={{ minHeight: 64, padding: '8px 6px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center',
                background: !cell || cell.day_type === 'rest' ? 'transparent' : 'var(--s2)', border: `1px solid ${on ? 'var(--ac)' : 'var(--br)'}`, color: info.color, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.title}</span>{info.workout?.generated && <GenTag />}
              </span>
              {info.meta && <span style={{ fontSize: 10.5, color: 'var(--mu2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.meta}</span>}
            </button>
          )
        })}
      </Fragment>
    )
  }

  const athletesCard = isEdit && (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>On this program</h2><Label>{onProgram.length} athlete{onProgram.length === 1 ? '' : 's'}</Label>
      </div>
      {onProgram.map(a => {
        const w = athleteWeek(a, weeks, today)
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
            <Avatar name={a.full_name} size={28} />
            <Link to={`/athletes/${a.id}`} style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{a.full_name}</Link>
            <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{w.week ? `Week ${w.week}` : `Starts ${fmtShort(w.startsOn).split(',')[0]}`}</span>
            <button type="button" aria-label={`Remove ${a.full_name}`} onClick={() => removeAthlete(a)} style={{ width: 32, height: 32, background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
          </div>
        )
      })}
      <Button onClick={() => setAssignOpen(o => !o)} aria-expanded={assignOpen} icon={assignOpen ? 'check' : 'plus'} style={{ marginTop: 8, width: '100%' }}>{assignOpen ? 'Done' : 'Assign athletes'}</Button>
      {assignOpen && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {athletes.filter(a => a.active_program_id !== id).length === 0 && <div style={{ fontSize: 13, color: 'var(--mu2)', padding: 8 }}>Everyone is already on this program.</div>}
          {athletes.filter(a => a.active_program_id !== id).map(a => (
            <button key={a.id} type="button" onClick={() => addAthlete(a)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 6px', background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left' }}>
              <Avatar name={a.full_name} size={28} /><span style={{ flex: 1, fontSize: 13.5 }}>{a.full_name}</span><span style={{ fontSize: 12, color: 'var(--ac)', fontWeight: 600 }}>Add</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )

  const balanceCard = balance.length > 0 && (
    <Card style={{ padding: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Balance across the block</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {balance.map(b => {
          const c = MUSCLE_COLORS[b.name]?.color || 'var(--ac)'
          return (
            <div key={b.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span>{b.name}</span><span style={{ color: 'var(--mu2)', fontFamily: 'var(--mono)' }}>{b.pct}%</span></div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--br)' }}><div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 3, background: c }} /></div>
            </div>
          )
        })}
      </div>
    </Card>
  )

  const weekSteppers = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={() => changeWeeks(-1)} aria-label="Fewer weeks" style={stepBtn}>−</button>
      <span>{weeks} week{weeks === 1 ? '' : 's'}</span>
      <button type="button" onClick={() => changeWeeks(1)} aria-label="More weeks" style={stepBtn}>+</button>
    </span>
  )

  return (
    <Layout>
      <PlanTabs />
      <div style={{ padding: isMobile ? 'max(14px, calc(var(--sat) + 8px)) 16px 28px' : '24px 36px 36px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        <header style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {isMobile && <button type="button" onClick={leave} aria-label="Back to programs" style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'var(--mu2)' }}><Icon name="back" size={22} /></button>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!isMobile && <div style={{ fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{weekSteppers} · {perWeek} sessions a week</div>}
            <input aria-label="Program name" value={name} placeholder="Name this program" onChange={e => { setName(e.target.value); setDirty(true) }}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontFamily: 'var(--font-head)', fontSize: isMobile ? 26 : 40, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.1 }} />
          </div>
          {!isMobile && statusChip}
          {toolsBtn}
          <Button variant="primary" onClick={askSave} disabled={saving}>{saving ? 'Saving…' : isMobile ? 'Save' : 'Save program'}</Button>
        </header>

        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--mu2)' }}>
            {statusChip}<span style={{ flex: 1 }}>{weekSteppers} · {perWeek} sessions a week</span>{isEdit && <span>{onProgram.length} athletes</span>}
          </div>
        )}

        {banners}

        {isMobile ? (
          <>
            <div role="group" aria-label="Week" style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: weeks }, (_, w) => w + 1).map(w => (
                <button key={w} type="button" aria-pressed={viewWeek === w} onClick={() => setViewWeek(w)}
                  style={{ flex: 1, minHeight: 48, borderRadius: 12, border: `1px solid ${viewWeek === w ? 'var(--ac)' : 'var(--br2)'}`, background: viewWeek === w ? 'var(--ac)' : 'transparent', color: viewWeek === w ? 'var(--ac-ink)' : 'var(--tx)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  W{w}{weekNow(w) && <small style={{ fontSize: 10, fontWeight: 500, color: viewWeek === w ? 'var(--ac-ink)' : 'var(--mu2)' }}>now</small>}
                </button>
              ))}
            </div>
            <Card style={{ overflow: 'hidden' }}>
              {DAYS.map((d, di) => {
                const key = cellKey(viewWeek, di)
                const cell = days[key]
                const info = describeCell(cell, viewWeek)
                return (
                  <button key={di} type="button" aria-label={`${DAY_LONG[di]}: ${info.title}`} onClick={() => setActiveCell(key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px', border: 'none', borderTop: di ? '1px solid var(--br)' : 'none', background: 'transparent', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 38, flexShrink: 0 }}><Label>{d}</Label></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: info.color }}>{info.title}{info.workout?.generated && <GenTag />}</span>
                      {info.meta && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>{info.meta}</span>}
                    </span>
                    {cell?.notes && <Chip>Note</Chip>}
                    <Icon name="forward" size={18} style={{ color: 'var(--mu)' }} />
                  </button>
                )
              })}
            </Card>
            {viewWeek < weeks && weekHasDays(days, viewWeek) && <Button onClick={() => copyDown(viewWeek)}>Copy week {viewWeek} to week {viewWeek + 1}</Button>}
            <p style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.5 }}>Tap a day to change its type, workout or note.</p>
            {athletesCard}
            {balanceCard}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{grid}</div>
            <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selCell ? (
                <Card style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>Week {selWeek} · {DAYS[selDay]}</h2>
                    <button type="button" aria-label="Close editor" onClick={() => setActiveCell(null)} style={{ width: 32, height: 32, background: 'none', border: 'none', color: 'var(--mu2)', cursor: 'pointer' }}><Icon name="close" /></button>
                  </div>
                  {inspector}
                </Card>
              ) : (
                <Card style={{ padding: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700 }}>Pick a day</h2>
                  <p style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 6, lineHeight: 1.5 }}>Select any cell in the grid to set its type, workout and note here.</p>
                </Card>
              )}
              {athletesCard}
              {balanceCard}
            </aside>
          </div>
        )}
      </div>

      {/* Phone: edit-day sheet */}
      {isMobile && selCell && (
        <Dialog title={`Week ${selWeek} · ${DAY_LONG[selDay]}`} onClose={() => setActiveCell(null)}
          footer={<Button variant="primary" onClick={() => setActiveCell(null)} style={{ flex: 2 }}>Done</Button>}>
          {inspector}
        </Dialog>
      )}

      {confirmOpen && (
        <Dialog title={`Save ${name.trim() || 'program'}?`} subtitle={`${changedDays} day${changedDays === 1 ? '' : 's'} changed across the ${weeks} weeks.`} onClose={() => setConfirmOpen(false)}
          footer={<><Button onClick={() => setConfirmOpen(false)}>Keep editing</Button><Button variant="primary" onClick={save}>Save program</Button></>}>
          <div style={{ border: '1px solid var(--br2)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5, lineHeight: 1.5 }}>
            <div><Label style={{ marginBottom: 3 }}>Who sees it</Label>{onProgram.map(a => a.full_name).join(', ')}, in their portal</div>
            <div><Label style={{ marginBottom: 3 }}>When</Label>Right away. Athletes see the new schedule the next time they open their portal.</div>
          </div>
        </Dialog>
      )}

      {previewPanel && (
        <WorkoutPreviewPanel
          workoutId={previewPanel.workoutId}
          draftWorkout={previewDraft ? draftPreview(previewDraft, poolById) : null}
          anchorRect={previewPanel.anchorRect}
          onClose={() => setPreviewPanel(null)}
          onEdit={() => viewWorkout(previewPanel.workoutId, { confirmIfDirty: previewPanel.confirmIfDirty })}
        />
      )}

      {fillOpen && (
        <GenerateProgramModal programName={name} week={isMobile ? viewWeek : 1} weeks={weeks} days={days} pool={pool} poolError={poolError}
          onClose={() => setFillOpen(false)} onApply={handleFillWeek} />
      )}
      {toolsOpen && <ProgramToolsSheet onPick={openTool} onClose={() => setToolsOpen(false)} />}
      {fullOpen && (
        <FullProgramModal programName={name} initialWeeks={weeks} pool={pool} poolError={poolError} onClose={() => setFullOpen(false)} onApply={handleFullProgram} />
      )}
      {copySource && (
        <CopyWeeksModal programName={name} weeks={weeks} initialSource={copySource} days={days} draftWorkouts={draftWorkouts}
          onClose={() => setCopySource(null)} onApply={handleCopyWeeks} />
      )}

      {toast && <UndoToast message={toast} onClose={() => setToast('')} />}
    </Layout>
  )
}

const stepBtn = { width: 24, height: 24, border: '1px solid var(--br2)', borderRadius: 6, background: 'transparent', color: 'var(--tx)', fontSize: 14, lineHeight: 1, cursor: 'pointer' }
