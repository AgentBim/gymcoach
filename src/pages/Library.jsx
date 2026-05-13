import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const GROUPS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']
const CATEGORIES = ['strength', 'prehab', 'mobility']
const CAT_LABELS = { strength: '💪 Strength', prehab: '🛡 Prehab', mobility: '🧘 Mobility' }

const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}
const DIFF_COLORS = {
  Easy:   { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Medium: { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Hard:   { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
}
const FOCUS_COLORS = {
  activation: { bg: 'rgba(168,237,82,.12)',  color: '#A8ED52' },
  stability:  { bg: 'rgba(80,150,230,.12)',  color: '#6BB5F5' },
  mobility:   { bg: 'rgba(160,100,230,.12)', color: '#C084F5' },
  strength:   { bg: 'rgba(240,158,40,.12)',  color: '#F4B455' },
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
  const [catTab, setCatTab] = useState('strength')
  const [group, setGroup] = useState('All')
  const [diff, setDiff] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => { fetchExercises() }, [])

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .or(user ? `coach_id.is.null,coach_id.eq.${user.id}` : 'coach_id.is.null')
      .order('is_custom').order('muscle_group').order('name')
    setExercises(data || [])
    setLoading(false)
  }

  const filtered = exercises.filter(e => {
    const cat = e.category || 'strength'
    if (cat !== catTab) return false
    if (group !== 'All' && e.muscle_group !== group) return false
    if (diff !== 'All' && e.difficulty !== diff) return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pill = (active, onClick, label) => (
    <button key={label} onClick={onClick} style={{
      padding: isMobile ? '5px 10px' : '5px 12px',
      borderRadius: 20, fontSize: isMobile ? 11 : 12,
      fontWeight: active ? 600 : 400,
      background: active ? 'var(--ac)' : 'var(--br)',
      color: active ? '#0C1118' : 'var(--mu)',
      border: 'none', cursor: 'pointer', transition: 'all .15s',
      whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  const prehabPill = (active, onClick, label) => (
    <button key={label} onClick={onClick} style={{
      padding: isMobile ? '5px 10px' : '5px 12px',
      borderRadius: 20, fontSize: isMobile ? 11 : 12,
      fontWeight: active ? 600 : 400,
      background: active ? 'rgba(168,237,82,.2)' : 'var(--br)',
      color: active ? '#A8ED52' : 'var(--mu)',
      border: active ? '1px solid rgba(168,237,82,.4)' : '1px solid transparent',
      cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  )

  const catPillFn = catTab === 'prehab' ? prehabPill : pill

  // Category tabs
  const CatTabs = () => (
    <div style={{ display: 'flex', gap: 0, background: 'var(--br)', borderRadius: 10, padding: 3, marginBottom: isMobile ? 10 : 14 }}>
      {CATEGORIES.map(c => (
        <button key={c} onClick={() => { setCatTab(c); setGroup('All'); setDiff('All') }} style={{
          flex: 1, padding: isMobile ? '7px 6px' : '7px 10px',
          borderRadius: 8, fontSize: isMobile ? 11 : 12, fontWeight: catTab === c ? 700 : 400,
          background: catTab === c
            ? c === 'prehab' ? 'rgba(168,237,82,.18)' : 'var(--s2)'
            : 'transparent',
          color: catTab === c
            ? c === 'prehab' ? '#A8ED52' : 'var(--tx)'
            : 'var(--mu)',
          border: catTab === c && c === 'prehab' ? '1px solid rgba(168,237,82,.35)' : '1px solid transparent',
          cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
        }}>{CAT_LABELS[c]}</button>
      ))}
    </div>
  )

  return (
    <Layout>
      {isMobile && (
        <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10, paddingTop: 'var(--sat)' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', flex: 1 }}>Exercise Library</span>
            <span style={{ fontSize: 12, color: 'var(--mu)' }}>{filtered.length}</span>
            <button onClick={() => navigate('/library/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32, whiteSpace: 'nowrap' }}>+ Custom</button>
          </div>
          <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..."
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '9px 12px', fontSize: 13, outline: 'none' }} />
            <CatTabs />
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
              {GROUPS.map(g => catPillFn(group === g, () => setGroup(g), g))}
            </div>
            {catTab !== 'prehab' && (
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {DIFFICULTIES.map(d => pill(diff === d, () => setDiff(d), d))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? '12px 16px' : '20px 24px' }}>
        {!isMobile && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Exercise library</h1>
                <p style={{ fontSize: 13, color: 'var(--mu)' }}>{filtered.length} of {exercises.length} exercises</p>
              </div>
              <button onClick={() => navigate('/library/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Custom exercise</button>
            </div>
          </div>
        )}

        {!isMobile && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..."
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '9px 12px', fontSize: 13, outline: 'none' }} />
            <CatTabs />
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
              {GROUPS.map(g => catPillFn(group === g, () => setGroup(g), g))}
            </div>
            {catTab !== 'prehab' && (
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {DIFFICULTIES.map(d => pill(diff === d, () => setDiff(d), d))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center', fontSize: 14 }}>No exercises found</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: isMobile ? 8 : 12 }}>
            {filtered.map(ex => (
              <div key={ex.id} style={{
                background: ex.category === 'prehab' ? 'rgba(50,200,140,.04)' : 'var(--s2)',
                border: ex.category === 'prehab' ? '1px solid rgba(50,200,140,.18)' : '1px solid var(--br)',
                borderRadius: 12, padding: isMobile ? 12 : 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, flexWrap: 'wrap', gap: 4 }}>
                  <Badge label={ex.muscle_group} colors={{ background: GROUP_COLORS[ex.muscle_group]?.bg, color: GROUP_COLORS[ex.muscle_group]?.color }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {ex.prehab_focus && <Badge label={ex.prehab_focus} colors={{ background: FOCUS_COLORS[ex.prehab_focus]?.bg, color: FOCUS_COLORS[ex.prehab_focus]?.color }} />}
                    {ex.category !== 'prehab' && <Badge label={ex.difficulty} colors={{ background: DIFF_COLORS[ex.difficulty]?.bg, color: DIFF_COLORS[ex.difficulty]?.color }} />}
                  </div>
                </div>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 8 }}>{ex.description}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>{formatDefault(ex)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
