import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const LEVEL_COLORS = {
  'Level 1': { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  'Level 2': { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  'Level 3': { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  'Level 4': { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  'Level 5': { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  'Level 6': { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  'Level 7': { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  'Level 8': { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  'Level 9': { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
  'Level 10':{ bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
  'Elite':   { bg: 'rgba(168,237,82,.12)',  color: '#A8ED52' },
}

const AVATAR_PALETTE = [
  { bg: 'rgba(200,255,80,.14)',  color: '#C8FF50' },
  { bg: 'rgba(79,158,255,.14)',  color: '#4F9EFF' },
  { bg: 'rgba(192,132,245,.14)', color: '#C084F5' },
  { bg: 'rgba(48,232,200,.14)',  color: '#30E8C8' },
  { bg: 'rgba(255,184,48,.14)',  color: '#FFB830' },
  { bg: 'rgba(248,128,128,.14)', color: '#F88080' },
]

function initials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
function avatarPalette(name) {
  return AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length]
}

export default function Roster() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterGroup, setFilterGroup] = useState('All')
  const [search, setSearch]           = useState('')

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

  const groups  = ['All', ...new Set(athletes.map(a => a.group_name).filter(Boolean))]
  const filtered = athletes.filter(a => {
    if (filterGroup !== 'All' && a.group_name !== filterGroup) return false
    if (search && !a.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const grouped = filtered.reduce((acc, a) => {
    const g = a.group_name || 'Ungrouped'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {})

  return (
    <Layout>
      {/* ── MOBILE HEADER ── */}
      {isMobile && (
        <div style={{ paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Roster</div>
              <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 1 }}>{athletes.length} athletes</div>
            </div>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
          </div>
          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ background: 'var(--br)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 14, opacity: .45 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--tx)', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
          {groups.length > 1 && (
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '0 16px 10px' }}>
              {groups.map(g => (
                <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--s2)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{g}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '12px 16px' : '20px 24px' }}>
        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Athlete roster</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>{athletes.length} athletes</p>
            </div>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add athlete</button>
          </div>
        )}

        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ background: 'var(--br)', borderRadius: 9, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ opacity: .4 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
                style={{ background: 'transparent', border: 'none', color: 'var(--tx)', fontSize: 13, outline: 'none', width: 160 }} />
            </div>
            {groups.map(g => (
              <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer' }}>{g}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : athletes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤸</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No athletes yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Add your first athlete to start assigning workouts</p>
            <button onClick={() => navigate('/roster/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add athlete</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.entries(grouped).map(([group, members]) => (
              <div key={group}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {group}
                  <span style={{ background: 'var(--br)', color: 'var(--mu2)', borderRadius: 20, padding: '1px 8px', fontSize: 10, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{members.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(a => {
                    const av = avatarPalette(a.full_name)
                    const lc = LEVEL_COLORS[a.level] || { bg: 'var(--br)', color: 'var(--mu2)' }
                    const workoutCount = a.workout_assignments?.length || 0
                    return (
                      <div key={a.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                        onClick={() => navigate(`/roster/${a.id}`)} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>

                        {/* Avatar */}
                        <div style={{ width: 42, height: 42, background: av.bg, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: av.color, flexShrink: 0, fontFamily: 'var(--font-head,sans-serif)' }}>
                          {initials(a.full_name)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.full_name}</div>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* Status dot */}
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DD99A', flexShrink: 0 }} />
                            {a.level && <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: lc.bg, color: lc.color }}>{a.level}</span>}
                            {workoutCount > 0 && <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: 'var(--br)', color: 'var(--mu2)' }}>{workoutCount} workout{workoutCount !== 1 ? 's' : ''}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => navigate(`/roster/${a.id}/edit`)} style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, padding: '7px 11px', cursor: 'pointer', minHeight: 34 }}>Edit</button>
                          <button onClick={() => deleteAthlete(a.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#F88080', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 34 }}>✕</button>
                        </div>

                        {/* Chevron */}
                        <span style={{ color: 'var(--br2)', fontSize: 18, flexShrink: 0 }}>›</span>
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
