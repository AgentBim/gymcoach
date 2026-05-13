import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const LEVEL_COLORS = {
  'Level 1': { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  'Level 2': { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  'Level 3': { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  'Level 4': { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  'Level 5': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Level 6': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Level 7': { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  'Level 8': { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  'Level 9': { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
  'Level 10': { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
  'Elite': { bg: 'rgba(168,237,82,.12)', color: '#A8ED52' },
}

const GROUP_COLORS = [
  'rgba(80,150,230,.15)', 'rgba(50,200,140,.15)',
  'rgba(240,158,40,.15)', 'rgba(160,100,230,.15)',
  'rgba(230,70,60,.15)',
]
const GROUP_TEXT = ['#6BB5F5','#5DD99A','#F4B455','#C084F5','#F88080']

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function avatarColor(name) {
  const i = name.charCodeAt(0) % GROUP_COLORS.length
  return { bg: GROUP_COLORS[i], color: GROUP_TEXT[i] }
}

export default function Roster() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterGroup, setFilterGroup] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAthletes() }, [user])

  async function fetchAthletes() {
    if (!user) return
    const { data } = await supabase
      .from('athletes')
      .select('*, workout_assignments(id)')
      .eq('coach_id', user.id)
      .order('group_name').order('full_name')
    setAthletes(data || [])
    setLoading(false)
  }

  async function deleteAthlete(id) {
    if (!confirm('Remove this athlete from your roster?')) return
    await supabase.from('athletes').delete().eq('id', id)
    setAthletes(a => a.filter(x => x.id !== id))
  }

  const groups = ['All', ...new Set(athletes.map(a => a.group_name).filter(Boolean))]

  const filtered = athletes.filter(a => {
    if (filterGroup !== 'All' && a.group_name !== filterGroup) return false
    if (search && !a.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by group_name for display
  const grouped = filtered.reduce((acc, a) => {
    const g = a.group_name || 'Ungrouped'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {})

  return (
    <Layout>
      {isMobile && (
        <div style={{ padding: '14px 16px 12px', paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)' }}>Roster</span>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes..."
            style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 11px', fontSize: 13, outline: 'none' }} />
        </div>
      )}

      <div style={{ padding: isMobile ? '12px 16px' : '20px 24px' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Athlete roster</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>{athletes.length} athletes</p>
            </div>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add athlete</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isMobile && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '7px 11px', fontSize: 13, outline: 'none', width: 180 }} />
          )}
          {groups.map(g => (
            <button key={g} onClick={() => setFilterGroup(g)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterGroup === g ? 600 : 400, border: 'none', cursor: 'pointer',
              background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)',
            }}>{g}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : athletes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤸</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No athletes yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Add your first athlete to start assigning workouts</p>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add athlete</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(grouped).map(([group, members]) => (
              <div key={group}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                  {group} · {members.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(a => {
                    const av = avatarColor(a.full_name)
                    const lc = LEVEL_COLORS[a.level] || { bg: 'var(--br)', color: 'var(--mu)' }
                    return (
                      <div key={a.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, background: av.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: av.color, flexShrink: 0 }}>
                          {initials(a.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>{a.full_name}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {a.level && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: lc.bg, color: lc.color }}>{a.level}</span>}
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{a.workout_assignments?.length || 0} workouts assigned</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => navigate(`/roster/${a.id}`)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '8px 12px', cursor: 'pointer', minHeight: 36 }}>View</button>
                          <button onClick={() => navigate(`/roster/${a.id}/edit`)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '8px 12px', cursor: 'pointer', minHeight: 36 }}>Edit</button>
                          <button onClick={() => deleteAthlete(a.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '8px 12px', cursor: 'pointer', minHeight: 36 }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
