import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const MUSCLE_GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

function GroupBadge({ group }) {
  const c = GROUP_COLORS[group] || { bg: 'var(--br)', color: 'var(--mu)' }
  return <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{group}</span>
}

// Weighted randomizer — respects bias sliders
function weightedRandomize(allExercises, randGroups, randBias, randDiff, randCount) {
  const activeGroups = randGroups.length > 0 ? randGroups : MUSCLE_GROUPS

  // Filter by difficulty
  const pool = allExercises.filter(e => {
    if (!activeGroups.includes(e.muscle_group)) return false
    if (randDiff !== 'All' && e.difficulty !== randDiff) return false
    return true
  })

  // Group pool by muscle group
  const byGroup = {}
  activeGroups.forEach(g => { byGroup[g] = pool.filter(e => e.muscle_group === g) })

  // Calculate total bias
  const totalBias = activeGroups.reduce((sum, g) => sum + (randBias[g] ?? 50), 0)
  if (totalBias === 0) return pool.sort(() => Math.random() - 0.5).slice(0, randCount)

  // Allocate slots per group proportionally
  let allocations = {}
  let allocated = 0
  activeGroups.forEach(g => {
    const bias = randBias[g] ?? 50
    const slots = Math.floor(randCount * (bias / totalBias))
    allocations[g] = slots
    allocated += slots
  })

  // Distribute remaining slots to highest bias groups
  let remaining = randCount - allocated
  const sorted = [...activeGroups].sort((a, b) => (randBias[b] ?? 50) - (randBias[a] ?? 50))
  for (let i = 0; i < remaining; i++) {
    allocations[sorted[i % sorted.length]]++
  }

  // Pick exercises from each group
  const result = []
  activeGroups.forEach(g => {
    const available = byGroup[g] || []
    const slots = Math.min(allocations[g], available.length)
    const shuffled = available.sort(() => Math.random() - 0.5).slice(0, slots)
    result.push(...shuffled)
  })

  // If we didn't get enough (due to small pools), fill from remaining pool
  if (result.length < randCount) {
    const usedIds = new Set(result.map(e => e.id))
    const leftover = pool.filter(e => !usedIds.has(e.id)).sort(() => Math.random() - 0.5)
    result.push(...leftover.slice(0, randCount - result.length))
  }

  return result.sort(() => Math.random() - 0.5).slice(0, randCount)
}

export default function WorkoutBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [mobileTab, setMobileTab] = useState('prehab')
  const [desktopTab, setDesktopTab] = useState('manual')

  const [name, setName] = useState('')
  const [allExercises, setAllExercises] = useState([])
  const [filterGroup, setFilterGroup] = useState('All')
  const [filterDiff, setFilterDiff] = useState('All')
  const [search, setSearch] = useState('')

  // Workout exercises (committed)
  const [selected, setSelected] = useState([])
  // Pending pick selection (not yet committed)
  const [pendingPick, setPendingPick] = useState(new Set())

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Randomizer
  const [randGroups, setRandGroups] = useState([])
  const [randBias, setRandBias] = useState({})   // { Arms: 50, Core: 80, ... }
  const [randDiff, setRandDiff] = useState('All')
  const [randCount, setRandCount] = useState(6)
  const [randResult, setRandResult] = useState([])

  // Prehab
  const [prehab, setPrehab] = useState([])           // committed prehab items
  const [prehabSearch, setPrehabSearch] = useState('')
  const [prehabGroup, setPrehabGroup] = useState('All')
  const [suggestDismissed, setSuggestDismissed] = useState(false)

  useEffect(() => { fetchExercises() }, [])
  useEffect(() => { if (isEdit) fetchWorkout() }, [id])

  async function fetchExercises() {
    const { data } = await supabase.from('exercises').select('*').order('muscle_group').order('name')
    setAllExercises(data || [])
  }

  async function fetchWorkout() {
    const { data } = await supabase
      .from('workouts')
      .select('*, workout_exercises(*, exercises(*)), workout_prehab(*, exercises(*))')
      .eq('id', id).single()
    if (data) {
      setName(data.name)
      const items = (data.workout_exercises || [])
        .sort((a, b) => a.position - b.position)
        .map(we => ({
          exercise: we.exercises,
          sets: we.sets,
          reps: we.reps || '',
          duration_seconds: we.duration_seconds || '',
          rest_seconds: we.rest_seconds,
        }))
      setSelected(items)
      const prehabItems = (data.workout_prehab || [])
        .sort((a, b) => a.position - b.position)
        .map(wp => ({
          exercise: wp.exercises,
          sets: wp.sets,
          reps: wp.reps || '',
          duration_seconds: wp.duration_seconds || '',
          rest_seconds: wp.rest_seconds,
        }))
      setPrehab(prehabItems)
    }
  }

  const committedIds = new Set(selected.map(s => s.exercise.id))
  const prehabCommittedIds = new Set(prehab.map(p => p.exercise.id))

  const filtered = allExercises.filter(e => {
    if ((e.category || 'strength') !== 'strength') return false
    if (filterGroup !== 'All' && e.muscle_group !== filterGroup) return false
    if (filterDiff !== 'All' && e.difficulty !== filterDiff) return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const prehabExercises = allExercises.filter(e => {
    if (e.category !== 'prehab') return false
    if (prehabGroup !== 'All' && e.muscle_group !== prehabGroup) return false
    if (prehabSearch && !e.name.toLowerCase().includes(prehabSearch.toLowerCase())) return false
    return true
  })

  // Auto-suggest: prehab exercises matching muscle groups in selected
  const selectedGroups = [...new Set(selected.map(s => s.exercise?.muscle_group).filter(Boolean))]
  const suggestedPrehab = allExercises.filter(e =>
    e.category === 'prehab' &&
    selectedGroups.includes(e.muscle_group) &&
    !prehabCommittedIds.has(e.id)
  ).slice(0, 6)

  // Toggle pending pick
  function togglePending(ex) {
    if (committedIds.has(ex.id)) return
    setPendingPick(prev => {
      const next = new Set(prev)
      next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id)
      return next
    })
  }

  // Commit pending picks → add to workout
  function commitPending() {
    const toAdd = allExercises
      .filter(e => pendingPick.has(e.id))
      .map(e => ({
        exercise: e,
        sets: e.default_sets,
        reps: e.default_reps || '',
        duration_seconds: e.default_duration_seconds || '',
        rest_seconds: e.default_rest_seconds,
      }))
    setSelected(prev => [...prev, ...toAdd])
    setPendingPick(new Set())
    setMobileTab('build')
  }

  // Desktop: instant add (no pending flow needed — panel is always visible)
  function addExerciseDesktop(ex) {
    if (committedIds.has(ex.id)) return
    setSelected(prev => [...prev, {
      exercise: ex,
      sets: ex.default_sets,
      reps: ex.default_reps || '',
      duration_seconds: ex.default_duration_seconds || '',
      rest_seconds: ex.default_rest_seconds,
    }])
  }

  function removeExercise(idx) {
    setSelected(prev => prev.filter((_, i) => i !== idx))
  }

  function updateField(idx, field, value) {
    setSelected(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function moveUp(idx) {
    if (idx === 0) return
    setSelected(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })
  }

  function moveDown(idx) {
    setSelected(prev => {
      if (idx >= prev.length - 1) return prev
      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a
    })
  }

  // Randomizer
  function toggleRandGroup(g) {
    setRandGroups(prev => {
      if (prev.includes(g)) {
        const next = prev.filter(x => x !== g)
        setRandBias(b => { const nb = { ...b }; delete nb[g]; return nb })
        return next
      } else {
        setRandBias(b => ({ ...b, [g]: 50 }))
        return [...prev, g]
      }
    })
  }

  function randomize() {
    const result = weightedRandomize(allExercises, randGroups, randBias, randDiff, randCount)
    setRandResult(result)
  }

  function useRandomResult() {
    setSelected(randResult.map(ex => ({
      exercise: ex,
      sets: ex.default_sets,
      reps: ex.default_reps || '',
      duration_seconds: ex.default_duration_seconds || '',
      rest_seconds: ex.default_rest_seconds,
    })))
    setRandResult([])
    if (isMobile) setMobileTab('build')
    else setDesktopTab('manual')
  }

  async function save() {
    if (!name.trim()) { setError('Workout name is required'); return }
    if (selected.length === 0) { setError('Add at least one exercise'); return }
    setSaving(true); setError('')
    let workoutId = id
    if (isEdit) {
      await supabase.from('workouts').update({ name }).eq('id', id)
      await supabase.from('workout_exercises').delete().eq('workout_id', id)
      await supabase.from('workout_prehab').delete().eq('workout_id', id)
    } else {
      const { data: w, error: we } = await supabase.from('workouts').insert({ coach_id: user.id, name }).select().single()
      if (we) { setError(we.message); setSaving(false); return }
      workoutId = w.id
    }
    await supabase.from('workout_exercises').insert(
      selected.map((s, i) => ({
        workout_id: workoutId, exercise_id: s.exercise.id, position: i,
        sets: Number(s.sets) || 3,
        reps: s.reps ? Number(s.reps) : null,
        duration_seconds: s.duration_seconds ? Number(s.duration_seconds) : null,
        rest_seconds: Number(s.rest_seconds) || 30,
      }))
    )
    if (prehab.length > 0) {
      await supabase.from('workout_prehab').insert(
        prehab.map((p, i) => ({
          workout_id: workoutId, exercise_id: p.exercise.id, position: i,
          sets: Number(p.sets) || 2,
          reps: p.reps ? Number(p.reps) : null,
          duration_seconds: p.duration_seconds ? Number(p.duration_seconds) : null,
          rest_seconds: Number(p.rest_seconds) || 20,
        }))
      )
    }
    navigate('/dashboard')
  }

  const inp = (val, onChange, w = 44) => ({
    value: val, onChange,
    style: { width: w, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--tx)', fontSize: 12, padding: '4px 6px', textAlign: 'center', fontFamily: 'var(--mono)', outline: 'none' }
  })

  // ── PREHAB HELPERS ───────────────────────────────────────────
  function addPrehab(ex) {
    if (prehabCommittedIds.has(ex.id)) return
    setPrehab(prev => [...prev, { exercise: ex, sets: 2, reps: ex.default_reps || '', duration_seconds: ex.default_duration_seconds || '', rest_seconds: ex.default_rest_seconds || 20 }])
  }

  function removePrehab(idx) {
    setPrehab(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePrehabItem(idx, field, val) {
    setPrehab(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const FOCUS_COLORS = {
    activation: { bg: 'rgba(168,237,82,.12)', color: '#A8ED52' },
    stability:  { bg: 'rgba(80,150,230,.12)', color: '#6BB5F5' },
    mobility:   { bg: 'rgba(160,100,230,.12)', color: '#C084F5' },
    strength:   { bg: 'rgba(240,158,40,.12)',  color: '#F4B455' },
  }

  function FocusBadge({ focus }) {
    if (!focus) return null
    const c = FOCUS_COLORS[focus] || { bg: 'var(--br)', color: 'var(--mu)' }
    return <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{focus}</span>
  }

  function PrehabBuildList() {
    return prehab.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--mu)' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🛡</div>
        <p style={{ fontSize: 14, marginBottom: 4 }}>No prehab exercises yet</p>
        <p style={{ fontSize: 12 }}>Pick from the list{isMobile ? ' above' : ' on the left'} or accept a suggestion</p>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {prehab.map((p, idx) => (
          <div key={p.exercise.id} style={{ background: 'rgba(50,200,140,.05)', border: '1px solid rgba(50,200,140,.2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 3 }}>{p.exercise.name}</div>
                <FocusBadge focus={p.exercise.prehab_focus} />
              </div>
              <button onClick={() => removePrehab(idx)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 16, cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mu)' }}>Sets <input {...inp(p.sets, e => updatePrehabItem(idx, 'sets', e.target.value))} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mu)' }}>Reps <input {...inp(p.reps, e => updatePrehabItem(idx, 'reps', e.target.value))} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mu)' }}>Rest <input {...inp(p.rest_seconds, e => updatePrehabItem(idx, 'rest_seconds', e.target.value), 50)} />s</label>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function PrehabPanel() {
    const showSuggestions = suggestedPrehab.length > 0 && !suggestDismissed && selected.length > 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {showSuggestions && (
          <div style={{ background: 'rgba(50,200,140,.06)', border: '1px solid rgba(50,200,140,.25)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5DD99A' }}>🤖 Suggested prehab</span>
              <button onClick={() => setSuggestDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 12, cursor: 'pointer', padding: 0 }}>Dismiss</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestedPrehab.map(ex => (
                <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                    <FocusBadge focus={ex.prehab_focus} />
                  </div>
                  <button onClick={() => addPrehab(ex)} style={{ background: 'rgba(50,200,140,.15)', border: '1px solid rgba(50,200,140,.3)', borderRadius: 6, color: '#5DD99A', fontSize: 12, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 8 }}>Browse prehab exercises</div>
          <input value={prehabSearch} onChange={e => setPrehabSearch(e.target.value)} placeholder="Search prehab..."
            style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, color: 'var(--tx)', padding: '7px 10px', fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {GROUPS.map(g => (
              <button key={g} onClick={() => setPrehabGroup(g)} style={{
                padding: '3px 8px', borderRadius: 20, fontSize: 11,
                fontWeight: prehabGroup === g ? 600 : 400,
                background: prehabGroup === g ? 'rgba(50,200,140,.15)' : 'var(--br)',
                color: prehabGroup === g ? '#5DD99A' : 'var(--mu)',
                border: prehabGroup === g ? '1px solid rgba(50,200,140,.3)' : '1px solid transparent',
                cursor: 'pointer',
              }}>{g}</button>
            ))}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prehabExercises.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--mu)', padding: 12, textAlign: 'center' }}>No exercises found</div>
              : prehabExercises.map(ex => {
                  const committed = prehabCommittedIds.has(ex.id)
                  return (
                    <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 8px', borderRadius: 7, opacity: committed ? 0.4 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                        <FocusBadge focus={ex.prehab_focus} />
                      </div>
                      <button onClick={() => addPrehab(ex)} disabled={committed} style={{
                        width: 24, height: 24, flexShrink: 0,
                        background: committed ? 'transparent' : 'var(--br)',
                        border: committed ? '1px solid var(--br)' : 'none',
                        borderRadius: 6, color: committed ? 'var(--mu)' : 'var(--tx)',
                        fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: committed ? 'default' : 'pointer',
                      }}>{committed ? '✓' : '+'}</button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 8 }}>
            Added prehab ({prehab.length})
          </div>
          <PrehabBuildList />
        </div>
      </div>
    )
  }

  // ── SHARED: BUILD LIST ───────────────────────────────────────
  function BuildList() {
    return selected.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--mu)' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>👈</div>
        <p style={{ fontSize: 14 }}>{isMobile ? 'Go to Pick tab to add exercises' : 'Pick exercises from the panel on the left'}</p>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selected.map((item, i) => (
          <div key={item.exercise.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10, padding: isMobile ? 12 : '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{item.exercise.name}</span>
                <GroupBadge group={item.exercise.muscle_group} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => moveUp(i)} style={{ background: 'var(--br)', border: 'none', borderRadius: 5, color: 'var(--mu)', fontSize: 11, padding: '3px 7px', cursor: 'pointer' }}>↑</button>
                <button onClick={() => moveDown(i)} style={{ background: 'var(--br)', border: 'none', borderRadius: 5, color: 'var(--mu)', fontSize: 11, padding: '3px 7px', cursor: 'pointer' }}>↓</button>
                <button onClick={() => removeExercise(i)} style={{ background: 'transparent', border: 'none', color: '#F88080', fontSize: 15, cursor: 'pointer', padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>Sets</span>
                <input {...inp(item.sets, e => updateField(i, 'sets', e.target.value), 40)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>{item.exercise.default_reps !== null ? 'Reps' : 'Secs'}</span>
                <input {...inp(item.reps || item.duration_seconds, e => {
                  if (item.exercise.default_reps !== null) updateField(i, 'reps', e.target.value)
                  else updateField(i, 'duration_seconds', e.target.value)
                }, 46)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>Rest(s)</span>
                <input {...inp(item.rest_seconds, e => updateField(i, 'rest_seconds', e.target.value), 46)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── SHARED: RANDOMIZER PANEL ─────────────────────────────────
  function RandomizerPanel() {
    return (
      <div style={{ maxWidth: isMobile ? '100%' : 500 }}>
        {/* Muscle groups + bias sliders */}
        <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            Muscle groups &amp; bias
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12, lineHeight: 1.5 }}>
            Select groups then drag sliders to weight the mix
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MUSCLE_GROUPS.map(g => {
              const on = randGroups.includes(g)
              const c = GROUP_COLORS[g]
              const bias = randBias[g] ?? 50
              return (
                <div key={g}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: on ? 8 : 0 }}>
                    <button onClick={() => toggleRandGroup(g)} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                      background: on ? c.bg : 'var(--br)', color: on ? c.color : 'var(--mu)',
                      outline: on ? `1px solid ${c.color}` : 'none', minWidth: 90, textAlign: 'left',
                    }}>{g}</button>
                    {on && <span style={{ fontSize: 11, color: c.color, fontWeight: 600, minWidth: 32 }}>{bias}%</span>}
                  </div>
                  {on && (
                    <div style={{ paddingLeft: 4 }}>
                      <input
                        type="range" min={0} max={100} value={bias}
                        onChange={e => setRandBias(prev => ({ ...prev, [g]: Number(e.target.value) }))}
                        style={{
                          width: '100%', height: 4, borderRadius: 2, outline: 'none', cursor: 'pointer',
                          accentColor: c.color, background: `linear-gradient(to right, ${c.color} ${bias}%, var(--br) ${bias}%)`,
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>
                        <span>Low</span><span>Equal</span><span>High</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {randGroups.length > 1 && (
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {randGroups.map(g => {
                const c = GROUP_COLORS[g]
                const bias = randBias[g] ?? 50
                const total = randGroups.reduce((s, x) => s + (randBias[x] ?? 50), 0)
                const pct = total > 0 ? Math.round((bias / total) * 100) : 0
                return <span key={g} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color }}>{g} ~{pct}%</span>
              })}
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Difficulty</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['Easy', 'Medium', 'Hard', 'All'].map(d => (
              <button key={d} onClick={() => setRandDiff(d)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: randDiff === d ? 'var(--ac)' : 'var(--br)', color: randDiff === d ? '#0C1118' : 'var(--mu)',
              }}>{d}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Exercise count</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
            <button onClick={() => setRandCount(c => Math.max(1, c - 1))} style={{ width: 38, height: 38, background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', fontSize: 20, cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: 26, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{randCount}</span>
            <button onClick={() => setRandCount(c => Math.min(20, c + 1))} style={{ width: 38, height: 38, background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', fontSize: 20, cursor: 'pointer' }}>+</button>
          </div>
        </div>

        <button onClick={randomize} style={{ width: '100%', padding: 14, background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, color: 'var(--tx)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          🎲 Generate workout
        </button>

        {randResult.length > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid rgba(168,237,82,.25)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{randResult.length} exercises generated</div>
              <button onClick={useRandomResult} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Use this →
              </button>
            </div>
            {randResult.map((ex, i) => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--br)', borderRadius: 8, marginBottom: 5 }}>
                <span style={{ width: 22, height: 22, background: 'rgba(80,200,140,.15)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#5DD99A', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{ex.name}</span>
                <GroupBadge group={ex.muscle_group} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── MOBILE LAYOUT ────────────────────────────────────────────
  if (isMobile) {
    return (
      <Layout>
        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--s1)', borderBottom: '1px solid var(--br)' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Workout name..."
              style={{ flex: 1, background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 12px', fontSize: 14, fontWeight: 600, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--br)' }}>
            {[
              { key: 'prehab', label: '🛡 Prehab', badge: prehab.length || null },
              { key: 'pick',   label: '📚 Pick',   badge: pendingPick.size > 0 ? pendingPick.size : null },
              { key: 'build',  label: '✏️ Build',  badge: selected.length || null },
              { key: 'random', label: '🎲 Random', badge: null },
            ].map(t => (
              <button key={t.key} onClick={() => setMobileTab(t.key)} style={{
                flex: 1, padding: '10px 4px', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: mobileTab === t.key ? 'var(--br)' : 'transparent',
                color: mobileTab === t.key ? 'var(--tx)' : 'var(--mu)',
                borderBottom: mobileTab === t.key ? '2px solid var(--ac)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                {t.label}
                {t.badge ? (
                  <span style={{ width: 18, height: 18, background: 'var(--ac)', color: '#0C1118', borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: '12px 16px', paddingBottom: pendingPick.size > 0 ? 100 : 16 }}>

          {/* PREHAB TAB */}
          {mobileTab === 'prehab' && <PrehabPanel />}

          {/* PICK TAB */}
          {mobileTab === 'pick' && (
            <>
              {/* Search */}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..."
                style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 11px', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />

              {/* Group filter pills */}
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 10, marginBottom: 6 }}>
                {GROUPS.map(g => (
                  <button key={g} onClick={() => setFilterGroup(g)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 600 : 400, whiteSpace: 'nowrap',
                    background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer',
                  }}>{g}</button>
                ))}
              </div>

              {/* Difficulty filter */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                  <button key={d} onClick={() => setFilterDiff(d)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: filterDiff === d ? 600 : 400,
                    background: filterDiff === d ? 'var(--br2)' : 'var(--br)', color: filterDiff === d ? 'var(--tx)' : 'var(--mu)', border: 'none', cursor: 'pointer',
                  }}>{d}</button>
                ))}
              </div>

              {/* Selection hint */}
              {pendingPick.size === 0 && selected.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>
                  Tap exercises to select, then hit Add to add them all at once
                </div>
              )}

              {/* Exercise list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(ex => {
                  const committed = committedIds.has(ex.id)
                  const pending = pendingPick.has(ex.id)
                  return (
                    <div key={ex.id} onClick={() => togglePending(ex)}
                      style={{
                        padding: '11px 12px',
                        background: committed ? 'rgba(168,237,82,.04)' : pending ? 'rgba(168,237,82,.08)' : 'var(--s2)',
                        border: `1px solid ${committed ? 'rgba(168,237,82,.15)' : pending ? 'rgba(168,237,82,.4)' : 'var(--br)'}`,
                        borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                        cursor: committed ? 'default' : 'pointer',
                        transition: 'all .1s',
                      }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: committed ? 'var(--mu)' : 'var(--tx)', marginBottom: 3 }}>{ex.name}</div>
                        <GroupBadge group={ex.muscle_group} />
                      </div>
                      <div style={{
                        width: 28, height: 28, flexShrink: 0, borderRadius: 8,
                        background: committed ? 'rgba(168,237,82,.1)' : pending ? 'var(--ac)' : 'var(--br)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: pending ? 16 : 14,
                        color: committed ? 'var(--ac)' : pending ? '#0C1118' : 'var(--mu)',
                        transition: 'all .1s',
                      }}>
                        {committed ? '✓' : pending ? '✓' : '+'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* BUILD TAB */}
          {mobileTab === 'build' && (
            <>
              <BuildList />
              {error && <p style={{ fontSize: 12, color: '#F88080', marginTop: 12, textAlign: 'center' }}>{error}</p>}
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button onClick={() => navigate('/dashboard')} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 10, color: 'var(--mu)', padding: 12, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : isEdit ? 'Update' : 'Save workout'}
                </button>
              </div>
            </>
          )}

          {/* RANDOM TAB */}
          {mobileTab === 'random' && <RandomizerPanel />}
        </div>

        {/* Floating commit bar — appears when exercises are pending */}
        {pendingPick.size > 0 && mobileTab === 'pick' && (
          <div style={{
            position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom) + 10px)',
            left: 16, right: 16, zIndex: 50,
            display: 'flex', gap: 8,
          }}>
            <button onClick={() => setPendingPick(new Set())} style={{
              background: 'var(--br)', border: '1px solid var(--br2)', borderRadius: 12,
              color: 'var(--mu)', padding: '13px 16px', fontSize: 13, cursor: 'pointer',
            }}>✕</button>
            <button onClick={commitPending} style={{
              flex: 1, background: 'var(--ac)', color: '#0C1118', border: 'none',
              borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(168,237,82,.3)',
            }}>
              Add {pendingPick.size} exercise{pendingPick.size !== 1 ? 's' : ''} to workout →
            </button>
          </div>
        )}
      </Layout>
    )
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────
  return (
    <Layout>
      <div style={{ display: 'flex', height: '100%' }}>

        {/* Left panel — exercise picker */}
        <div style={{ width: 240, minWidth: 240, borderRight: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 10px', borderBottom: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..."
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, color: 'var(--tx)', padding: '7px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {GROUPS.map(g => (
                <button key={g} onClick={() => setFilterGroup(g)} style={{
                  padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 600 : 400,
                  background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer'
                }}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {filtered.map(ex => {
              const committed = committedIds.has(ex.id)
              return (
                <div key={ex.id} style={{ padding: '7px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3, opacity: committed ? 0.4 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                    <GroupBadge group={ex.muscle_group} />
                  </div>
                  <button onClick={() => addExerciseDesktop(ex)} disabled={committed} style={{
                    width: 22, height: 22, flexShrink: 0, background: committed ? 'transparent' : 'var(--br)',
                    border: committed ? '1px solid var(--br)' : 'none', borderRadius: 6, color: 'var(--mu)', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: committed ? 'default' : 'pointer'
                  }}>
                    {committed ? '✓' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel — build / randomizer / prehab */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { key: 'prehab',     label: '🛡 Prehab',     badge: prehab.length || null },
              { key: 'manual',     label: '✏️ Manual build', badge: null },
              { key: 'randomizer', label: '🎲 Randomizer',  badge: null },
            ].map(t => (
              <button key={t.key} onClick={() => setDesktopTab(t.key)} style={{
                padding: '6px 14px', borderRadius: 'var(--r)', border: 'none', fontSize: 13, fontWeight: 500,
                background: desktopTab === t.key ? 'var(--br)' : 'transparent',
                color: desktopTab === t.key ? 'var(--tx)' : 'var(--mu)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {t.label}
                {t.badge ? <span style={{ width: 18, height: 18, background: 'var(--ac)', color: '#0C1118', borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {desktopTab === 'prehab' ? (
              <PrehabPanel />
            ) : desktopTab === 'manual' ? (
              <>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Workout name..."
                  style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 14px', fontSize: 16, fontWeight: 600, outline: 'none', marginBottom: 16 }} />
                <BuildList />
              </>
            ) : <RandomizerPanel />}
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12, color: '#F88080' }}>{error}</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 'var(--r)', color: 'var(--mu)', padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '9px 20px', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>
              {saving ? 'Saving...' : isEdit ? 'Update workout' : 'Save workout'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
