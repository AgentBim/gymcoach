import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

function GroupBadge({ group }) {
  const c = GROUP_COLORS[group] || { bg: 'var(--br)', color: 'var(--mu)' }
  return <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{group}</span>
}

export default function WorkoutBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('manual')
  const [name, setName] = useState('')
  const [allExercises, setAllExercises] = useState([])
  const [filterGroup, setFilterGroup] = useState('All')
  const [selected, setSelected] = useState([]) // { exercise, sets, reps, duration_seconds, rest_seconds }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Randomizer state
  const [randGroups, setRandGroups] = useState([])
  const [randDiff, setRandDiff] = useState('Medium')
  const [randCount, setRandCount] = useState(6)
  const [randResult, setRandResult] = useState([])

  useEffect(() => { fetchExercises() }, [])
  useEffect(() => { if (isEdit) fetchWorkout() }, [id])

  async function fetchExercises() {
    const { data } = await supabase.from('exercises').select('*').order('muscle_group').order('name')
    setAllExercises(data || [])
  }

  async function fetchWorkout() {
    const { data } = await supabase
      .from('workouts')
      .select('*, workout_exercises(*, exercises(*))')
      .eq('id', id)
      .single()
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
    }
  }

  const filtered = allExercises.filter(e => filterGroup === 'All' || e.muscle_group === filterGroup)

  function addExercise(ex) {
    if (selected.find(s => s.exercise.id === ex.id)) return
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
    setSelected(prev => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a })
  }

  function moveDown(idx) {
    setSelected(prev => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a })
  }

  function randomize() {
    let pool = allExercises.filter(e => {
      if (randGroups.length > 0 && !randGroups.includes(e.muscle_group)) return false
      if (randDiff !== 'All' && e.difficulty !== randDiff) return false
      return true
    })
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, randCount)
    setRandResult(shuffled)
  }

  function useRandomResult() {
    const items = randResult.map(ex => ({
      exercise: ex,
      sets: ex.default_sets,
      reps: ex.default_reps || '',
      duration_seconds: ex.default_duration_seconds || '',
      rest_seconds: ex.default_rest_seconds,
    }))
    setSelected(items)
    setTab('manual')
  }

  async function save() {
    if (!name.trim()) { setError('Workout name is required'); return }
    if (selected.length === 0) { setError('Add at least one exercise'); return }
    setSaving(true)
    setError('')

    let workoutId = id

    if (isEdit) {
      await supabase.from('workouts').update({ name }).eq('id', id)
      await supabase.from('workout_exercises').delete().eq('workout_id', id)
    } else {
      const { data: w, error: we } = await supabase
        .from('workouts').insert({ coach_id: user.id, name }).select().single()
      if (we) { setError(we.message); setSaving(false); return }
      workoutId = w.id
    }

    const rows = selected.map((s, i) => ({
      workout_id: workoutId,
      exercise_id: s.exercise.id,
      position: i,
      sets: Number(s.sets) || 3,
      reps: s.reps ? Number(s.reps) : null,
      duration_seconds: s.duration_seconds ? Number(s.duration_seconds) : null,
      rest_seconds: Number(s.rest_seconds) || 30,
    }))

    await supabase.from('workout_exercises').insert(rows)
    navigate('/dashboard')
  }

  const inp = (val, onChange, w = 44) => ({
    value: val, onChange,
    style: { width: w, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--tx)', fontSize: 12, padding: '4px 6px', textAlign: 'center', fontFamily: 'var(--mono)', outline: 'none' }
  })

  return (
    <Layout>
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Left panel: exercise picker */}
        <div style={{ width: 220, minWidth: 220, borderRight: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--br)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Add exercises</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {GROUPS.map(g => (
                <button key={g} onClick={() => setFilterGroup(g)} style={{
                  padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 600 : 400,
                  background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer'
                }}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {filtered.map(ex => {
              const already = selected.some(s => s.exercise.id === ex.id)
              return (
                <div key={ex.id} style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3, opacity: already ? 0.4 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                    <GroupBadge group={ex.muscle_group} />
                  </div>
                  <button onClick={() => addExercise(ex)} disabled={already}
                    style={{ width: 22, height: 22, flexShrink: 0, background: already ? 'transparent' : 'var(--br)', border: already ? '1px solid var(--br)' : 'none', borderRadius: 6, color: 'var(--mu)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: already ? 'default' : 'pointer' }}>
                    {already ? '✓' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel: builder */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {['manual', 'randomizer'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 14px', borderRadius: 'var(--r)', border: 'none', fontSize: 13, fontWeight: 500,
                background: tab === t ? 'var(--br)' : 'transparent', color: tab === t ? 'var(--tx)' : 'var(--mu)', cursor: 'pointer'
              }}>{t === 'manual' ? '✏️ Manual build' : '🎲 Randomizer'}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {tab === 'manual' ? (
              <>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Workout name..."
                  style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 14px', fontSize: 16, fontWeight: 600, outline: 'none', marginBottom: 16 }} />

                {selected.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--mu)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>👈</div>
                    <p style={{ fontSize: 14 }}>Pick exercises from the panel on the left</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.map((item, i) => (
                      <div key={item.exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => moveUp(i)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 10, cursor: 'pointer', lineHeight: 1 }}>▲</button>
                          <button onClick={() => moveDown(i)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 10, cursor: 'pointer', lineHeight: 1 }}>▼</button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.exercise.name}</span>
                            <GroupBadge group={item.exercise.muscle_group} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <input {...inp(item.sets, e => updateField(i, 'sets', e.target.value), 38)} />
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>sets ×</span>
                            <input {...inp(item.reps || item.duration_seconds, e => {
                              if (item.exercise.default_reps !== null) updateField(i, 'reps', e.target.value)
                              else updateField(i, 'duration_seconds', e.target.value)
                            }, 46)} />
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{item.exercise.default_reps !== null ? 'reps' : 'sec'}</span>
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>rest</span>
                            <input {...inp(item.rest_seconds, e => updateField(i, 'rest_seconds', e.target.value), 46)} />
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>s</span>
                          </div>
                        </div>
                        <button onClick={() => removeExercise(i)}
                          style={{ background: 'none', border: 'none', color: '#F88080', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Randomizer */
              <div style={{ maxWidth: 500 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 18 }}>Auto-generate a workout</h2>
                <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Muscle groups</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Arms', 'Back', 'Legs', 'Core', 'Shoulders'].map(g => {
                      const on = randGroups.includes(g)
                      return (
                        <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <div onClick={() => setRandGroups(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                            style={{ width: 18, height: 18, background: on ? 'rgba(80,200,140,.2)' : 'var(--br)', border: on ? '1.5px solid rgba(80,200,140,.5)' : '1px solid rgba(255,255,255,.1)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#5DD99A', flexShrink: 0 }}>
                            {on ? '✓' : ''}
                          </div>
                          <GroupBadge group={g} />
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Difficulty</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                    {['Easy', 'Medium', 'Hard', 'All'].map(d => (
                      <button key={d} onClick={() => setRandDiff(d)} style={{
                        flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                        background: randDiff === d ? 'var(--ac)' : 'var(--br)', color: randDiff === d ? '#0C1118' : 'var(--mu)'
                      }}>{d}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Exercise count</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => setRandCount(c => Math.max(1, c - 1))} style={{ width: 32, height: 32, background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', fontSize: 18, cursor: 'pointer' }}>−</button>
                    <span style={{ fontSize: 24, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{randCount}</span>
                    <button onClick={() => setRandCount(c => Math.min(20, c + 1))} style={{ width: 32, height: 32, background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--tx)', fontSize: 18, cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                <button onClick={randomize} style={{ width: '100%', padding: 12, background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
                  🎲 Generate
                </button>

                {randResult.length > 0 && (
                  <div style={{ background: 'var(--s2)', border: '1px solid rgba(168,237,82,.25)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Generated — {randResult.length} exercises</div>
                      <button onClick={useRandomResult} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Use this →
                      </button>
                    </div>
                    {randResult.map((ex, i) => (
                      <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--br)', borderRadius: 8, marginBottom: 5 }}>
                        <span style={{ width: 22, height: 22, background: 'rgba(80,200,140,.15)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#5DD99A', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13 }}>{ex.name}</span>
                        <GroupBadge group={ex.muscle_group} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save bar */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12, color: '#F88080', flex: 1 }}>{error}</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => navigate('/dashboard')}
              style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 'var(--r)', color: 'var(--mu)', padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '9px 20px', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>
              {saving ? 'Saving...' : isEdit ? 'Update workout' : 'Save workout'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
