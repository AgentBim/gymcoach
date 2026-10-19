import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import { SelectionBar, ConfirmDeleteSheet, Toast } from '../components/BulkDelete'
import { describeSelection, fetchProgramImpact, programDeletePlan } from '../lib/bulkDelete'
import { todayLocal } from '../lib/streaks'
import { nextMondayStr, fmtShort } from '../lib/dates'
import { Avatar, AvatarStack, Button, Card, CheckRow, Chip, Dialog, EmptyState, Icon, MoreMenu, Page, PageHeader, Pill, PillRow, SearchBox } from '../components/ui'

// Per-week thumbnail: one row per week, one cell per weekday.
function cellKind(d) {
  if (!d) return 'rest'
  if (d.day_type === 'recovery') return 'recovery'
  if (d.day_type === 'competition') return 'meet'
  return d.workout_id || d.day_type === 'training' ? 'training' : 'rest'
}
const CELL = { training: 'var(--ac)', meet: '#E2695A', recovery: '#6BA9DE', rest: 'var(--br2)' }

function Thumb({ program }) {
  const byCell = new Map((program.program_days || []).map(d => [`${d.week_number}:${d.day_of_week}`, d]))
  const weeks = Math.min(program.duration_weeks, 8)
  return (
    <div role="img" aria-label="Training days preview, one row per week" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array.from({ length: 7 }, (_, d) => {
            const k = cellKind(byCell.get(`${w + 1}:${d}`))
            return <span key={d} style={{ height: 8, borderRadius: 3, background: CELL[k], opacity: k === 'rest' ? 0.5 : 1 }} />
          })}
        </div>
      ))}
    </div>
  )
}

function sessionsPerWeek(program) {
  return (program.program_days || []).filter(d => d.week_number === 1 && cellKind(d) === 'training').length
}

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState([])
  const [allAthletes, setAllAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [assignFor, setAssignFor] = useState(null)
  const [draft, setDraft] = useState(new Set())
  const [savingAssign, setSavingAssign] = useState(false)
  // Select mode + delete confirmation (bulk delete from the earlier build).
  const [selecting, setSelecting]     = useState(false)
  const [selected, setSelected]       = useState(() => new Set())
  const [lastIdx, setLastIdx]         = useState(null)
  const [deleteReq, setDeleteReq]     = useState(null)
  const [impact, setImpact]           = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [toast, setToast]             = useState('')
  const deleteReqId = useRef(0)
  const shiftClick = useRef(false)

  useEffect(() => { fetchPrograms() }, [user])

  async function fetchPrograms() {
    if (!user) return
    const [pRes, aRes] = await Promise.all([
      supabase.from('programs')
        .select('*, program_days(week_number, day_of_week, day_type, workout_id), athletes!athletes_active_program_id_fkey(id, full_name)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('athletes').select('id, full_name, active_program_id').eq('coach_id', user.id).order('full_name'),
    ])
    setPrograms(pRes.data || [])
    setAllAthletes(aRes.data || [])
    setLoading(false)
  }

  async function duplicate(p) {
    const { error } = await supabase.rpc('duplicate_program', { p_program_id: p.id })
    if (error) { setToast(error.message || 'Could not duplicate'); return }
    setToast(`Duplicated ${p.name}`)
    fetchPrograms()
  }

  // ── assign athletes (mockup "Assign" dialog) ──
  const startDate = nextMondayStr(todayLocal())
  function openAssign(p) {
    setAssignFor(p)
    setDraft(new Set((p.athletes || []).map(a => a.id)))
  }
  async function saveAssign() {
    setSavingAssign(true)
    const before = new Set((assignFor.athletes || []).map(a => a.id))
    const added = [...draft].filter(id => !before.has(id))
    const removed = [...before].filter(id => !draft.has(id))
    const ops = []
    if (added.length) ops.push(supabase.from('athletes').update({ active_program_id: assignFor.id, program_started_on: startDate }).in('id', added))
    if (removed.length) ops.push(supabase.from('athletes').update({ active_program_id: null, program_started_on: null }).in('id', removed))
    const results = await Promise.all(ops)
    setSavingAssign(false)
    const err = results.find(r => r.error)?.error
    if (err) { setToast(err.message || 'Could not save'); return }
    setToast(draft.size ? `Assigned to ${draft.size} athlete${draft.size === 1 ? '' : 's'}` : 'Nobody assigned')
    setAssignFor(null)
    fetchPrograms()
  }

  // ── delete ──
  async function openDelete(list) {
    if (!list.length) return
    const reqId = ++deleteReqId.current
    setDeleteReq(list.map(p => ({ id: p.id, name: p.name })))
    setImpact(null)
    setDeleteError('')
    try {
      const result = await fetchProgramImpact(list.map(p => p.id))
      if (reqId === deleteReqId.current) setImpact(result)
    } catch (err) {
      if (reqId === deleteReqId.current) setDeleteError(err.message || 'Could not check what this delete changes')
    }
  }
  function closeDelete() { deleteReqId.current += 1; setDeleteReq(null) }
  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    const { data, error: rpcError } = await supabase.rpc('delete_programs', { p_program_ids: deleteReq.map(p => p.id) })
    setDeleting(false)
    if (rpcError) { setDeleteError(rpcError.message || 'Could not delete'); return }
    setToast(`${data} program${data === 1 ? '' : 's'} deleted. Athletes on ${data === 1 ? 'it' : 'them'} keep their history.`)
    setDeleteReq(null)
    stopSelecting()
    fetchPrograms()
  }

  function startSelecting() { setSelecting(true); setSelected(new Set()); setLastIdx(null) }
  function stopSelecting() { setSelecting(false); setSelected(new Set()); setLastIdx(null) }
  function toggleSelected(idx, id, shiftKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastIdx !== null) {
        const [from, to] = [Math.min(lastIdx, idx), Math.max(lastIdx, idx)]
        shown.slice(from, to + 1).forEach(p => next.add(p.id))
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastIdx(idx)
  }

  const inUse = p => (p.athletes?.length || 0) > 0
  const q = query.trim().toLowerCase()
  const shown = programs.filter(p =>
    (filter === 'all' || (filter === 'use' ? inUse(p) : !inUse(p))) && (!q || p.name.toLowerCase().includes(q)))
  const count = f => programs.filter(p => f === 'all' || (f === 'use' ? inUse(p) : !inUse(p))).length

  const selectedPrograms = programs.filter(p => selected.has(p.id))
  const selectedAthletes = selectedPrograms.reduce((n, p) => n + (p.athletes?.length || 0), 0)
  const allSelected = shown.length > 0 && shown.every(p => selected.has(p.id))
  const deletePlan = deleteReq && impact ? programDeletePlan(deleteReq, impact) : null

  const programOf = id => programs.find(p => (p.athletes || []).some(a => a.id === id))

  return (
    <Layout>
      <PlanTabs />
      <Page>
        <PageHeader eyebrow={`${programs.length} program${programs.length === 1 ? '' : 's'}`} title="Programs">
          <SearchBox value={query} onChange={setQuery} placeholder="Search programs" label="Search programs" style={{ width: isMobile ? '100%' : 220 }} />
          {programs.length > 0 && (
            <Button onClick={selecting ? stopSelecting : startSelecting} aria-pressed={selecting}>{selecting ? 'Done' : 'Select'}</Button>
          )}
          <Button variant="primary" icon="plus" onClick={() => navigate('/plan/programs/new')}>New program</Button>
        </PageHeader>

        <PillRow label="Filter programs">
          <Pill on={filter === 'all'} count={count('all')} onClick={() => setFilter('all')}>All</Pill>
          <Pill on={filter === 'use'} count={count('use')} onClick={() => setFilter('use')}>In use</Pill>
          <Pill on={filter === 'none'} count={count('none')} onClick={() => setFilter('none')}>Not assigned</Pill>
        </PillRow>

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div>
        ) : (
          <>
            {shown.length === 0 && <Card><EmptyState>{programs.length === 0 ? 'No programs yet. Start one below.' : 'No programs match.'}</EmptyState></Card>}
            <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: isMobile ? 12 : 16 }}>
              {shown.map((p, idx) => {
                const use = inUse(p)
                const names = (p.athletes || []).map(a => a.full_name)
                const per = sessionsPerWeek(p)
                if (selecting) {
                  const on = selected.has(p.id)
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, cursor: 'pointer', userSelect: 'none', background: on ? 'rgba(199,228,92,.08)' : 'var(--s1)', border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}` }}>
                      <input type="checkbox" checked={on} aria-label={`Select ${p.name}`}
                        onClick={e => { shiftClick.current = e.shiftKey }}
                        onChange={() => toggleSelected(idx, p.id, shiftClick.current)}
                        style={{ width: 20, height: 20, margin: '1px 0 0', flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>{p.duration_weeks} weeks · {per} sessions a week</span>
                        {use && <span style={{ display: 'block', fontSize: 12, color: '#E7A23E', marginTop: 6 }}>Active for {names.length} athlete{names.length === 1 ? '' : 's'}</span>}
                      </span>
                    </label>
                  )
                }
                return (
                  <Card as="article" key={p.id} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/plan/programs/${p.id}`} style={{ fontSize: 16, fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Link>
                        <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>{p.duration_weeks} week{p.duration_weeks === 1 ? '' : 's'} · {per} sessions a week</div>
                      </div>
                      <Chip tone={use ? 'accent' : 'amber'}>{use ? 'In use' : 'Not assigned'}</Chip>
                      <MoreMenu label={`More actions for ${p.name}`} items={[
                        { label: 'Open and edit', icon: 'edit', onClick: () => navigate(`/plan/programs/${p.id}`) },
                        { label: 'Duplicate', icon: 'copy', onClick: () => duplicate(p) },
                        { label: 'Delete', icon: 'trash', danger: true, onClick: () => openDelete([p]) },
                      ]} />
                    </div>
                    <Thumb program={p} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--br)', paddingTop: 12, marginTop: 'auto' }}>
                      {use ? (
                        <button type="button" onClick={() => openAssign(p)} aria-label={`Edit athletes on ${p.name}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, background: 'none', border: 'none', color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
                          <AvatarStack names={names} />{names.length} athlete{names.length === 1 ? '' : 's'}
                        </button>
                      ) : <span style={{ fontSize: 12.5, color: 'var(--mu)' }}>Not assigned</span>}
                      <span style={{ flex: 1 }} />
                      {!use && <Button size="sm" onClick={() => openAssign(p)}>Assign</Button>}
                      <Link to={`/plan/programs/${p.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac)', padding: '0 4px' }}>Open</Link>
                    </div>
                  </Card>
                )
              })}
              {!selecting && (
                <Link to="/plan/programs/new" style={{ border: '1.5px dashed var(--br2)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, color: 'var(--mu2)', textAlign: 'center', padding: 16 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--s2)', display: 'grid', placeItems: 'center' }}><Icon name="plus" /></span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>New program</span>
                  <span style={{ fontSize: 12.5, maxWidth: 260 }}>Start blank, or generate a full block from your exercise library inside the editor.</span>
                </Link>
              )}
            </section>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--mu2)' }}>
              {[['training', 'Training'], ['recovery', 'Recovery'], ['rest', 'Rest']].map(([k, l]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 3, background: CELL[k], opacity: k === 'rest' ? 0.5 : 1 }} />{l}</span>
              ))}
            </div>
          </>
        )}
      </Page>

      {assignFor && (
        <Dialog title={`Assign ${assignFor.name}`} subtitle={`New athletes start next Monday, ${fmtShort(startDate)}. People already on another program are moved over.`} onClose={() => setAssignFor(null)} busy={savingAssign}
          footer={<><Button onClick={() => setAssignFor(null)}>Cancel</Button><Button variant="primary" onClick={saveAssign} disabled={savingAssign}>{savingAssign ? 'Saving…' : 'Save'}</Button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allAthletes.length === 0 && <EmptyState>No athletes yet.</EmptyState>}
            {allAthletes.map(a => {
              const other = programOf(a.id)
              const elsewhere = other && other.id !== assignFor.id && !draft.has(a.id)
              return (
                <CheckRow key={a.id} checked={draft.has(a.id)} onChange={() => setDraft(d => { const n = new Set(d); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}>
                  <Avatar name={a.full_name} size={28} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.full_name}</span>
                  {elsewhere && <Chip tone="neutral">On {other.name}</Chip>}
                </CheckRow>
              )
            })}
          </div>
        </Dialog>
      )}

      {selecting && (
        <SelectionBar
          count={selectedPrograms.length}
          deleteLabel={selectedPrograms.length ? `Delete ${selectedPrograms.length}` : 'Delete'}
          hint={selectedPrograms.length === 0
            ? (isMobile ? 'Tap programs to select them' : 'Click cards to select · Shift-click selects a range')
            : selectedAthletes
              ? `${selectedAthletes} athlete${selectedAthletes === 1 ? ' is' : 's are'} on these`
              : `${selectedPrograms.length} selected`}
          hintTone={selectedAthletes ? 'warn' : 'muted'}
          onDelete={() => openDelete(selectedPrograms)}
        />
      )}

      {deleteReq && (
        <ConfirmDeleteSheet
          title={`Delete ${deleteReq.length === 1 ? deleteReq[0].name : `${deleteReq.length} programs`}?`}
          subtitle={deleteReq.length > 1
            ? `${describeSelection(deleteReq.map(p => p.name))}. Deleting can’t be undone.`
            : 'Deleting can’t be undone. Here’s what else it changes.'}
          loading={!impact && !deleteError}
          rows={deletePlan?.rows}
          confirmLabel={deletePlan?.confirmLabel || 'Delete'}
          confirmDisabled={!deletePlan}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </Layout>
  )
}
