import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']

const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}
const DIFF_COLORS = {
  Easy: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Medium: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Hard: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
}

function Badge({ label, colors }) {
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, ...colors }}>{label}</span>
}

function formatDefault(ex) {
  const sets = `${ex.default_sets} sets`
  const reps = ex.default_reps ? `× ${ex.default_reps} reps` : ex.default_duration_seconds ? `× ${ex.default_duration_seconds}s` : ''
  const rest = `· Rest ${ex.default_rest_seconds}s`
  return [sets, reps, rest].filter(Boolean).join(' ')
}

export default function Library() {
  const [exercises, setExercises] = useState([])
  const [group, setGroup] = useState('All')
  const [diff, setDiff] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchExercises() }, [])

  async function fetchExercises() {
    const { data } = await supabase.from('exercises').select('*').order('muscle_group').order('name')
    setExercises(data || [])
    setLoading(false)
  }

  const filtered = exercises.filter(e => {
    if (group !== 'All' && e.muscle_group !== group) return false
    if (diff !== 'All' && e.difficulty !== diff) return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pill = (active, onClick, label) => (
    <button key={label} onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
      background: active ? 'var(--ac)' : 'var(--br)', color: active ? '#0C1118' : 'var(--mu)',
      border: 'none', cursor: 'pointer', transition: 'all .15s'
    }}>{label}</button>
  )

  return (
    <Layout>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Exercise library</h1>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>{filtered.length} of {exercises.length} exercises</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..."
            style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '9px 12px', fontSize: 13, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GROUPS.map(g => pill(group === g, () => setGroup(g), g))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIFFICULTIES.map(d => pill(diff === d, () => setDiff(d), d))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {filtered.map(ex => (
              <div key={ex.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Badge label={ex.muscle_group} colors={{ background: GROUP_COLORS[ex.muscle_group]?.bg, color: GROUP_COLORS[ex.muscle_group]?.color }} />
                  <Badge label={ex.difficulty} colors={{ background: DIFF_COLORS[ex.difficulty]?.bg, color: DIFF_COLORS[ex.difficulty]?.color }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{ex.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>{ex.description}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>{formatDefault(ex)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
