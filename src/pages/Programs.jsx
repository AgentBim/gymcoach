import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import { SelectionBar, ConfirmDeleteSheet, Toast } from '../components/BulkDelete'
import { fetchProgramImpact, programDeletePlan } from '../lib/bulkDelete'

const ACCENTS = ['var(--ac)', '#6BA9DE', '#A184E3', '#4FB88A', '#E7A23E']

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading]   = useState(true)
  // Bulk delete: select mode on the program list; deleteReq opens the
  // confirmation sheet (also used for deleting a single program).
  const [selecting, setSelecting]     = useState(false)
  const [selected, setSelected]       = useState(() => new Set())
  const [lastIdx, setLastIdx]         = useState(null)
  const [deleteReq, setDeleteReq]     = useState(null) // [{ id, name }]
  const [impact, setImpact]           = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [toast, setToast]             = useState('')
  const deleteReqId = useRef(0)

  useEffect(() => { fetchPrograms() }, [user])

  async function fetchPrograms() {
    if (!user) return
    const { data } = await supabase
      .from('programs')
      .select('*, program_days(id), athletes!athletes_active_program_id_fkey(id)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    setPrograms(data || [])
    setLoading(false)
  }

  // Every delete, one program or many, goes through the confirmation sheet
  // and delete_programs (all or nothing). Each program's generated workouts
  // go with it, except ones athletes have feedback or assignments on.
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

  function closeDelete() {
    deleteReqId.current += 1
    setDeleteReq(null)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    const { data, error: rpcError } = await supabase.rpc('delete_programs', { p_program_ids: deleteReq.map(p => p.id) })
    setDeleting(false)
    if (rpcError) { setDeleteError(rpcError.message || 'Could not delete'); return }
    setToast(`${data} program${data === 1 ? '' : 's'} deleted`)
    setDeleteReq(null)
    stopSelecting()
    fetchPrograms()
  }

  function startSelecting() {
    setSelecting(true)
    setSelected(new Set())
    setLastIdx(null)
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
        programs.slice(from, to + 1).forEach(p => next.add(p.id))
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastIdx(idx)
  }

  const selectedPrograms = programs.filter(p => selected.has(p.id))
  const allSelected = programs.length > 0 && selectedPrograms.length === programs.length
  const selectedAthletes = selectedPrograms.reduce((n, p) => n + (p.athletes?.length || 0), 0)
  const deletePlan = deleteReq && impact ? programDeletePlan(deleteReq, impact) : null
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(programs.map(p => p.id)))

  return (
    <Layout>
      {/* ── MOBILE HEADER ── */}
      {isMobile && (
        <div style={{ paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          {selecting ? (
            <div style={{ padding: '0 8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={stopSelecting} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: 'var(--mu)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{selectedPrograms.length ? `${selectedPrograms.length} selected` : 'Select programs'}</span>
              <button onClick={toggleAll} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: 'var(--ac)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Programs</div>
                <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 1 }}>Multi-week training plans</div>
              </div>
              {programs.length > 0 && (
                <button onClick={startSelecting} style={{ background: 'var(--br)', border: 'none', borderRadius: 10, color: 'var(--tx)', padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Select</button>
              )}
              <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}>
        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Training programs</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Multi-week plans built from your workouts</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selecting && (
                <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: 'var(--ac)', padding: '9px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {allSelected ? 'Deselect all' : `Select all ${programs.length}`}
                </button>
              )}
              {programs.length > 0 && (
                <button onClick={selecting ? stopSelecting : startSelecting} aria-pressed={selecting}
                  style={{ background: selecting ? 'rgba(199,228,92,.12)' : 'var(--s2)', border: `1px solid ${selecting ? 'rgba(199,228,92,.45)' : 'var(--br)'}`, color: selecting ? 'var(--ac)' : 'var(--tx)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {selecting ? 'Done' : 'Select'}
                </button>
              )}
              <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New program</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No programs yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Build a multi-week plan from your saved workouts</p>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create program</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))', gap: isMobile ? 10 : 14 }}>
            {programs.map((p, idx) => {
              const accent = ACCENTS[idx % ACCENTS.length]
              const days = p.program_days?.length || 0
              const activeFor = p.athletes?.length || 0
              if (selecting) {
                // Label handles the click itself (preventDefault stops the
                // native toggle) so shift-click can select a range.
                const on = selected.has(p.id)
                return (
                  <label key={p.id} onClick={e => { e.preventDefault(); toggleSelected(idx, p.id, e.shiftKey) }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, cursor: 'pointer', userSelect: 'none',
                      background: on ? 'rgba(199,228,92,.08)' : 'var(--s2)', border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}` }}>
                    <input type="checkbox" checked={on} onChange={() => {}} aria-label={`Select ${p.name}`}
                      style={{ width: 20, height: 20, margin: '1px 0 0', flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(200,255,80,.1)', color: 'var(--ac)' }}>{p.duration_weeks} week{p.duration_weeks !== 1 ? 's' : ''}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--br)', color: 'var(--mu2)' }}>{days} day{days !== 1 ? 's' : ''} planned</span>
                        {activeFor > 0 && (
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(231,162,62,.14)', color: '#E7A23E' }}>Active for {activeFor} athlete{activeFor !== 1 ? 's' : ''}</span>
                        )}
                      </span>
                    </span>
                  </label>
                )
              }
              return (
                <div key={p.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: '14px 14px 12px', position: 'relative', overflow: 'hidden' }}>
                  {/* Accent bar */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '3px 0 0 3px' }} />
                  <div style={{ paddingLeft: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 8, lineHeight: 1.5 }}>{p.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(200,255,80,.1)', color: 'var(--ac)' }}>
                        {p.duration_weeks} week{p.duration_weeks !== 1 ? 's' : ''}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--br)', color: 'var(--mu2)' }}>
                        {days} day{days !== 1 ? 's' : ''} planned
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 7 }}>
                      <button onClick={() => navigate(`/programs/${p.id}`)}
                        style={{ flex: 1, background: 'rgba(200,255,80,.08)', border: '1px solid rgba(200,255,80,.2)', borderRadius: 9, color: 'var(--ac)', fontSize: 13, fontWeight: 600, padding: '9px 10px', cursor: 'pointer' }}>
                        Open
                      </button>
                      <button onClick={() => openDelete([p])} aria-label={`Delete ${p.name}`}
                        style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 9, color: '#E2695A', fontSize: 13, padding: '9px 12px', cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!isMobile && !selecting && (
              <div onClick={() => navigate('/programs/new')} style={{ border: '1.5px dashed var(--br)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, cursor: 'pointer', color: 'var(--mu)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--br)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
                <span style={{ fontSize: 13 }}>New program</span>
              </div>
            )}
          </div>
        )}
      </div>

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
          subtitle="Deleting can’t be undone. Here’s what else it changes."
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
