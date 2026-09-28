import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import WorkoutPreviewPanel from '../components/WorkoutPreviewPanel'
import GenerateProgramModal from '../components/GenerateProgramModal'
import CopyWeeksModal from '../components/CopyWeeksModal'
import { DAY_TYPE_COLORS } from '../lib/theme'
import { DAYS, buildSavePayload, cellKey, draftPreview, parseCellKey, pruneDraftWorkouts, weekHasDays } from '../lib/programGenerator'

const DAY_TYPES = ['training', 'rest', 'recovery', 'competition'].map(key => ({ key, ...DAY_TYPE_COLORS[key] }))
const EMPTY_CELL = { day_type: 'training', workout_id: null, workout_ref: null, notes: '' }
const HISTORY_CAP = 10
const REF_PREFIX = 'ref:'

function getDayType(key) { return DAY_TYPES.find(d => d.key === key) || DAY_TYPES[0] }

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
// builder the program and the week are already on screen, so cells show just
// the part that tells workouts apart.
function cellLabel(workoutName, programName, week) {
  let label = workoutName
  const prefix = `${programName.trim()} · `
  if (programName.trim() && label.startsWith(prefix)) label = label.slice(prefix.length)
  const suffix = ` · W${week}`
  if (label.endsWith(suffix)) label = label.slice(0, -suffix.length)
  return label || workoutName
}

function GenTag({ compact }) {
  return (
    <span title="Generated for this program"
      style={{ fontFamily: 'var(--mono)', fontSize: compact ? 8.5 : 9.5, fontWeight: 600, letterSpacing: '.06em', color: 'var(--ac)', background: 'rgba(199,228,92,.12)', padding: compact ? '1px 4px' : '2px 6px', borderRadius: 4, flexShrink: 0, lineHeight: 1.3 }}>
      GEN
    </span>
  )
}

export default function ProgramBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState(4)
  // The whole program is one in-memory draft until Save (see
  // docs/handoffs/program-tools.md):
  //   days:          { 'w1d0': { day_type, workout_id, workout_ref, notes } }
  //   draftWorkouts: { [ref]: { ref, id, name, focus, exercises, prehab } }
  //   history:       [{ days, draftWorkouts, label }], undo stack for tools
  const [days, setDays] = useState({})
  const [draftWorkouts, setDraftWorkouts] = useState({})
  const [history, setHistory] = useState([])
  const [workouts, setWorkouts] = useState([]) // cell picker: hand-built + this program's generated
  const [linkedWorkouts, setLinkedWorkouts] = useState([]) // workouts the saved schedule already uses
  const [pool, setPool] = useState(null) // exercise library, loaded once when a tool first opens
  const [poolError, setPoolError] = useState('')
  const [activeCell, setActiveCell] = useState(null) // 'w1d0'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewWeek, setViewWeek] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [previewPanel, setPreviewPanel] = useState(null) // { workoutId, draftRef, anchorRect, confirmIfDirty }
  const [fillOpen, setFillOpen] = useState(false)
  const [copySource, setCopySource] = useState(null) // week the Copy weeks sheet opened from
  const errorRef = useRef(null)

  useEffect(() => { fetchWorkouts() }, [user, id])
  useEffect(() => { if (isEdit) fetchProgram() }, [id])
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

  async function fetchWorkouts() {
    if (!user) return
    // Program-generated workouts stay out of the picker unless they belong
    // to this program.
    let query = supabase.from('workouts').select('id, name, program_generated').eq('coach_id', user.id)
    query = isEdit
      ? query.or(`program_generated.eq.false,source_program_id.eq.${id}`)
      : query.eq('program_generated', false)
    const { data } = await query.order('name')
    setWorkouts(data || [])
  }

  async function fetchProgram() {
    const { data: prog } = await supabase.from('programs').select('*').eq('id', id).single()
    if (!prog) { setError('Program not found'); return }
    setName(prog.name)
    setDescription(prog.description || '')
    setWeeks(prog.duration_weeks)

    const { data: progDays } = await supabase
      .from('program_days')
      .select('*, workouts(id, name, program_generated)')
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
    setLinkedWorkouts(linked)
    setDraftWorkouts({})
    setHistory([])
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

  // Every tool snapshots the draft first, so each run can be undone.
  function applyTool(label, nextDays, nextDraftWorkouts) {
    setHistory(prev => [...prev, { days, draftWorkouts, label }].slice(-HISTORY_CAP))
    setDays(nextDays)
    setDraftWorkouts(pruneDraftWorkouts(nextDays, nextDraftWorkouts))
    setDirty(true)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setDays(last.days)
    setDraftWorkouts(last.draftWorkouts)
    setActiveCell(null)
    setPreviewPanel(null)
  }

  function openFillWeek() {
    ensurePool()
    setFillOpen(true)
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

  // Clones are draft workouts too, so load the exercise pool for previewing
  // them.
  function openCopyWeeks(week) {
    ensurePool()
    setCopySource(week)
  }

  function handleCopyWeeks({ days: nextDays, draftWorkouts: nextDrafts }) {
    applyTool('Copy weeks', nextDays, nextDrafts)
    setCopySource(null)
  }

  // What a cell's workout is, whether saved or still a draft.
  function cellWorkout(cell) {
    if (cell?.workout_ref) {
      const draft = draftWorkouts[cell.workout_ref]
      return draft ? { draftRef: draft.ref, name: draft.name, generated: true } : null
    }
    if (cell?.workout_id) {
      const saved = workoutsById[cell.workout_id]
      return { id: cell.workout_id, name: saved?.name || 'Workout', generated: Boolean(saved?.program_generated) }
    }
    return null
  }

  function leave() {
    if (dirty && !window.confirm('You have unsaved changes to this program. Leave without saving?')) return
    navigate('/programs')
  }

  // The whole program (name/weeks/every cell) is one in-memory draft until
  // "Save" is clicked — there's no per-cell commit boundary — so navigating
  // to a workout's edit screen loses the entire draft, not just this cell.
  // Opening the peek panel never triggers this — nothing is discarded by
  // just looking. It only applies to the panel's own "Edit workout" button.
  function viewWorkout(workoutId, { confirmIfDirty = false } = {}) {
    if (!workoutId) return
    if (confirmIfDirty && dirty && !window.confirm('You have unsaved changes to this program. Leave without saving?')) return
    navigate(`/workout/${workoutId}/edit`)
  }

  function openPreview(workout, anchorEl, confirmIfDirty) {
    if (!workout) return
    setPreviewPanel({ workoutId: workout.id || null, draftRef: workout.draftRef || null, anchorRect: anchorEl.getBoundingClientRect(), confirmIfDirty })
  }

  // One transaction (save_program): the program, its new generated workouts
  // and the full schedule. On failure nothing changed server-side, so the
  // draft stays as it is and the error shows here.
  async function save() {
    if (!name.trim()) { setError('Program name is required'); return }
    setSaving(true); setError('')
    const { p_days, p_workouts } = buildSavePayload(days, draftWorkouts, weeks)
    const { error: saveError } = await supabase.rpc('save_program', {
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
    navigate('/programs')
  }

  const weekData = Array.from({ length: weeks }, (_, i) => i + 1)
  const handBuilt = workouts.filter(w => !w.program_generated)
  const programGenerated = workouts.filter(w => w.program_generated)
  const drafts = Object.values(draftWorkouts)

  // Picker options: hand-built workouts, then this program's generated ones
  // (saved and unsaved). A workout the saved schedule uses but the picker
  // doesn't list is added so the select can still show it.
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

  // Desktop grid — 7 columns
  const renderWeekGrid = (week) => (
    <div key={week} style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Week {week}</span>
        {weeks > 1 && weekHasDays(days, week) && (
          <button type="button" onClick={() => openCopyWeeks(week)} title={`Copy week ${week} to other weeks`}
            style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 6px' }}>
            ⧉ Copy to…
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {DAYS.map((day, di) => {
          const key = cellKey(week, di)
          const cell = days[key]
          const dt = cell ? getDayType(cell.day_type) : null
          const workout = cellWorkout(cell)
          const isActive = activeCell === key
          return (
            <div key={di} onClick={() => setActiveCell(isActive ? null : key)}
              style={{
                position: 'relative',
                background: cell ? dt.bg : 'var(--br)',
                border: `1px solid ${isActive ? 'var(--ac)' : cell ? 'rgba(255,255,255,.08)' : 'transparent'}`,
                borderRadius: 8, padding: '10px 6px', cursor: 'pointer', textAlign: 'center', minHeight: 72,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                transition: 'all .15s',
              }}>
              {workout?.generated && <span style={{ position: 'absolute', top: 4, left: 4 }}><GenTag compact /></span>}
              {workout && (
                <span onClick={e => { e.stopPropagation(); openPreview(workout, e.currentTarget, false) }} title={`View ${workout.name}`}
                  style={{ position: 'absolute', top: 4, right: 4, fontSize: 11, lineHeight: 1, cursor: 'pointer', opacity: 0.75 }}>
                  👁
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{day}</div>
              {cell ? (
                <>
                  <div style={{ fontSize: 18 }}>{dt.icon}</div>
                  {workout && (() => {
                    const label = cellLabel(workout.name, name, week)
                    return <div title={workout.name} style={{ fontSize: 9, color: dt.color, fontWeight: 500, lineHeight: 1.2 }}>{label.length > 12 ? label.slice(0, 12) + '…' : label}</div>
                  })()}
                  {!workout && cell.day_type !== 'training' && <div style={{ fontSize: 9, color: dt.color }}>{dt.label}</div>}
                </>
              ) : (
                <div style={{ fontSize: 16, color: 'var(--br2)' }}>+</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // Mobile list — each day as a full-width row
  const renderWeekList = (week) => (
    <div key={week}>
      {DAYS.map((day, di) => {
        const key = cellKey(week, di)
        const cell = days[key]
        const dt = cell ? getDayType(cell.day_type) : DAY_TYPES[0]
        const workout = cellWorkout(cell)
        const isActive = activeCell === key
        return (
          <div key={di}>
            <div onClick={() => setActiveCell(isActive ? null : key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--br)', cursor: 'pointer',
              }}>
              <div style={{ width: 36, fontSize: 11, fontWeight: 600, color: 'var(--mu)', flexShrink: 0 }}>{day}</div>
              <div style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                background: cell ? dt.bg : 'var(--br)', borderRadius: 10,
                padding: '10px 12px',
                border: `1px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 18 }}>{cell ? dt.icon : '+'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {cell ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: dt.color }}>{dt.label}</div>
                      {workout && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                          <span title={workout.name} style={{ fontSize: 12, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cellLabel(workout.name, name, week)}</span>
                          {workout.generated && <GenTag />}
                        </div>
                      )}
                      {cell.notes && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{cell.notes}</div>}
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--mu)' }}>Tap to set</span>
                  )}
                </div>
                {workout && (
                  <span onClick={e => { e.stopPropagation(); openPreview(workout, e.currentTarget, false) }} title={`View ${workout.name}`}
                    style={{ fontSize: 15, lineHeight: 1, cursor: 'pointer', opacity: 0.75, flexShrink: 0 }}>
                    👁
                  </span>
                )}
                {cell && <div style={{ fontSize: 18, color: 'var(--mu)' }}>›</div>}
              </div>
            </div>
            {/* Inline cell editor on mobile */}
            {isActive && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10, padding: 14, margin: '8px 0 4px' }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>Day type</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {DAY_TYPES.map(t => (
                    <button key={t.key} onClick={() => setCell(key, { day_type: t.key })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                        background: (cell?.day_type ?? 'training') === t.key ? t.bg : 'var(--br)',
                        color: (cell?.day_type ?? 'training') === t.key ? t.color : 'var(--mu)',
                        outline: (cell?.day_type ?? 'training') === t.key ? `1px solid ${t.color}` : 'none' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                {(cell?.day_type ?? 'training') === 'training' && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Workout</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <select value={pickerValue(cell)} onChange={e => setCell(key, pickerUpdates(e.target.value))}
                        style={{ flex: 1, minWidth: 0, background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '9px 10px', fontSize: 13, outline: 'none' }}>
                        {renderWorkoutOptions(cell, '— no workout —')}
                      </select>
                      {workout && (
                        <button type="button" onClick={e => openPreview(workout, e.currentTarget, true)}
                          style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', padding: '0 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                          👁 View
                        </button>
                      )}
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveCell(null)} style={{ flex: 1, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                  {cell && <button onClick={() => { clearCell(key); setActiveCell(null) }} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#E2695A', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const lastTool = history[history.length - 1]
  const previewDraft = previewPanel?.draftRef && draftWorkouts[previewPanel.draftRef]

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ padding: isMobile ? '12px 16px' : '14px 20px', paddingTop: isMobile ? 'max(12px, calc(var(--sat) + 6px))' : '14px', borderBottom: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={leave} aria-label="Back to programs" style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true) }} placeholder="Program name..."
            style={{ flex: 1, minWidth: 0, background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 12px', fontSize: 15, fontWeight: 600, outline: 'none' }} />
          <button onClick={openFillWeek} title="Randomly fill one week of this draft" aria-label="Fill a week"
            style={{ background: 'var(--br)', color: 'var(--tx)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            🔀{!isMobile && ' Fill a week'}
          </button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, flexShrink: 0 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Left: settings */}
          <div style={{ width: isMobile ? '100%' : 220, minWidth: isMobile ? 'auto' : 220, borderRight: isMobile ? 'none' : '1px solid var(--br)', borderBottom: isMobile ? '1px solid var(--br)' : 'none', padding: isMobile ? '12px 16px' : 14, background: 'var(--s1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 12 : 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ flex: isMobile ? '1 1 auto' : 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Description</div>
                <input value={description} onChange={e => { setDescription(e.target.value); setDirty(true) }} placeholder="Optional..."
                  style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, color: 'var(--tx)', padding: '7px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Weeks</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => changeWeeks(-1)} aria-label="Fewer weeks" style={{ width: 28, height: 28, background: 'var(--br)', border: 'none', borderRadius: 6, color: 'var(--tx)', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{weeks}</span>
                  <button onClick={() => changeWeeks(1)} aria-label="More weeks" style={{ width: 28, height: 28, background: 'var(--br)', border: 'none', borderRadius: 6, color: 'var(--tx)', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: grid + cell editor */}
          <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '12px 16px' : 20, overflowY: 'auto' }}>
            {error && (
              <div ref={errorRef} role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(226,105,90,.1)', border: '1px solid rgba(226,105,90,.35)', color: '#E2695A', fontSize: 12.5, lineHeight: 1.45 }}>
                {error}
              </div>
            )}

            {lastTool && (
              <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(199,228,92,.08)', border: '1px solid rgba(199,228,92,.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🔀</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>Generated draft, not saved yet</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>
                    {pendingWorkouts > 0
                      ? `${pendingWorkouts} program workout${pendingWorkouts === 1 ? ' is' : 's are'} created when you save`
                      : 'Nothing changes until you save'}
                  </div>
                </div>
                <button onClick={undo} title={`Undo ${lastTool.label}`}
                  style={{ minHeight: isMobile ? 44 : 34, padding: '0 12px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  ↶ Undo
                </button>
              </div>
            )}

            {/* Mobile week nav */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={() => setViewWeek(w => Math.max(1, w - 1))} disabled={viewWeek === 1} style={{ background: 'var(--br)', border: 'none', borderRadius: 7, color: 'var(--tx)', padding: '6px 12px', fontSize: 13, cursor: 'pointer', opacity: viewWeek === 1 ? 0.4 : 1 }}>← Prev</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Week {viewWeek} of {weeks}</span>
                <button onClick={() => setViewWeek(w => Math.min(weeks, w + 1))} disabled={viewWeek === weeks} style={{ background: 'var(--br)', border: 'none', borderRadius: 7, color: 'var(--tx)', padding: '6px 12px', fontSize: 13, cursor: 'pointer', opacity: viewWeek === weeks ? 0.4 : 1 }}>Next →</button>
              </div>
            )}
            {isMobile && weeks > 1 && weekHasDays(days, viewWeek) && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <button type="button" onClick={() => openCopyWeeks(viewWeek)}
                  style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, background: 'transparent', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  ⧉ Copy this week to…
                </button>
              </div>
            )}

            {/* Grids (desktop) / List (mobile) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isMobile ? renderWeekList(viewWeek) : weekData.map(w => renderWeekGrid(w))}
            </div>

            {/* Cell editor panel — desktop only */}
            {!isMobile && activeCell && (
              <div style={{ marginTop: 16, background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14 }}>
                {(() => {
                  const { week, dayIdx } = parseCellKey(activeCell)
                  const cell = days[activeCell] || EMPTY_CELL
                  const workout = cellWorkout(cell)
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 12 }}>
                        Week {week} · {DAYS[dayIdx]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Day type</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {DAY_TYPES.map(t => (
                          <button key={t.key} onClick={() => setCell(activeCell, { day_type: t.key })}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                              background: cell.day_type === t.key ? t.bg : 'var(--br)',
                              color: cell.day_type === t.key ? t.color : 'var(--mu)',
                              outline: cell.day_type === t.key ? `1px solid ${t.color}` : 'none' }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                      {cell.day_type === 'training' && (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Workout</div>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <select value={pickerValue(cell)} onChange={e => setCell(activeCell, pickerUpdates(e.target.value))}
                              style={{ flex: 1, minWidth: 0, background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                              {renderWorkoutOptions(cell, '— no workout assigned —')}
                            </select>
                            {workout && (
                              <button type="button" onClick={e => openPreview(workout, e.currentTarget, true)}
                                style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', padding: '0 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                                👁 View
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Notes</div>
                      <input value={cell.notes || ''} onChange={e => setCell(activeCell, { notes: e.target.value })}
                        placeholder="Optional note for this day..."
                        style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setActiveCell(null)} style={{ flex: 1, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                        {days[activeCell] && <button onClick={() => { clearCell(activeCell); setActiveCell(null) }} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#E2695A', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

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
        <GenerateProgramModal
          programName={name}
          week={isMobile ? viewWeek : 1}
          weeks={weeks}
          days={days}
          pool={pool}
          poolError={poolError}
          onClose={() => setFillOpen(false)}
          onApply={handleFillWeek}
        />
      )}

      {copySource && (
        <CopyWeeksModal
          programName={name}
          weeks={weeks}
          initialSource={copySource}
          days={days}
          draftWorkouts={draftWorkouts}
          onClose={() => setCopySource(null)}
          onApply={handleCopyWeeks}
        />
      )}
    </Layout>
  )
}
