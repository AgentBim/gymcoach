import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import { MUSCLE_COLORS } from '../lib/theme'
import { Button, Card, Chip, Dialog, EmptyState, Icon, Label, Page, PageHeader, Pill, PillRow, SearchBox, Segmented } from '../components/ui'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const CATS = [['all', 'All'], ['strength', 'Strength'], ['prehab', 'Prehab'], ['mobility', 'Mobility']]
const COLS = 'minmax(150px, 2fr) 104px 72px 76px 84px 16px'

const dose = e => `${e.default_sets} × ${e.default_reps || (e.default_duration_seconds ? e.default_duration_seconds + 's' : '–')}`
const catOf = e => e.category || 'strength'
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

function GroupChip({ g }) {
  const c = MUSCLE_COLORS[g] || { bg: 'var(--s2)', color: 'var(--mu2)' }
  return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.color }}>{g}</span>
}

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--br)', borderRadius: 10 }}>
      <Label>{label}</Label>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Detail({ ex, usedIn, onClose }) {
  const navigate = useNavigate()
  const timed = !ex.default_reps && ex.default_duration_seconds
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{ex.name}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <GroupChip g={ex.muscle_group} /><Chip>{cap(catOf(ex))}</Chip><Chip>{ex.difficulty}</Chip>
          </div>
        </div>
        {onClose && <button type="button" aria-label="Close details" onClick={onClose} style={{ width: 36, height: 36, background: 'none', border: 'none', color: 'var(--mu2)', cursor: 'pointer' }}><Icon name="close" /></button>}
      </div>
      <div>
        <Label style={{ marginBottom: 6 }}>Coaching cue</Label>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: ex.description ? 'var(--tx)' : 'var(--mu)' }}>{ex.description || 'No cue yet.'}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Stat label="Sets" value={ex.default_sets} />
        <Stat label={timed ? 'Secs' : 'Reps'} value={timed ? ex.default_duration_seconds : ex.default_reps || '–'} />
        <Stat label="Rest" value={`${ex.default_rest_seconds}s`} />
      </div>
      <div>
        <Label style={{ marginBottom: 6 }}>Used in</Label>
        {usedIn.length === 0
          ? <p style={{ fontSize: 13.5, color: 'var(--mu2)' }}>Not in any workout yet.</p>
          : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{usedIn.map(w => <Link key={w.id} to={`/plan/workouts/${w.id}/edit`} style={{ padding: '4px 10px', border: '1px solid var(--br2)', borderRadius: 20, fontSize: 12.5 }}>{w.name}</Link>)}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={() => navigate('/plan/workouts/new')}>Add to a workout</Button>
        {ex.is_custom && <Button onClick={() => navigate(`/plan/exercises/${ex.id}/edit`)}>Edit</Button>}
      </div>
    </div>
  )
}

export default function Library() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [exercises, setExercises] = useState([])
  const [usage, setUsage] = useState(new Map()) // exerciseId -> [{ id, name }]
  const [cat, setCat] = useState('all')
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [nName, setNName] = useState('')
  const [nGroup, setNGroup] = useState('Arms')
  const [nCat, setNCat] = useState('strength')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [user])

  async function fetchAll() {
    const [exRes, weRes, wpRes] = await Promise.all([
      supabase.from('exercises').select('*')
        .or(user ? `coach_id.is.null,coach_id.eq.${user.id}` : 'coach_id.is.null')
        .order('is_custom', { ascending: false }).order('muscle_group').order('name'),
      supabase.from('workout_exercises').select('exercise_id, workouts(id, name, program_generated, archived_at)'),
      supabase.from('workout_prehab').select('exercise_id, workouts(id, name, program_generated, archived_at)'),
    ])
    setExercises(exRes.data || [])
    const map = new Map()
    ;[...(weRes.data || []), ...(wpRes.data || [])].forEach(r => {
      const w = r.workouts
      if (!w || w.program_generated || w.archived_at) return
      if (!map.has(r.exercise_id)) map.set(r.exercise_id, new Map())
      map.get(r.exercise_id).set(w.id, { id: w.id, name: w.name })
    })
    setUsage(new Map([...map].map(([k, v]) => [k, [...v.values()]])))
    setLoading(false)
  }

  async function createExercise() {
    setSaving(true)
    setSaveError('')
    const prehab = nCat === 'prehab'
    const { data, error } = await supabase.from('exercises').insert({
      name: nName.trim(), description: '', muscle_group: nGroup, difficulty: 'Medium',
      default_sets: prehab ? 2 : 3, default_reps: 10, default_duration_seconds: null, default_rest_seconds: prehab ? 20 : 60,
      coach_id: user.id, is_custom: true, category: nCat, prehab_focus: null,
    }).select().single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setNewOpen(false); setNName('')
    setCat('all'); setGroup('All'); setQuery('')
    await fetchAll()
    setSelId(data.id)
  }

  const q = query.trim().toLowerCase()
  const shown = exercises.filter(e =>
    (cat === 'all' || catOf(e) === cat) && (group === 'All' || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q)))
  const count = c => exercises.filter(e => c === 'all' || catOf(e) === c).length
  const sel = exercises.find(e => e.id === selId) || null
  const custom = exercises.filter(e => e.is_custom).length

  return (
    <Layout>
      <PlanTabs />
      <Page>
        <PageHeader eyebrow={`${exercises.length} exercises · ${custom} yours`} title="Exercises">
          <SearchBox value={query} onChange={setQuery} placeholder="Search exercises" label="Search exercises" style={{ width: isMobile ? '100%' : 220 }} />
          <Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New exercise</Button>
        </PageHeader>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <PillRow label="Category">{CATS.map(([k, l]) => <Pill key={k} on={cat === k} count={count(k)} onClick={() => setCat(k)}>{l}</Pill>)}</PillRow>
          <PillRow label="Muscle group">{GROUPS.map(g => <Pill key={g} on={group === g} onClick={() => setGroup(g)}>{g}</Pill>)}</PillRow>
        </div>

        {loading ? <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div> : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <Card style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px' }}>
                  <Label>Exercise</Label><Label>Muscle group</Label><Label>Type</Label><Label>Default</Label><Label>Used in</Label><span />
                </div>
              )}
              {shown.length === 0 && <EmptyState>No exercises match.</EmptyState>}
              {shown.map(e => {
                const used = usage.get(e.id)?.length || 0
                const on = e.id === selId
                const name = (
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                      {e.is_custom && <Chip tone="accent">Yours</Chip>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{e.difficulty}</span>
                  </span>
                )
                return (
                  <button key={e.id} type="button" aria-pressed={on} onClick={() => setSelId(e.id)}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : COLS, gap: 12, alignItems: 'center', padding: '12px 16px', border: 'none', borderTop: '1px solid var(--br)', textAlign: 'left', color: 'var(--tx)', cursor: 'pointer',
                      background: on ? 'rgba(199,228,92,.07)' : 'transparent' }}>
                    {name}
                    {isMobile ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><GroupChip g={e.muscle_group} /><span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{dose(e)}</span></span> : (
                      <>
                        <span><GroupChip g={e.muscle_group} /></span>
                        <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{cap(catOf(e))}</span>
                        <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{dose(e)}{e.default_reps ? '' : ''}</span>
                        <span style={{ fontSize: 13, color: used ? 'var(--tx)' : 'var(--mu)' }}>{used ? `${used} workout${used === 1 ? '' : 's'}` : 'Not used'}</span>
                        <Icon name="forward" size={16} style={{ color: 'var(--mu)' }} />
                      </>
                    )}
                  </button>
                )
              })}
            </Card>

            {!isMobile && (
              <aside style={{ width: 340, flexShrink: 0, position: 'sticky', top: 16 }}>
                <Card style={{ padding: 18 }}>
                  {sel ? <Detail ex={sel} usedIn={usage.get(sel.id) || []} onClose={() => setSelId(null)} /> : (
                    <>
                      <h2 style={{ fontSize: 16, fontWeight: 700 }}>Pick an exercise</h2>
                      <p style={{ fontSize: 13.5, color: 'var(--mu2)', marginTop: 6, lineHeight: 1.5 }}>See its cue, defaults and the workouts that use it.</p>
                    </>
                  )}
                </Card>
              </aside>
            )}
          </div>
        )}
      </Page>

      {isMobile && sel && (
        <Dialog title="Exercise" onClose={() => setSelId(null)}>
          <Detail ex={sel} usedIn={usage.get(sel.id) || []} />
        </Dialog>
      )}

      {newOpen && (
        <Dialog title="New exercise" subtitle="It joins your library and shows up in the workout builder." onClose={() => setNewOpen(false)} busy={saving}
          footer={<><Button onClick={() => setNewOpen(false)}>Cancel</Button><Button variant="primary" onClick={createExercise} disabled={!nName.trim() || saving}>{saving ? 'Adding…' : 'Add exercise'}</Button></>}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Name</Label>
            <input value={nName} onChange={e => setNName(e.target.value)} placeholder="e.g. Ring row" autoFocus
              style={{ minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 15, outline: 'none' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Muscle group</Label>
            <select value={nGroup} onChange={e => setNGroup(e.target.value)}
              style={{ minHeight: 44, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 10, color: 'var(--tx)', padding: '0 12px', fontSize: 15 }}>
              {GROUPS.slice(1).map(g => <option key={g}>{g}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Type</Label>
            <Segmented label="Type" value={nCat} onChange={setNCat} options={[{ value: 'strength', label: 'Strength' }, { value: 'prehab', label: 'Prehab' }, { value: 'mobility', label: 'Mobility' }]} />
          </div>
          {saveError && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{saveError}</p>}
        </Dialog>
      )}
    </Layout>
  )
}
