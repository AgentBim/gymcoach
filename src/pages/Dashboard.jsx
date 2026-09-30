import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import Layout from '../components/Layout'
import AssignModal from '../components/AssignModal'
import WorkoutPreviewPanel from '../components/WorkoutPreviewPanel'
import { SelectionBar, ConfirmDeleteSheet, Toast } from '../components/BulkDelete'
import { describeSelection, fetchWorkoutImpact, workoutDeletePlan } from '../lib/bulkDelete'
import { MUSCLE_COLORS as GROUP_COLORS, avatarColor as avatarPalette, initials } from '../lib/theme'

const ACCENT_COLORS = ['var(--ac)', '#6BA9DE', '#A184E3', '#4FB88A', '#E7A23E', '#E2695A']

function getMuscleGroups(workout) {
  const groups = new Set(workout.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
  return [...groups]
}

function getDayGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const GROUP_OPTIONS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']

export default function Dashboard() {
  const { user, coach } = useAuth()
  const [workouts, setWorkouts]           = useState([])
  const [athletes, setAthletes]           = useState([])
  const [completionCount, setCompletionCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [copied, setCopied]               = useState(null)
  const [assigningWorkout, setAssigningWorkout] = useState(null)
  const [sheetWorkout, setSheetWorkout]   = useState(null)
  const [search, setSearch]               = useState('')
  const [filterGroup, setFilterGroup]     = useState('All')
  const [filterOpen, setFilterOpen]       = useState(false)
  const [previewPanel, setPreviewPanel]   = useState(null) // { workoutId, anchorRect }
  const [programWorkouts, setProgramWorkouts] = useState([])
  const [programWorkoutsOpen, setProgramWorkoutsOpen] = useState(false)
  // Bulk delete: select mode on the workout list, plus checkboxes on the
  // "Kept for athlete history" list. deleteReq opens the confirmation sheet.
  const [selecting, setSelecting]         = useState(false)
  const [selected, setSelected]           = useState(() => new Set())
  const [lastIdx, setLastIdx]             = useState(null)
  const [keptSelected, setKeptSelected]   = useState(() => new Set())
  const [deleteReq, setDeleteReq]         = useState(null) // { workouts: [{ id, name }], historyOnly }
  const [impact, setImpact]               = useState(null)
  const [deleteError, setDeleteError]     = useState('')
  const [keepHistory, setKeepHistory]     = useState(true)
  const [deleting, setDeleting]           = useState(false)
  const [toast, setToast]                 = useState('')
  const deleteReqId = useRef(0)
  const shiftClick = useRef(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => { fetchAll() }, [user])

  async function fetchAll() {
    if (!user) return
    // Program-generated workouts are managed inside their program, so the
    // list only shows hand-built ones; the generated ones are summarized in
    // the collapsed "Program workouts" section instead.
    const [wRes, aRes, fbRes, pwRes] = await Promise.all([
      supabase.from('workouts')
        .select('*, workout_exercises(exercise_id, exercises(muscle_group)), workout_assignments(id, athlete_id, assignment_token, athletes(full_name)), workout_feedback(id)')
        .eq('coach_id', user.id)
        .eq('program_generated', false)
        .order('created_at', { ascending: false }),
      supabase.from('athletes').select('id, full_name').eq('coach_id', user.id),
      supabase.from('workout_feedback')
        .select('id, workouts!inner(coach_id)')
        .eq('workouts.coach_id', user.id),
      supabase.from('workouts')
        .select('id, name, source_program_id, programs!workouts_source_program_id_fkey(id, name, duration_weeks)')
        .eq('coach_id', user.id)
        .eq('program_generated', true)
        .order('name'),
    ])
    setWorkouts(wRes.data || [])
    setAthletes(aRes.data || [])
    setCompletionCount((fbRes.data || []).length)
    setProgramWorkouts(pwRes.data || [])
    setLoading(false)
  }

  // Every delete, one workout or many, goes through the confirmation sheet
  // and the delete_workouts RPC, which keeps workouts with athlete history
  // unless the coach turns that off (their feedback cascades on delete).
  async function openDelete(list, { historyOnly = false } = {}) {
    if (!list.length) return
    const reqId = ++deleteReqId.current
    setDeleteReq({ workouts: list.map(w => ({ id: w.id, name: w.name })), historyOnly })
    setImpact(null)
    setDeleteError('')
    setKeepHistory(true)
    try {
      const result = await fetchWorkoutImpact(list.map(w => w.id))
      if (reqId === deleteReqId.current) setImpact(result)
    } catch (err) {
      if (reqId === deleteReqId.current) setDeleteError(err.message || 'Could not check what this delete changes')
    }
  }

  function closeDelete() {
    deleteReqId.current += 1
    setDeleteReq(null)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    const { data, error } = await supabase.rpc('delete_workouts', {
      p_workout_ids: deleteReq.workouts.map(w => w.id),
      p_keep_history: deleteReq.historyOnly ? false : keepHistory,
    })
    setDeleting(false)
    if (error) { setDeleteError(error.message || 'Could not delete'); return }
    const deleted = data?.deleted || 0
    const kept = data?.kept?.length || 0
    setToast(`${deleted} workout${deleted === 1 ? '' : 's'} deleted${kept ? ` · ${kept} kept for athlete history` : ''}`)
    setDeleteReq(null)
    stopSelecting()
    setKeptSelected(new Set())
    fetchAll()
  }

  function startSelecting() {
    setSelecting(true)
    setSelected(new Set())
    setLastIdx(null)
    setFilterOpen(false)
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
    setLastIdx(null)
  }

  // Click toggles; shift-click selects the range from the last clicked card.
  function toggleSelected(idx, id, shiftKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastIdx !== null) {
        const [from, to] = [Math.min(lastIdx, idx), Math.max(lastIdx, idx)]
        filteredWorkouts.slice(from, to + 1).forEach(w => next.add(w.id))
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastIdx(idx)
  }

  function toggleKept(id) {
    setKeptSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function duplicateWorkout(w) {
    const { error } = await supabase.rpc('duplicate_workout', { p_workout_id: w.id })
    if (error) { console.error(error); return }
    fetchAll()
  }

  // Each athlete assigned to a workout has their own assignment-scoped link
  // (workout_assignments.assignment_token) — there's no single shared link
  // per workout. With exactly one assignee we can copy directly; otherwise
  // fall back to the assign sheet, which lists each athlete's own link.
  function copyWorkoutLink(w) {
    const assigned = w.workout_assignments || []
    if (assigned.length !== 1) { setAssigningWorkout(w); return }
    const [assignment] = assigned
    navigator.clipboard.writeText(`${window.location.origin}/share/${assignment.assignment_token}`)
    setCopied(assignment.id)
    setTimeout(() => setCopied(null), 2000)
  }

  function openPreview(workoutId, anchorEl) {
    setPreviewPanel({ workoutId, anchorRect: anchorEl.getBoundingClientRect() })
  }

  const filteredWorkouts = workouts.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterGroup !== 'All') {
      const groups = new Set(w.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
      if (!groups.has(filterGroup)) return false
    }
    return true
  })

  // Generated workouts grouped by their program. Ones whose program was
  // deleted (kept because athletes have history on them) have no source.
  const programGroups = []
  const keptForHistory = []
  programWorkouts.forEach(w => {
    if (!w.source_program_id) { keptForHistory.push(w); return }
    let group = programGroups.find(g => g.id === w.source_program_id)
    if (!group) {
      group = { id: w.source_program_id, name: w.programs?.name || 'Program', weeks: w.programs?.duration_weeks, count: 0 }
      programGroups.push(group)
    }
    group.count += 1
  })
  programGroups.sort((a, b) => a.name.localeCompare(b.name))

  // Only workouts the current search/filter shows count as selected, so a
  // filter can't hide part of what's about to be deleted.
  const selectedWorkouts = filteredWorkouts.filter(w => selected.has(w.id))
  const allVisibleSelected = filteredWorkouts.length > 0 && selectedWorkouts.length === filteredWorkouts.length
  const selectedWithHistory = selectedWorkouts.filter(w => w.workout_feedback?.length).length
  const keptChosen = keptForHistory.filter(w => keptSelected.has(w.id))
  const deletePlan = deleteReq && impact
    ? workoutDeletePlan(deleteReq.workouts, impact, { keepHistory, historyOnly: deleteReq.historyOnly })
    : null

  const coachFirst = coach?.full_name?.split(' ')[0] || 'Coach'
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // ── PROGRAM WORKOUTS (collapsed) ──────────────────────────────
  // Called as a plain function, not <Component />, so toggling it doesn't
  // remount the button and drop keyboard focus.
  function renderProgramWorkouts() {
    const total = programWorkouts.length
    const sources = programGroups.length
    const summary = [
      sources > 0 && `${total - keptForHistory.length} from ${sources} program${sources !== 1 ? 's' : ''}`,
      keptForHistory.length > 0 && `${keptForHistory.length} kept for history`,
    ].filter(Boolean).join(' · ')
    return (
      <div style={{ margin: isMobile ? '6px 16px 20px' : '20px 0 0', borderRadius: 14, border: '1.5px dashed var(--br)' }}>
        <button onClick={() => setProgramWorkoutsOpen(o => !o)} aria-expanded={programWorkoutsOpen}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, minHeight: 60, background: 'none', border: 'none', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--s1)', fontSize: 18 }}>📅</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Program workouts</span>
            <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>{summary} · kept out of your list</span>
          </span>
          <span style={{ fontSize: 20, color: 'var(--mu)', transform: `rotate(${programWorkoutsOpen ? 90 : 0}deg)`, transition: 'transform .15s', lineHeight: 1 }}>›</span>
        </button>
        {programWorkoutsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
            {programGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--s1)', border: '1px solid var(--br)' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mu)' }}>
                    {g.count} WORKOUT{g.count !== 1 ? 'S' : ''}{g.weeks ? ` · ${g.weeks} WEEK${g.weeks !== 1 ? 'S' : ''}` : ''}
                  </span>
                </span>
                <button onClick={() => navigate(`/programs/${g.id}`)}
                  style={{ minHeight: isMobile ? 44 : 36, padding: '0 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--br)', color: 'var(--ac)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  Open
                </button>
              </div>
            ))}
            {keptForHistory.length > 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--s1)', border: '1px solid var(--br)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Kept for athlete history</span>
                  <button onClick={() => setKeptSelected(keptChosen.length === keptForHistory.length ? new Set() : new Set(keptForHistory.map(w => w.id)))}
                    style={{ minHeight: isMobile ? 44 : 30, padding: '0 8px', background: 'none', border: 'none', color: 'var(--ac)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {keptChosen.length === keptForHistory.length ? 'Deselect all' : 'Select all'}
                  </button>
                  {keptChosen.length > 0 && (
                    <button onClick={() => openDelete(keptChosen, { historyOnly: true })}
                      style={{ minHeight: isMobile ? 44 : 30, padding: '0 12px', borderRadius: 8, background: '#E2695A', border: 'none', color: '#1A0E0C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🗑 Delete {keptChosen.length}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>Their program was deleted, but athletes have completed or been assigned them.</div>
                {keptForHistory.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: isMobile ? 44 : 32, borderTop: '1px solid var(--br)' }}>
                    <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: isMobile ? 44 : 32, cursor: 'pointer' }}>
                      <input type="checkbox" checked={keptSelected.has(w.id)} onChange={() => toggleKept(w.id)} style={{ width: 18, height: 18, flexShrink: 0, accentColor: 'var(--ac)' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                    </label>
                    <button onClick={e => openPreview(w.id, e.currentTarget)} title="Preview workout" aria-label={`Preview ${w.name}`}
                      style={{ width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--mu2)', fontSize: 13, cursor: 'pointer' }}>
                      👁
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p style={{ margin: '2px 2px 0', fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.5 }}>These are managed inside their program and deleted with it, except ones athletes have history on. To reuse one elsewhere, preview it and choose Save to library, which makes a regular copy.</p>
          </div>
        )}
      </div>
    )
  }

  // ── WORKOUT CARD ──────────────────────────────────────────────
  function WorkoutCard({ w, idx }) {
    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length]
    const groups = getMuscleGroups(w)
    const assigned = w.workout_assignments || []
    const exCount = w.workout_exercises?.length || 0

    return (
      <div style={{
        background: 'var(--s2)',
        border: `1px solid ${w.is_ai_generated ? 'rgba(167,139,250,.22)' : 'var(--br)'}`,
        borderRadius: 14,
        padding: isMobile ? '14px 14px 12px' : '16px 16px 14px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Left accent bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '3px 0 0 3px' }} />

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
              {w.is_ai_generated && <span style={{ fontSize: 10, background: 'rgba(167,139,250,.12)', color: '#A184E3', border: '1px solid rgba(167,139,250,.25)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, flexShrink: 0 }}>✦ AI</span>}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
              {groups.slice(0, 3).map(g => {
                const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu2)' }
                return <span key={g} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
              })}
            </div>
          </div>
          {isMobile && (
            <button onClick={() => setSheetWorkout(w)}
              style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--mu)', fontSize: 16, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
              ···
            </button>
          )}
        </div>

        {/* Assigned athletes mini avatars */}
        {assigned.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingLeft: 2 }}>
            <div style={{ display: 'flex' }}>
              {assigned.slice(0, 5).map((a, i) => {
                const av = avatarPalette(a.athletes?.full_name || '')
                return (
                  <div key={a.id} style={{ width: 22, height: 22, borderRadius: 7, background: av.bg, border: '1.5px solid var(--bg)', marginLeft: i === 0 ? 0 : -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: av.color, zIndex: 5 - i }}>
                    {initials(a.athletes?.full_name || '')}
                  </div>
                )
              })}
              {assigned.length > 5 && (
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--br2)', border: '1.5px solid var(--bg)', marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--mu2)', fontWeight: 600 }}>
                  +{assigned.length - 5}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{assigned.length} assigned</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, paddingLeft: 2 }}>
          {isMobile ? (
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={() => copyWorkoutLink(w)}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 9, color: copied === w.workout_assignments?.[0]?.id && w.workout_assignments?.length === 1 ? 'var(--ac)' : 'var(--mu2)', fontSize: 12, padding: '10px 8px', cursor: 'pointer', minHeight: 40, fontWeight: 500 }}>
                {copied === w.workout_assignments?.[0]?.id && w.workout_assignments?.length === 1 ? '✓ Copied!' : '🔗 Share'}
              </button>
              <button onClick={() => setAssigningWorkout(w)}
                style={{ flex: 1, background: 'rgba(199,228,92,.07)', border: '1px solid rgba(199,228,92,.2)', borderRadius: 9, color: 'var(--ac)', fontSize: 12, padding: '10px 8px', cursor: 'pointer', fontWeight: 600, minHeight: 40 }}>
                Assign
              </button>
              <button onClick={e => openPreview(w.id, e.currentTarget)} title="Preview workout"
                style={{ flexShrink: 0, width: 40, background: 'transparent', border: '1px solid var(--br)', borderRadius: 9, color: 'var(--mu2)', fontSize: 14, cursor: 'pointer', minHeight: 40 }}>
                👁
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => copyWorkoutLink(w)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: copied === w.workout_assignments?.[0]?.id && w.workout_assignments?.length === 1 ? 'var(--ac)' : 'var(--mu2)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', minHeight: 36 }}>
                  {copied === w.workout_assignments?.[0]?.id && w.workout_assignments?.length === 1 ? '✓ Copied!' : '🔗 Share'}
                </button>
                <button onClick={() => setAssigningWorkout(w)}
                  style={{ flex: 1, background: 'rgba(199,228,92,.07)', border: '1px solid rgba(199,228,92,.2)', borderRadius: 8, color: 'var(--ac)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', fontWeight: 500, minHeight: 36 }}>
                  Assign
                </button>
                <button onClick={e => openPreview(w.id, e.currentTarget)} title="Preview workout"
                  style={{ flexShrink: 0, width: 36, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu2)', fontSize: 13, cursor: 'pointer', minHeight: 36 }}>
                  👁
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => navigate(`/workout/${w.id}/edit`)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 32 }}>✏️ Edit</button>
                <button onClick={() => duplicateWorkout(w)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 32 }}>⧉ Copy</button>
                <button onClick={() => openDelete([w])} aria-label={`Delete ${w.name}`}
                  style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#E2695A', fontSize: 12, padding: '7px 12px', cursor: 'pointer', minHeight: 32 }}>🗑</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── SELECTABLE CARD (select mode) ─────────────────────────────
  // A plain render function, so toggling doesn't remount the checkbox. The
  // checkbox's own change event does the toggling (clicks on the card reach
  // it through the label, Space when it's focused); its click only records
  // Shift for range selection. Don't preventDefault the click: the browser
  // would revert the checkbox after React re-rendered it.
  function renderSelectableCard(w, idx) {
    const on = selected.has(w.id)
    const groups = getMuscleGroups(w)
    const exCount = w.workout_exercises?.length || 0
    const done = w.workout_feedback?.length || 0
    return (
      <label key={w.id}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: isMobile ? 14 : 16, borderRadius: 14, cursor: 'pointer', userSelect: 'none',
          background: on ? 'rgba(199,228,92,.08)' : 'var(--s2)', border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}` }}>
        <input type="checkbox" checked={on} aria-label={`Select ${w.name}`}
          onClick={e => { shiftClick.current = e.shiftKey }}
          onChange={() => toggleSelected(idx, w.id, shiftClick.current)}
          style={{ width: 20, height: 20, margin: '1px 0 0', flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
            {w.is_ai_generated && <span style={{ fontSize: 10, background: 'rgba(167,139,250,.12)', color: '#A184E3', border: '1px solid rgba(167,139,250,.25)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, flexShrink: 0 }}>✦ AI</span>}
          </span>
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
            {groups.slice(0, 3).map(g => {
              const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu2)' }
              return <span key={g} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
            })}
          </span>
          {done > 0 && <span style={{ fontSize: 11.5, color: '#E7A23E' }}>⏱ {done} completion{done === 1 ? '' : 's'} by athletes</span>}
        </span>
      </label>
    )
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading…</div></Layout>

  return (
    <Layout>
      {/* ── MOBILE STICKY HEADER ── */}
      {isMobile && (
        <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10, paddingTop: 'var(--sat)' }}>
          {selecting ? (
            <div style={{ padding: '8px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={stopSelecting} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: 'var(--mu)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{selectedWorkouts.length ? `${selectedWorkouts.length} selected` : 'Select workouts'}</span>
              <button onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(filteredWorkouts.map(w => w.id)))}
                style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: 'var(--ac)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          ) : (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChalkUpLogo size={22} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ac)', fontFamily: 'var(--font-head)', flex: 1 }}>chalkup</span>
            {workouts.length > 0 && (
              <button onClick={startSelecting} style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', padding: '7px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Select</button>
            )}
            <button onClick={() => setFilterOpen(o => !o)} style={{ background: filterOpen || search || filterGroup !== 'All' ? 'rgba(199,228,92,.12)' : 'var(--br)', border: 'none', borderRadius: 8, color: filterOpen || search || filterGroup !== 'All' ? 'var(--ac)' : 'var(--mu)', padding: '7px 10px', fontSize: 13, cursor: 'pointer' }}>
              {filterOpen ? '✕' : '🔍'}
            </button>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
          </div>
          )}
          {filterOpen && !selecting && (
            <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts…" autoFocus
                style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 11px', fontSize: 13, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {GROUP_OPTIONS.map(g => (
                  <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--s2)', color: filterGroup === g ? 'var(--ac-ink)' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{g}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '0' : '20px 24px' }}>

        {/* ── MOBILE GREETING + STATS ── */}
        {isMobile && (
          <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(160deg,rgba(200,255,80,.04) 0%,transparent 60%)' }}>
            <div style={{ fontSize: 11, color: 'var(--mu2)', marginBottom: 3 }}>{getDayGreeting()} · {day}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)', marginBottom: 14 }}>
              Hey, <span style={{ color: 'var(--ac)' }}>{coachFirst}</span> 👋
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: workouts.length, lbl: 'Workouts', col: 'var(--ac)' },
                { val: athletes.length, lbl: 'Athletes',  col: '#6BA9DE' },
                { val: completionCount, lbl: 'Completions', col: '#E7A23E' },
              ].map(({ val, lbl, col }) => (
                <div key={lbl} style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 4, fontFamily: 'var(--font-head,sans-serif)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 4 }}>{getDayGreeting()}, {day}</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-head,sans-serif)' }}>
                Hey, <span style={{ color: 'var(--ac)' }}>{coachFirst}</span> 👋
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {[
                { val: workouts.length, lbl: 'Workouts', col: 'var(--ac)' },
                { val: athletes.length, lbl: 'Athletes',  col: '#6BA9DE' },
                { val: completionCount, lbl: 'Completions', col: '#E7A23E' },
              ].map(({ val, lbl, col }) => (
                <div key={lbl} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 3, fontFamily: 'var(--font-head,sans-serif)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{lbl}</div>
                </div>
              ))}
              {selecting && (
                <button onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(filteredWorkouts.map(w => w.id)))}
                  style={{ background: 'none', border: 'none', color: 'var(--ac)', padding: '10px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {allVisibleSelected ? 'Deselect all' : `Select all ${filteredWorkouts.length}`}
                </button>
              )}
              {workouts.length > 0 && (
                <button onClick={selecting ? stopSelecting : startSelecting} aria-pressed={selecting}
                  style={{ background: selecting ? 'rgba(199,228,92,.12)' : 'var(--s2)', border: `1px solid ${selecting ? 'rgba(199,228,92,.45)' : 'var(--br)'}`, color: selecting ? 'var(--ac)' : 'var(--tx)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {selecting ? 'Done' : 'Select'}
                </button>
              )}
              <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New workout</button>
            </div>
          </div>
        )}

        {/* ── DESKTOP FILTERS ── */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts…"
              style={{ background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '7px 11px', fontSize: 13, outline: 'none', width: 200 }} />
            {GROUP_OPTIONS.map(g => (
              <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? 'var(--ac-ink)' : 'var(--mu)', border: 'none', cursor: 'pointer' }}>{g}</button>
            ))}
          </div>
        )}

        {/* ── WORKOUT LIST ── */}
        {workouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No workouts yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Create your first workout to get started</p>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create workout</button>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '4px 16px 16px' : 0 }}>
            {isMobile && (
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                My workouts <span style={{ color: 'var(--mu2)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{filteredWorkouts.length} saved</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))', gap: isMobile ? 10 : 14 }}>
              {filteredWorkouts.map((w, i) => (selecting ? renderSelectableCard(w, i) : <WorkoutCard key={w.id} w={w} idx={i} />))}
              {!isMobile && !selecting && (
                <div onClick={() => navigate('/workout/new')} style={{ border: '1.5px dashed var(--br)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, cursor: 'pointer', color: 'var(--mu)', transition: 'border-color .15s' }}>
                  <div style={{ width: 36, height: 36, background: 'var(--br)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
                  <span style={{ fontSize: 13 }}>New workout</span>
                </div>
              )}
            </div>
          </div>
        )}

        {programWorkouts.length > 0 && renderProgramWorkouts()}
      </div>

      {assigningWorkout && <AssignModal workout={assigningWorkout} onClose={() => setAssigningWorkout(null)} />}

      {selecting && (
        <SelectionBar
          count={selectedWorkouts.length}
          deleteLabel={selectedWorkouts.length ? `Delete ${selectedWorkouts.length}` : 'Delete'}
          hint={selectedWorkouts.length === 0
            ? (isMobile ? 'Tap workouts to select them' : 'Click cards to select · Shift-click selects a range')
            : selectedWithHistory
              ? `${selectedWithHistory} ${selectedWithHistory === 1 ? 'has' : 'have'} athlete history`
              : `${selectedWorkouts.length} selected`}
          hintTone={selectedWithHistory ? 'warn' : 'muted'}
          onDelete={() => openDelete(selectedWorkouts)}
        />
      )}

      {deleteReq && (
        <ConfirmDeleteSheet
          title={deleteReq.historyOnly
            ? `Delete ${deleteReq.workouts.length} kept workout${deleteReq.workouts.length === 1 ? '' : 's'}?`
            : `Delete ${deleteReq.workouts.length === 1 ? deleteReq.workouts[0].name : `${deleteReq.workouts.length} workouts`}?`}
          subtitle={deleteReq.historyOnly
            ? `${describeSelection(deleteReq.workouts.map(w => w.name))}. Their programs are already gone, and deleting can’t be undone.`
            : deleteReq.workouts.length > 1
              ? `${describeSelection(deleteReq.workouts.map(w => w.name))}. Deleting can’t be undone.`
              : 'Deleting can’t be undone. Here’s what else it changes.'}
          loading={!impact && !deleteError}
          rows={deletePlan?.rows}
          keepToggle={{
            label: 'Keep workouts with athlete history',
            hint: 'They stay in your list. Turn this off to delete them and their history too.',
            checked: keepHistory,
            onChange: setKeepHistory,
          }}
          confirmLabel={deletePlan?.confirmLabel || 'Delete'}
          confirmDisabled={!deletePlan || deletePlan.toDelete.length === 0}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {previewPanel && (
        <WorkoutPreviewPanel
          workoutId={previewPanel.workoutId}
          anchorRect={previewPanel.anchorRect}
          onClose={() => setPreviewPanel(null)}
          onEdit={() => navigate(`/workout/${previewPanel.workoutId}/edit`)}
          onSavedToLibrary={fetchAll}
        />
      )}

      {/* ── MOBILE ··· BOTTOM SHEET ── */}
      {sheetWorkout && (
        <div onClick={() => setSheetWorkout(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--s1)', borderRadius: '20px 20px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', overflow: 'hidden' }}>
            <div style={{ width: 32, height: 3, background: 'var(--br2)', borderRadius: 2, margin: '12px auto 16px' }} />
            <div style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--br)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{sheetWorkout.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>{sheetWorkout.workout_exercises?.length || 0} exercises</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 16px 4px' }}>
              {[
                { icon: '✏️', label: 'Edit',       action: () => { setSheetWorkout(null); navigate(`/workout/${sheetWorkout.id}/edit`) } },
                { icon: '⧉',  label: 'Duplicate',  action: () => { duplicateWorkout(sheetWorkout); setSheetWorkout(null) } },
                { icon: '🔗', label: 'Copy link',  action: () => { copyWorkoutLink(sheetWorkout); setSheetWorkout(null) } },
                { icon: '🗑', label: 'Delete', danger: true, action: () => { openDelete([sheetWorkout]); setSheetWorkout(null) } },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ background: item.danger ? 'rgba(248,128,128,.07)' : 'var(--s2)', border: `1px solid ${item.danger ? 'rgba(248,128,128,.2)' : 'var(--br)'}`, borderRadius: 14, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 80 }}>
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: item.danger ? '#E2695A' : 'var(--tx)', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '10px 16px 0' }}>
              <button onClick={() => setSheetWorkout(null)}
                style={{ width: '100%', padding: '14px', background: 'var(--br)', border: 'none', borderRadius: 12, color: 'var(--mu)', fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
