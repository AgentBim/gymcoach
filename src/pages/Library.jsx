import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import { CollectionSkeleton, CollectionStatus } from '../components/CollectionLoading'
import { useCollectionLoad } from '../hooks/useCollectionLoad'
import ExerciseMedia from '../components/ExerciseMedia'
import AddExerciseToWorkout from '../components/AddExerciseToWorkout'
import { hydrateExerciseMedia } from '../lib/exerciseMedia'
import { MUSCLE_COLORS } from '../lib/theme'
import { rememberLibrary } from '../lib/libraryView'
import { Button, Card, Chip, Dialog, EmptyState, Icon, Label, Page, PageHeader, Pill, PillRow, SearchBox } from '../components/ui'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const CATS = [['all', 'All'], ['strength', 'Strength'], ['prehab', 'Prehab'], ['mobility', 'Mobility']]
const COLS = 'minmax(150px, 2fr) 104px 72px 76px 84px 16px'
const EMPTY_LIBRARY = { exercises: [], usage: new Map() }

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
  const [adding, setAdding] = useState(false)
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
      <ExerciseMedia exercise={ex} />
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
        <Button variant="primary" onClick={() => setAdding(true)}>Add to a workout</Button>
        {ex.is_custom && <Button onClick={() => navigate(`/plan/exercises/${ex.id}/edit`)}>Edit</Button>}
      </div>
      {adding && <AddExerciseToWorkout exercise={ex} onClose={() => setAdding(false)} />}
    </div>
  )
}

export default function Library() {
  const { user } = useAuth()
  const isMobile = useIsMobile(1279)
  const [params, setParams] = useSearchParams()
  const search = params.toString()
  useEffect(() => { rememberLibrary(user?.id, search) }, [user?.id, search])
  const cat = CATS.some(([c]) => c === params.get('category')) ? params.get('category') : 'all'
  const group = GROUPS.includes(params.get('group')) ? params.get('group') : 'All'
  const query = params.get('q') || ''
  const selId = params.get('exercise')
  function updateParams(values) {
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([key, value]) => value && value !== 'all' && value !== 'All' ? next.set(key, value) : next.delete(key))
      return next
    }, { replace: true })
  }
  const setCat = category => updateParams({ category, exercise: null })
  const setGroup = group => updateParams({ group, exercise: null })
  const setQuery = q => updateParams({ q, exercise: null })
  const setSelId = exercise => updateParams({ exercise })
  const clearFilters = () => updateParams({ category: null, group: null, q: null, exercise: null })

  const loadLibrary = useCallback(async signal => {
    const [exRes, weRes, wpRes] = await Promise.all([
      supabase.from('exercises').select('*')
        .or(user ? `coach_id.is.null,coach_id.eq.${user.id}` : 'coach_id.is.null')
        .order('is_custom', { ascending: false }).order('muscle_group').order('name').abortSignal(signal),
      supabase.from('workout_exercises').select('exercise_id, workouts(id, name, program_generated, archived_at)').abortSignal(signal),
      supabase.from('workout_prehab').select('exercise_id, workouts(id, name, program_generated, archived_at)').abortSignal(signal),
    ])
    const failure = [exRes, weRes, wpRes].find(r => r.error)?.error
    if (failure) throw failure
    const exercises = await hydrateExerciseMedia(exRes.data || [])
    const map = new Map()
    ;[...(weRes.data || []), ...(wpRes.data || [])].forEach(r => {
      const w = r.workouts
      if (!w || w.program_generated || w.archived_at) return
      if (!map.has(r.exercise_id)) map.set(r.exercise_id, new Map())
      map.get(r.exercise_id).set(w.id, { id: w.id, name: w.name })
    })
    return { exercises, usage: new Map([...map].map(([k, v]) => [k, [...v.values()]])) }
  }, [user?.id])
  const { data, hasData, loading, refreshing, error: loadError, reload: retryLibrary } = useCollectionLoad(user?.id, loadLibrary, EMPTY_LIBRARY)
  const { exercises, usage } = data

  const q = query.trim().toLowerCase()
  const shown = exercises.filter(e =>
    (cat === 'all' || catOf(e) === cat) && (group === 'All' || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q)))
  const count = c => exercises.filter(e => c === 'all' || catOf(e) === c).length
  const sel = exercises.find(e => e.id === selId) || null
  const custom = exercises.filter(e => e.is_custom).length
  useEffect(() => {
    if (hasData && selId && !exercises.some(e => e.id === selId &&
      (cat === 'all' || catOf(e) === cat) && (group === 'All' || e.muscle_group === group) &&
      (!query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase())))) setSelId(null)
  }, [exercises, cat, group, query, selId, hasData])

  return (
    <Layout>
      <PlanTabs />
      <Page>
        <PageHeader eyebrow={hasData ? `${exercises.length} exercises · ${custom} yours` : 'Your exercise library'} title="Exercises">
          <SearchBox value={query} onChange={setQuery} placeholder="Search exercises" label="Search exercises" style={{ width: isMobile ? '100%' : 220 }} />
          <Button variant="primary" icon="plus" onClick={() => navigate('/plan/exercises/new')}>New exercise</Button>
        </PageHeader>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <PillRow label="Category">{CATS.map(([k, l]) => <Pill key={k} on={cat === k} count={hasData ? count(k) : undefined} onClick={() => setCat(k)}>{l}</Pill>)}</PillRow>
          <PillRow label="Muscle group">{GROUPS.map(g => <Pill key={g} on={group === g} onClick={() => setGroup(g)}>{g}</Pill>)}</PillRow>
        </div>

        <CollectionStatus name="exercises" loading={loading} refreshing={refreshing} error={loadError} onRetry={retryLibrary} />
        {loading ? <CollectionSkeleton kind="exercises" columns={COLS} mobile={isMobile} /> : !hasData ? null : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <Card style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px' }}>
                  <Label>Exercise</Label><Label>Muscle group</Label><Label>Type</Label><Label>Default</Label><Label>Used in</Label><span />
                </div>
              )}
              {shown.length === 0 && <EmptyState title={cat === 'mobility' && count('mobility') === 0 ? 'Mobility is coming soon' : 'No exercises match'}>
                <p>{cat === 'mobility' && count('mobility') === 0 ? 'There are no mobility exercises in your library yet.' : 'Try another name or clear your filters.'}</p>
                <Button onClick={clearFilters} style={{ marginTop: 12 }}>Clear filters</Button>
              </EmptyState>}
              {shown.map(e => {
                const used = usage.get(e.id)?.length || 0
                const on = e.id === selId
                const name = (
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                      {e.is_custom && <Chip tone="accent">Yours</Chip>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{e.difficulty}{isMobile && cat === 'all' ? ` · ${cap(catOf(e))}` : ''}</span>
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

    </Layout>
  )
}
