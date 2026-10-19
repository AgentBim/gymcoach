import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import AssignModal from '../components/AssignModal'
import WorkoutPreviewPanel from '../components/WorkoutPreviewPanel'
import { SelectionBar, ConfirmDeleteSheet, Toast } from '../components/BulkDelete'
import { describeSelection, fetchWorkoutImpact, workoutDeletePlan } from '../lib/bulkDelete'
import { todayLocal } from '../lib/streaks'
import { ago, dayLabel } from '../lib/dates'
import { MUSCLE_COLORS } from '../lib/theme'
import { AvatarStack, Button, Card, Chip, Dialog, EmptyState, Icon, Label, MoreMenu, Page, PageHeader, Pill, PillRow, SearchBox } from '../components/ui'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const TONE = { warn: '#E7A23E', info: '#6BA9DE', muted: 'var(--mu2)', ok: '#4FB88A' }
const COLS = 'minmax(220px, 2.2fr) minmax(130px, 1.3fr) 100px minmax(150px, 1.4fr) 90px 44px'

function groupsOf(w) {
  return [...new Set((w.workout_exercises || []).map(we => we.exercises?.muscle_group).filter(Boolean))]
}

export default function Workouts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [workouts, setWorkouts] = useState([])
  const [programWorkouts, setProgramWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [assign, setAssign] = useState(null) // { workout, mode }
  const [preview, setPreview] = useState(null)
  const [toast, setToast] = useState('')
  // Single-workout delete (mockup dialog): { workout, impact }
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  // Select mode: bulk delete from the earlier build, plus "Kept for athlete history".
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [lastIdx, setLastIdx] = useState(null)
  const [keptOpen, setKeptOpen] = useState(false)
  const [keptSelected, setKeptSelected] = useState(() => new Set())
  const [deleteReq, setDeleteReq] = useState(null)
  const [impact, setImpact] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [keepHistory, setKeepHistory] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const deleteReqId = useRef(0)
  const shiftClick = useRef(false)
  const today = todayLocal()

  useEffect(() => { fetchAll() }, [user])

  async function fetchAll() {
    if (!user) return
    const [wRes, pwRes] = await Promise.all([
      supabase.from('workouts')
        .select('*, workout_exercises(exercise_id, exercises(muscle_group)), workout_assignments(id, athlete_id, assignment_token, revoked_at, athletes(full_name)), workout_feedback(id, submitted_at)')
        .eq('coach_id', user.id)
        .eq('program_generated', false)
        .is('archived_at', null)
        .order('updated_at', { ascending: false }),
      supabase.from('workouts')
        .select('id, name, source_program_id, programs!workouts_source_program_id_fkey(id, name, duration_weeks)')
        .eq('coach_id', user.id)
        .eq('program_generated', true)
        .order('name'),
    ])
    setWorkouts((wRes.data || []).map(w => ({ ...w, workout_assignments: (w.workout_assignments || []).filter(a => !a.revoked_at) })))
    setProgramWorkouts(pwRes.data || [])
    setLoading(false)
  }

  async function duplicate(w) {
    const { error } = await supabase.rpc('duplicate_workout', { p_workout_id: w.id })
    if (error) { setToast(error.message || 'Could not duplicate'); return }
    setToast(`Duplicated ${w.name}`)
    fetchAll()
  }

  // ── single delete: the mockup's "Delete / Archive" dialog ──
  async function askDelete(w) {
    setConfirmError('')
    setConfirm({ workout: w, impact: null })
    try {
      const impact = await fetchWorkoutImpact([w.id])
      setConfirm(c => (c && c.workout.id === w.id ? { workout: w, impact } : c))
    } catch (err) {
      setConfirmError(err.message || 'Could not check what this changes')
    }
  }
  async function archive() {
    setBusy(true)
    const { error } = await supabase.rpc('archive_workouts', { p_workout_ids: [confirm.workout.id] })
    setBusy(false)
    if (error) { setConfirmError(error.message); return }
    setToast(`Archived ${confirm.workout.name}. Athletes keep their history.`)
    setConfirm(null)
    fetchAll()
  }
  async function destroy() {
    setBusy(true)
    const { error } = await supabase.rpc('delete_workouts', { p_workout_ids: [confirm.workout.id], p_keep_history: false })
    setBusy(false)
    if (error) { setConfirmError(error.message); return }
    const done = confirm.impact?.[confirm.workout.id]?.completions
    setToast(`Deleted ${confirm.workout.name}${done ? ' and its history' : ''}.`)
    setConfirm(null)
    fetchAll()
  }

  // ── bulk delete ──
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
  function closeDelete() { deleteReqId.current += 1; setDeleteReq(null) }
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
  function startSelecting() { setSelecting(true); setSelected(new Set()); setLastIdx(null) }
  function stopSelecting() { setSelecting(false); setSelected(new Set()); setLastIdx(null) }
  function toggleSelected(idx, id, shiftKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastIdx !== null) {
        const [from, to] = [Math.min(lastIdx, idx), Math.max(lastIdx, idx)]
        shown.slice(from, to + 1).forEach(w => next.add(w.id))
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastIdx(idx)
  }

  const q = query.trim().toLowerCase()
  const shown = workouts.filter(w => (filter === 'All' || groupsOf(w).includes(filter)) && (!q || w.name.toLowerCase().includes(q)))
  const selectedWorkouts = shown.filter(w => selected.has(w.id))
  const selectedWithHistory = selectedWorkouts.filter(w => w.workout_feedback?.length).length
  const deletePlan = deleteReq && impact ? workoutDeletePlan(deleteReq.workouts, impact, { keepHistory, historyOnly: deleteReq.historyOnly }) : null

  const programGroups = new Set(programWorkouts.filter(w => w.source_program_id).map(w => w.source_program_id))
  const keptForHistory = programWorkouts.filter(w => !w.source_program_id)
  const inPrograms = programWorkouts.length - keptForHistory.length
  const keptChosen = keptForHistory.filter(w => keptSelected.has(w.id))

  const lastDone = w => {
    const dates = (w.workout_feedback || []).map(f => f.submitted_at).filter(Boolean).sort()
    return dates.length ? dayLabel(dates[dates.length - 1], today) : 'Never'
  }

  const menuItems = w => [
    { label: 'Edit', icon: 'edit', onClick: () => navigate(`/plan/workouts/${w.id}/edit`) },
    { label: 'Duplicate', icon: 'copy', onClick: () => duplicate(w) },
    { label: 'Copy athlete link', icon: 'link', onClick: () => setAssign({ workout: w, mode: 'links' }) },
    { label: 'Delete', icon: 'trash', danger: true, onClick: () => askDelete(w) },
  ]

  const assignedCell = w => {
    const names = (w.workout_assignments || []).map(a => a.athletes?.full_name || '').filter(Boolean)
    return names.length ? (
      <button type="button" onClick={() => setAssign({ workout: w, mode: 'assign' })} aria-label={`Edit who ${w.name} is assigned to`}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, background: 'none', border: 'none', color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
        <AvatarStack names={names} max={3} />{names.length} athlete{names.length === 1 ? '' : 's'}
      </button>
    ) : (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: 'var(--mu)' }}>Not assigned</span>
        <Button size="sm" onClick={() => setAssign({ workout: w, mode: 'assign' })}>Assign</Button>
      </span>
    )
  }

  const focusChips = w => groupsOf(w).map(g => {
    const c = MUSCLE_COLORS[g] || { bg: 'var(--s2)', color: 'var(--mu2)' }
    return <span key={g} style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.color }}>{g}</span>
  })

  const nameCell = w => (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Link to={`/plan/workouts/${w.id}/edit`} style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</Link>
        {w.is_ai_generated && <Chip tone="violet">AI</Chip>}
      </span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>Edited {ago(w.updated_at || w.created_at)}</span>
    </span>
  )

  return (
    <Layout>
      <PlanTabs />
      <Page>
        <PageHeader eyebrow={`${workouts.length} workout${workouts.length === 1 ? '' : 's'} you built`} title="Workouts">
          <SearchBox value={query} onChange={setQuery} placeholder="Search workouts" label="Search workouts" style={{ width: isMobile ? '100%' : 220 }} />
          {workouts.length > 0 && <Button onClick={selecting ? stopSelecting : startSelecting} aria-pressed={selecting}>{selecting ? 'Done' : 'Select'}</Button>}
          <Button variant="primary" icon="plus" onClick={() => navigate('/plan/workouts/new')}>New workout</Button>
        </PageHeader>

        <PillRow label="Filter by muscle group">
          {GROUPS.map(g => <Pill key={g} on={filter === g} onClick={() => setFilter(g)}>{g}</Pill>)}
        </PillRow>

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div>
        ) : (
          <Card style={{ overflow: 'hidden' }}>
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px', alignItems: 'center' }}>
                <Label>Workout</Label><Label>Focus</Label><Label>Exercises</Label><Label>Assigned to</Label><Label>Last done</Label><span />
              </div>
            )}
            {shown.length === 0 && <EmptyState>{workouts.length === 0 ? 'No workouts yet. Create your first one.' : 'No workouts match.'}</EmptyState>}
            {shown.map((w, idx) => {
              const on = selected.has(w.id)
              const select = selecting && (
                <input type="checkbox" checked={on} aria-label={`Select ${w.name}`}
                  onClick={e => { shiftClick.current = e.shiftKey }}
                  onChange={() => toggleSelected(idx, w.id, shiftClick.current)}
                  style={{ width: 20, height: 20, flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }} />
              )
              const count = `${w.workout_exercises?.length || 0} exercises`
              if (isMobile) {
                return (
                  <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderTop: '1px solid var(--br)', background: on ? 'rgba(199,228,92,.06)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{select}{nameCell(w)}<span style={{ flex: 1 }} />{!selecting && <MoreMenu label={`More actions for ${w.name}`} items={menuItems(w)} />}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--mu2)' }}>{count}</span>{focusChips(w)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{assignedCell(w)}<span style={{ fontSize: 12, color: 'var(--mu)' }}>Last done {lastDone(w)}</span></div>
                  </div>
                )
              }
              return (
                <div key={w.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--br)', background: on ? 'rgba(199,228,92,.06)' : 'transparent' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>{select}{nameCell(w)}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{focusChips(w)}</span>
                  <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{count}</span>
                  {assignedCell(w)}
                  <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{lastDone(w)}</span>
                  {selecting ? <span /> : <MoreMenu label={`More actions for ${w.name}`} items={menuItems(w)} />}
                </div>
              )
            })}
          </Card>
        )}

        {programWorkouts.length > 0 && (
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--s2)', display: 'grid', placeItems: 'center', color: 'var(--mu2)', flexShrink: 0 }}><Icon name="plan" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Program workouts</div>
                <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>
                  {inPrograms} workout{inPrograms === 1 ? '' : 's'} across {programGroups.size} program{programGroups.size === 1 ? '' : 's'}. Managed inside each program.
                  {keptForHistory.length > 0 && ` ${keptForHistory.length} kept for athlete history.`}
                </div>
              </div>
              {keptForHistory.length > 0 && <Button size="sm" onClick={() => setKeptOpen(o => !o)} aria-expanded={keptOpen}>{keptOpen ? 'Hide kept' : 'Show kept'}</Button>}
              <Link to="/plan/programs" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac)', padding: '0 4px' }}>View programs</Link>
            </div>
            {keptOpen && keptForHistory.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--br)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Kept for athlete history</span>
                  <Button size="sm" onClick={() => setKeptSelected(keptChosen.length === keptForHistory.length ? new Set() : new Set(keptForHistory.map(w => w.id)))}>{keptChosen.length === keptForHistory.length ? 'Deselect all' : 'Select all'}</Button>
                  {keptChosen.length > 0 && <Button size="sm" variant="danger" onClick={() => openDelete(keptChosen, { historyOnly: true })}>Delete {keptChosen.length}</Button>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 6 }}>Their program was deleted, but athletes have completed or been assigned them.</div>
                {keptForHistory.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, borderTop: '1px solid var(--br)' }}>
                    <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, cursor: 'pointer' }}>
                      <input type="checkbox" checked={keptSelected.has(w.id)} onChange={() => setKeptSelected(prev => { const n = new Set(prev); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n })} style={{ width: 18, height: 18, accentColor: 'var(--ac)' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                    </label>
                    <button type="button" onClick={e => setPreview({ workoutId: w.id, anchorRect: e.currentTarget.getBoundingClientRect() })} aria-label={`Preview ${w.name}`}
                      style={{ width: 36, height: 36, background: 'none', border: 'none', color: 'var(--mu2)', cursor: 'pointer' }}><Icon name="note" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </Page>

      {assign && <AssignModal workout={assign.workout} mode={assign.mode} onClose={() => setAssign(null)}
        onSaved={n => { setToast(n ? `Assigned to ${n} athlete${n === 1 ? '' : 's'}` : 'Assignment cleared'); fetchAll() }} />}

      {confirm && (() => {
        const x = confirm.impact?.[confirm.workout.id]
        const plan = confirm.impact ? workoutDeletePlan([confirm.workout], confirm.impact, { keepHistory: false }) : null
        const hasHistory = (x?.completions || 0) > 0
        return (
          <Dialog title={`Delete ${confirm.workout.name}?`} subtitle="Here is what else this changes." onClose={() => setConfirm(null)} busy={busy}
            footer={<>
              <Button onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
              {hasHistory && <Button variant="danger" onClick={destroy} disabled={busy}>Delete and erase history</Button>}
              {hasHistory && <Button variant="primary" onClick={archive} disabled={busy}>Archive, keep history</Button>}
              {plan && !hasHistory && <Button variant="danger" onClick={destroy} disabled={busy}>Delete workout</Button>}
            </>}>
            {!plan && !confirmError && <div style={{ fontSize: 13, color: 'var(--mu2)' }}>Checking what else this changes…</div>}
            {plan && plan.rows.map((r, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${TONE[r.tone]}55`, background: `${TONE[r.tone]}12`, fontSize: 13, lineHeight: 1.5 }}>{r.text}</div>
            ))}
            {confirmError && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{confirmError}</p>}
          </Dialog>
        )
      })()}

      {selecting && (
        <SelectionBar
          count={selectedWorkouts.length}
          deleteLabel={selectedWorkouts.length ? `Delete ${selectedWorkouts.length}` : 'Delete'}
          hint={selectedWorkouts.length === 0
            ? (isMobile ? 'Tap workouts to select them' : 'Tick workouts to select them · Shift-click selects a range')
            : selectedWithHistory ? `${selectedWithHistory} ${selectedWithHistory === 1 ? 'has' : 'have'} athlete history` : `${selectedWorkouts.length} selected`}
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
            : `${describeSelection(deleteReq.workouts.map(w => w.name))}. Deleting can’t be undone.`}
          loading={!impact && !deleteError}
          rows={deletePlan?.rows}
          keepToggle={{ label: 'Keep workouts with athlete history', hint: 'They stay in your list. Turn this off to delete them and their history too.', checked: keepHistory, onChange: setKeepHistory }}
          confirmLabel={deletePlan?.confirmLabel || 'Delete'}
          confirmDisabled={!deletePlan || deletePlan.toDelete.length === 0}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {preview && (
        <WorkoutPreviewPanel workoutId={preview.workoutId} anchorRect={preview.anchorRect} onClose={() => setPreview(null)}
          onEdit={() => navigate(`/plan/workouts/${preview.workoutId}/edit`)} />
      )}
    </Layout>
  )
}
