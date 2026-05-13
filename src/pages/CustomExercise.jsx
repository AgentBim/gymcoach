import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const MUSCLE_GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const CATEGORIES = [
  { value: 'strength', label: '💪 Strength' },
  { value: 'prehab',   label: '🛡 Prehab' },
  { value: 'mobility', label: '🧘 Mobility' },
]
const PREHAB_FOCUSES = [
  { value: 'activation', label: 'Activation' },
  { value: 'stability',  label: 'Stability' },
  { value: 'mobility',   label: 'Mobility' },
  { value: 'strength',   label: 'Strength' },
]

export default function CustomExercise() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState('')
  const [duration, setDuration] = useState('')
  const [rest, setRest] = useState(30)
  const [useTime, setUseTime] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('strength')
  const [prehabFocus, setPrehabFocus] = useState('')

  useEffect(() => { if (isEdit) fetchExercise() }, [id])

  async function fetchExercise() {
    const { data } = await supabase.from('exercises').select('*').eq('id', id).single()
    if (data) {
      setName(data.name)
      setDescription(data.description)
      setMuscleGroup(data.muscle_group)
      setDifficulty(data.difficulty)
      setSets(data.default_sets)
      setReps(data.default_reps || '')
      setDuration(data.default_duration_seconds || '')
      setRest(data.default_rest_seconds)
      setUseTime(!!data.default_duration_seconds)
      setCategory(data.category || 'strength')
      setPrehabFocus(data.prehab_focus || '')
    }
  }

  async function save() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!muscleGroup) { setError('Muscle group is required'); return }
    if (!difficulty) { setError('Difficulty is required'); return }
    setSaving(true); setError('')

    const payload = {
      name: name.trim(),
      description: description.trim(),
      muscle_group: muscleGroup,
      difficulty,
      default_sets: Number(sets) || 3,
      default_reps: useTime ? null : (Number(reps) || null),
      default_duration_seconds: useTime ? (Number(duration) || null) : null,
      default_rest_seconds: Number(rest) || 30,
      coach_id: user.id,
      is_custom: true,
      category,
      prehab_focus: category === 'prehab' ? (prehabFocus || null) : null,
    }

    if (isEdit) {
      await supabase.from('exercises').update(payload).eq('id', id)
    } else {
      await supabase.from('exercises').insert(payload)
    }
    navigate('/library')
  }

  const inp = { background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }

  return (
    <Layout>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/library')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{isEdit ? 'Edit exercise' : 'Create custom exercise'}</h1>
            <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>Visible only to your account · marked ★ in the library</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Exercise name *</div>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Cast to Handstand" />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the movement, cues, and what to focus on..."
              style={{ ...inp, height: 80, resize: 'none', lineHeight: 1.5 }} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>Muscle group *</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MUSCLE_GROUPS.map(g => (
                <button key={g} onClick={() => setMuscleGroup(g)} style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
                  background: muscleGroup === g ? 'rgba(168,237,82,.12)' : 'var(--br)',
                  color: muscleGroup === g ? 'var(--ac)' : 'var(--mu)',
                  outline: muscleGroup === g ? '1px solid rgba(168,237,82,.3)' : 'none',
                  fontWeight: muscleGroup === g ? 600 : 400,
                }}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>Difficulty *</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 13, border: 'none', cursor: 'pointer',
                  background: difficulty === d ? 'rgba(168,237,82,.12)' : 'var(--br)',
                  color: difficulty === d ? 'var(--ac)' : 'var(--mu)',
                  outline: difficulty === d ? '1px solid rgba(168,237,82,.3)' : 'none',
                  fontWeight: difficulty === d ? 600 : 400,
                }}>{d}</button>
              ))}
            </div>
          </div>

          {/* Reps vs time toggle */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>Measured by</div>
            <div style={{ display: 'flex', background: 'var(--br)', borderRadius: 8, padding: 3, marginBottom: 10 }}>
              <button onClick={() => setUseTime(false)} style={{ flex: 1, padding: '10px 7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: !useTime ? 'var(--s2)' : 'transparent', color: !useTime ? 'var(--tx)' : 'var(--mu)', minHeight: 40 }}>Reps</button>
              <button onClick={() => setUseTime(true)} style={{ flex: 1, padding: '10px 7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: useTime ? 'var(--s2)' : 'transparent', color: useTime ? 'var(--tx)' : 'var(--mu)', minHeight: 40 }}>Time (s)</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Sets</div>
              <input style={{ ...inp, textAlign: 'center' }} type="number" min="1" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>{useTime ? 'Duration (s)' : 'Reps'}</div>
              <input style={{ ...inp, textAlign: 'center' }} type="number" min="1"
                value={useTime ? duration : reps}
                onChange={e => useTime ? setDuration(e.target.value) : setReps(e.target.value)}
                placeholder={useTime ? '30' : '10'} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Rest (s)</div>
              <input style={{ ...inp, textAlign: 'center' }} type="number" min="0" value={rest} onChange={e => setRest(e.target.value)} />
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: '#F88080' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => navigate('/library')} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 10, color: 'var(--mu)', padding: 12, fontSize: 13, cursor: 'pointer', minHeight: 48 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minHeight: 48 }}>
              {saving ? 'Saving...' : isEdit ? 'Update exercise' : 'Add to library'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
