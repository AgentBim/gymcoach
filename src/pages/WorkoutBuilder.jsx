import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import AIGeneratorModal from '../components/AIGeneratorModal'
import { MUSCLE_COLORS } from '../lib/theme'
import { Button, Card, Chip, Dialog, EmptyState, Icon, Label, Pill, PillRow, SearchBox, UndoToast } from '../components/ui'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const MUSCLE_GROUPS = GROUPS.slice(1)

const isTimed = it => !it.reps && !!it.duration_seconds
const amount = it => (isTimed(it) ? it.duration_seconds : it.reps)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const doseOf = (it, suffix = true) => `${it.sets} × ${amount(it) || '–'}${isTimed(it) && suffix ? 's' : ''}`
const catOf = e => e.category || 'strength'

function toItem(ex) {
  return { exercise: ex, sets: ex.default_sets, reps: ex.default_reps || '', duration_seconds: ex.default_duration_seconds || '', rest_seconds: ex.default_rest_seconds }
}

function GroupChip({ g }) {
  const c = MUSCLE_COLORS[g] || { bg: 'var(--s2)', color: 'var(--mu2)' }
  return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{g}</span>
}

// Balanced random pick: round-robin across muscle groups.
function randomPick(all, count = 6) {
  const pool = all.filter(e => catOf(e) === 'strength')
  const byGroup = Object.fromEntries(MUSCLE_GROUPS.map(g => [g, pool.filter(e => e.muscle_group === g).sort(() => Math.random() - 0.5)]))
  const out = []
  const order = ['Legs', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs']
  for (let i = 0; out.length < count && i < count * 3; i++) {
    const e = byGroup[order[i % order.length]].pop()
    if (e) out.push(e)
  }
  return out
}

function Stepper({ label, value, onDown, onUp, unit, suffix = '' }) {
  const isMobile = useIsMobile()
  const btn = { width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, border: '1px solid var(--br2)', borderRadius: 8, background: 'transparent', color: 'var(--tx)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <Label>{unit || label}</Label>
      <span role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={onDown} style={btn}>−</button>
        <span style={{ minWidth: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>{value || '–'}{value ? suffix : ''}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={onUp} style={btn}>+</button>
      </span>
    </div>
  )
}

export default function WorkoutBuilder() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [workoutId, setWorkoutId] = useState(id || null)
  const [sourceProgram, setSourceProgram] = useState(null)
  const [name, setName] = useState('')
  const [allExercises, setAllExercises] = useState([])
  const [selected, setSelected] = useState([])
  const [prehab, setPrehab] = useState([])
  const [isAi, setIsAi] = useState(false)
  const [tab, setTab] = useState('strength')
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fillOpen, setFillOpen] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.from('exercises').select('*')
      .or(user ? `coach_id.is.null,coach_id.eq.${user.id}` : 'coach_id.is.null')
      .order('muscle_group').order('name')
      .then(({ data }) => setAllExercises(data || []))
  }, [user])

  useEffect(() => { if (id) fetchWorkout() }, [id])

  async function fetchWorkout() {
    const { data } = await supabase.from('workouts')
      .select('*, workout_exercises(*, exercises(*)), workout_prehab(*, exercises(*))')
      .eq('id', id).single()
    if (!data) return
    const conv = rows => (rows || []).sort((a, b) => a.position - b.position)
      .map(r => ({ exercise: r.exercises, sets: r.sets, reps: r.reps || '', duration_seconds: r.duration_seconds || '', rest_seconds: r.rest_seconds }))
    setName(data.name)
    setIsAi(!!data.is_ai_generated)
    setSourceProgram(data.source_program_id || null)
    setSelected(conv(data.workout_exercises))
    setPrehab(conv(data.workout_prehab))
    setSaved(true)
  }

  const touch = fn => { fn(); setDirty(true); setSaved(false) }

  const inMain = useMemo(() => new Set(selected.map(s => s.exercise.id)), [selected])
  const inPrehab = useMemo(() => new Set(prehab.map(s => s.exercise.id)), [prehab])
  const q = query.trim().toLowerCase()
  const library = allExercises.filter(e =>
    (tab === 'strength' ? catOf(e) === 'strength' : catOf(e) === 'prehab') &&
    (group === 'All' || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q)))

  const groups = [...new Set(selected.map(s => s.exercise.muscle_group))]
  const suggest = allExercises.filter(e => catOf(e) === 'prehab' && groups.includes(e.muscle_group) && !inPrehab.has(e.id)).slice(0, 4)
  const secs = selected.reduce((a, it) => a + it.sets * (40 + it.rest_seconds), 0) + prehab.reduce((a, it) => a + it.sets * (30 + it.rest_seconds), 0)
  const minutes = Math.round(secs / 60)
  const ready = !!name.trim() && selected.length > 0

  function addFromLibrary(e) {
    if (tab === 'strength') { if (!inMain.has(e.id)) touch(() => setSelected(s => [...s, toItem(e)])) }
    else if (!inPrehab.has(e.id)) touch(() => setPrehab(s => [...s, { ...toItem(e), sets: e.default_sets || 2, rest_seconds: e.default_rest_seconds || 20 }]))
  }
  const patch = (idx, p, list = 'main') => touch(() => (list === 'main' ? setSelected : setPrehab)(s => s.map((it, i) => (i === idx ? { ...it, ...p } : it))))
  const move = (idx, dir) => touch(() => setSelected(s => {
    const j = idx + dir
    if (j < 0 || j >= s.length) return s
    const a = [...s]; [a[idx], a[j]] = [a[j], a[idx]]; return a
  }))
  const remove = (idx, list = 'main') => touch(() => (list === 'main' ? setSelected : setPrehab)(s => s.filter((_, i) => i !== idx)))
  function stepAmount(idx, it, dir) {
    const step = isTimed(it) ? 5 : 1
    const key = isTimed(it) ? 'duration_seconds' : 'reps'
    patch(idx, { [key]: clamp((Number(it[key]) || 0) + dir * step, 1, 120) })
  }

  function randomize() {
    setFillOpen(false)
    setSnapshot({ selected, prehab })
    const picks = randomPick(allExercises)
    touch(() => setSelected(picks.map(toItem)))
    setToast(`Randomized ${picks.length} exercises.`)
  }
  function onAI({ name: aiName, exercises, prehab: aiPrehab }) {
    setSnapshot({ selected, prehab })
    touch(() => { if (aiName) setName(aiName); setSelected(exercises); setPrehab(aiPrehab); setIsAi(true) })
    setToast('Filled from the AI generator.')
  }
  function undo() {
    touch(() => { setSelected(snapshot.selected); setPrehab(snapshot.prehab) })
    setSnapshot(null); setToast('')
  }

  async function save() {
    if (!ready) return
    setSaving(true); setError('')
    const shape = (list) => list.map((s, i) => ({
      exercise_id: s.exercise.id, position: i, sets: Number(s.sets) || 3,
      reps: s.reps ? Number(s.reps) : null, duration_seconds: s.duration_seconds ? Number(s.duration_seconds) : null,
      rest_seconds: Number(s.rest_seconds) || 30,
    }))
    const { data, error: rpcError } = await supabase.rpc('save_workout', {
      p_workout_id: workoutId, p_name: name.trim(), p_is_ai_generated: isAi, p_exercises: shape(selected), p_prehab: shape(prehab),
    })
    setSaving(false)
    if (rpcError) { setError(rpcError.message || 'Could not save'); return }
    setWorkoutId(data)
    setSaved(true); setDirty(false)
    setToast(`Saved ${name.trim()} · ${selected.length} exercises`)
  }

  const backTo = sourceProgram ? `/plan/programs/${sourceProgram}` : '/plan/workouts'
  const backLabel = sourceProgram ? 'Program' : 'Workouts'
  const status = saved ? 'Saved' : ready ? 'Unsaved' : 'Draft'
  const statusTone = saved ? 'teal' : 'amber'

  // ── pieces ──
  const libraryList = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderBottom: '1px solid var(--br)' }}>
        <div role="group" aria-label="Library" style={{ display: 'flex', gap: 8 }}>
          {[['strength', 'Strength'], ['prehab', 'Prehab']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => { setTab(k); setGroup('All') }}
              style={{ flex: 1, minHeight: 36, borderRadius: 8, border: `1px solid ${tab === k ? 'var(--ac)' : 'var(--br2)'}`, background: tab === k ? 'rgba(199,228,92,.12)' : 'transparent', color: tab === k ? 'var(--ac)' : 'var(--mu2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search exercises" label="Search exercises" />
        <PillRow label="Muscle group">{GROUPS.map(g => <Pill key={g} on={group === g} onClick={() => setGroup(g)}>{g}</Pill>)}</PillRow>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: isMobile ? '48vh' : 'calc(100vh - 360px)' }}>
        {library.length === 0 && <EmptyState>No exercises match.</EmptyState>}
        {library.map(e => {
          const has = tab === 'strength' ? inMain.has(e.id) : inPrehab.has(e.id)
          return (
            <button key={e.id} type="button" onClick={() => addFromLibrary(e)} aria-label={`${has ? 'Already added: ' : 'Add '}${e.name}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 14px', border: 'none', borderTop: '1px solid var(--br)', background: 'transparent', color: has ? 'var(--mu)' : 'var(--tx)', textAlign: 'left', cursor: has ? 'default' : 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}><GroupChip g={e.muscle_group} /><span style={{ fontSize: 12, color: 'var(--mu)' }}>{e.default_sets} × {e.default_reps || (e.default_duration_seconds ? e.default_duration_seconds + 's' : '–')} · rest {e.default_rest_seconds}s</span></span>
              </span>
              <Icon name={has ? 'check' : 'plus'} size={18} style={{ color: has ? 'var(--ac)' : 'var(--mu2)' }} />
            </button>
          )
        })}
      </div>
    </>
  )

  const mainCard = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Main workout</h2><Label>{selected.length} exercises</Label>
      </div>
      {selected.length === 0 && <EmptyState title="Nothing here yet">{isMobile ? 'Add exercises, or use Quick fill.' : 'Pick exercises from the library, or use Quick fill.'}</EmptyState>}
      {selected.map((it, i) => {
        const open = !isMobile || expanded === i
        return (
          <div key={it.exercise.id + i} style={{ borderTop: '1px solid var(--br)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--s2)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--mu2)', flexShrink: 0 }}>{i + 1}</span>
              <button type="button" onClick={() => isMobile && setExpanded(expanded === i ? null : i)} aria-expanded={isMobile ? open : undefined}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: 'var(--tx)', textAlign: 'left', cursor: isMobile ? 'pointer' : 'default', padding: 0, minHeight: isMobile ? 44 : 0 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{it.exercise.name}</span>
                  {isMobile && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>{doseOf(it)}</span>}
                </span>
                <GroupChip g={it.exercise.muscle_group} />
                {isMobile && <Icon name="down" size={16} style={{ color: 'var(--mu)', transform: open ? 'rotate(180deg)' : 'none' }} />}
              </button>
              {!isMobile && (
                <>
                  <button type="button" aria-label={`Move ${it.exercise.name} up`} onClick={() => move(i, -1)} style={iconBtn}><Icon name="down" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
                  <button type="button" aria-label={`Move ${it.exercise.name} down`} onClick={() => move(i, 1)} style={iconBtn}><Icon name="down" size={16} /></button>
                  <button type="button" aria-label={`Remove ${it.exercise.name}`} onClick={() => remove(i)} style={iconBtn}><Icon name="close" size={16} /></button>
                </>
              )}
            </div>
            {open && (
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '0 16px 14px 50px', alignItems: 'flex-end' }}>
                <Stepper label="Sets" value={it.sets} onDown={() => patch(i, { sets: clamp(it.sets - 1, 1, 10) })} onUp={() => patch(i, { sets: clamp(it.sets + 1, 1, 10) })} />
                <Stepper label={isTimed(it) ? 'Seconds' : 'Reps'} unit={isTimed(it) ? 'Secs' : 'Reps'} value={amount(it)} onDown={() => stepAmount(i, it, -1)} onUp={() => stepAmount(i, it, 1)} />
                <Stepper label="Rest seconds" unit="Rest" value={it.rest_seconds} suffix="s" onDown={() => patch(i, { rest_seconds: clamp(it.rest_seconds - 15, 0, 300) })} onUp={() => patch(i, { rest_seconds: clamp(it.rest_seconds + 15, 0, 300) })} />
                {isMobile && (
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <Button onClick={() => move(i, -1)} aria-label="Move up">Up</Button><Button onClick={() => move(i, 1)} aria-label="Move down">Down</Button>
                    <Button variant="danger" onClick={() => remove(i)}>Remove</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {isMobile && (
        <div style={{ padding: 12, borderTop: '1px solid var(--br)' }}>
          <Button icon="plus" onClick={() => { setTab('strength'); setLibOpen(true) }} style={{ width: '100%' }}>Add exercises</Button>
        </div>
      )}
    </Card>
  )

  const prehabCard = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', gap: 10 }}>
        <div><h2 style={{ fontSize: 16, fontWeight: 700 }}>Prehab first</h2><p style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>Athletes do these before the main workout.</p></div>
        {!isMobile && <Label>{prehab.length} added</Label>}
        {isMobile && <Button size="sm" icon="plus" onClick={() => { setTab('prehab'); setLibOpen(true) }}>Add</Button>}
      </div>
      {prehab.map((it, i) => (
        <div key={it.exercise.id + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--br)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{it.exercise.name}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)' }}>{doseOf(it)} · rest {it.rest_seconds}s</span>
          </span>
          <button type="button" aria-label={`Remove ${it.exercise.name}`} onClick={() => remove(i, 'prehab')} style={iconBtn}><Icon name="close" size={16} /></button>
        </div>
      ))}
      {suggest.length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--br)' }}>
          <Label style={{ marginBottom: 8 }}>Suggested for {groups.join(' and ') || 'this workout'}</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {suggest.map(e => (
              <button key={e.id} type="button" onClick={() => touch(() => setPrehab(s => [...s, { ...toItem(e), sets: e.default_sets || 2, rest_seconds: e.default_rest_seconds || 20 }]))}
                style={{ minHeight: isMobile ? 44 : 32, padding: '0 12px', border: '1px solid var(--br2)', borderRadius: 16, background: 'transparent', color: 'var(--tx)', fontSize: 12.5, cursor: 'pointer' }}>+ {e.name}</button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )

  const quickFill = (
    <div style={{ position: 'relative' }}>
      <Button onClick={() => setFillOpen(o => !o)} aria-haspopup="menu" aria-expanded={fillOpen} icon="tools">{isMobile ? '' : 'Quick fill'}</Button>
      {fillOpen && (
        <>
          <div onClick={() => setFillOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" aria-label="Quick fill" style={{ position: 'absolute', right: 0, top: 42, width: 290, zIndex: 41, background: 'var(--s2)', border: '1px solid var(--br2)', borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
            {[['Generate with AI', 'Describe the session, it picks from your library', () => { setFillOpen(false); setShowAI(true) }],
              ['Randomize', '6 exercises, balanced across muscle groups', randomize]].map(([t, sub, fn]) => (
              <button key={t} type="button" role="menuitem" onClick={fn} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--tx)', cursor: 'pointer' }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{t}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--mu2)', marginTop: 2 }}>{sub}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const footerBar = (
    <Card style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{selected.length} exercises · {prehab.length} prehab · about {minutes} min</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>{groups.map(g => <GroupChip key={g} g={g} />)}</div>
      </div>
      <Link to={backTo} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--mu2)', padding: '0 8px' }}>Cancel</Link>
      <Button variant="primary" onClick={save} disabled={!ready || saving}>{saving ? 'Saving…' : 'Save workout'}</Button>
    </Card>
  )

  return (
    <Layout>
      <PlanTabs />
      <div style={{ padding: isMobile ? 'max(14px, calc(var(--sat) + 8px)) 16px 120px' : '24px 36px 36px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {!isMobile && <Link to={backTo} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--mu2)', marginBottom: 4 }}><Icon name="back" size={14} />{backLabel}</Link>}
            <input aria-label="Workout name" placeholder="Name this workout" value={name} onChange={e => touch(() => setName(e.target.value))}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontFamily: 'var(--font-head)', fontSize: isMobile ? 26 : 36, fontWeight: 800, letterSpacing: '-.01em' }} />
          </div>
          <Chip tone={statusTone}>{status}</Chip>
          {quickFill}
          {!isMobile && <Button variant="primary" onClick={save} disabled={!ready || saving}>{saving ? 'Saving…' : 'Save workout'}</Button>}
        </header>

        {isMobile && <div style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{selected.length} exercises · {prehab.length} prehab · about {minutes} min</div>}

        {saved && workoutId && dirty === false && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(79,184,138,.35)', background: 'rgba(79,184,138,.08)', fontSize: 13 }}>
            <span style={{ flex: 1 }}>{sourceProgram ? 'Saved. This workout belongs to its program.' : 'Saved to your workouts. Assign it to athletes from the Workouts list or inside a program.'}</span>
            <Link to={backTo} style={{ color: 'var(--ac)', fontWeight: 600 }}>Back to {sourceProgram ? 'program' : 'Workouts'}</Link>
          </div>
        )}
        {error && <p role="alert" style={{ fontSize: 13, color: '#E2695A' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          {!isMobile && <Card style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'sticky', top: 16 }}>{libraryList}</Card>}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mainCard}
            {prehabCard}
            {!isMobile && footerBar}
          </div>
        </div>
      </div>

      {isMobile && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90, display: 'flex', gap: 10, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', background: 'var(--s1)', borderTop: '1px solid var(--br)' }}>
          <Button onClick={() => navigate(backTo)} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!ready || saving} style={{ flex: 2 }}>{saving ? 'Saving…' : 'Save workout'}</Button>
        </div>
      )}

      {isMobile && libOpen && (
        <Dialog title="Exercise library" onClose={() => setLibOpen(false)} footer={<Button variant="primary" onClick={() => setLibOpen(false)} style={{ width: '100%' }}>Done · {selected.length} in workout</Button>}>
          <div style={{ margin: '0 -16px', display: 'flex', flexDirection: 'column' }}>{libraryList}</div>
        </Dialog>
      )}

      {showAI && <AIGeneratorModal allExercises={allExercises} onClose={() => setShowAI(false)} onResult={onAI} />}
      {toast && <UndoToast message={toast} onUndo={snapshot ? undo : undefined} onClose={() => { setToast(''); setSnapshot(null) }} />}
    </Layout>
  )
}

const iconBtn = { width: 34, height: 34, display: 'grid', placeItems: 'center', border: '1px solid var(--br)', borderRadius: 8, background: 'transparent', color: 'var(--mu2)', cursor: 'pointer' }
