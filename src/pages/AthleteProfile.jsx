import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

const LEVEL_COLORS = {
  'Level 5': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Level 6': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Elite':   { bg: 'rgba(168,237,82,.12)', color: '#A8ED52' },
}

const AVATAR_PALETTE = [
  { bg: 'rgba(200,255,80,.15)',  color: '#C8FF50' },
  { bg: 'rgba(79,158,255,.15)',  color: '#4F9EFF' },
  { bg: 'rgba(192,132,245,.15)', color: '#C084F5' },
  { bg: 'rgba(48,232,200,.15)',  color: '#30E8C8' },
  { bg: 'rgba(255,184,48,.15)',  color: '#FFB830' },
]

function initials(name) { return (name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }
function avPal(name) { return AVATAR_PALETTE[(name||'').charCodeAt(0) % AVATAR_PALETTE.length] }

function getMuscleGroups(assignment) {
  const groups = new Set(assignment.workouts?.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
  return [...groups]
}

export default function AthleteProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [athlete, setAthlete]       = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]       = useState(true)
  const [copied, setCopied]         = useState(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: a }, { data: assigns }] = await Promise.all([
      supabase.from('athletes').select('*').eq('id', id).single(),
      supabase.from('workout_assignments')
        .select('*, workouts(id, name, share_token, workout_exercises(exercises(muscle_group)))')
        .eq('athlete_id', id)
        .order('assigned_at', { ascending: false }),
    ])
    setAthlete(a)
    setAssignments(assigns || [])
    setLoading(false)
  }

  async function removeAssignment(assignId) {
    await supabase.from('workout_assignments').delete().eq('id', assignId)
    setAssignments(prev => prev.filter(a => a.id !== assignId))
  }

  function copyLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading…</div></Layout>
  if (!athlete) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Athlete not found</div></Layout>

  const av = avPal(athlete.full_name)
  const lc = LEVEL_COLORS[athlete.level] || { bg: 'var(--br)', color: 'var(--mu2)' }

  // Aggregate muscle groups across all assignments
  const allGroups = assignments.flatMap(a => getMuscleGroups(a))
  const groupCounts = allGroups.reduce((acc, g) => { acc[g] = (acc[g]||0)+1; return acc }, {})
  const maxCount = Math.max(...Object.values(groupCounts), 1)

  return (
    <Layout>
      {/* ── HEADER ── */}
      <div style={{ padding: isMobile ? `max(14px,calc(var(--sat)+6px)) 16px 10px` : '14px 20px', background: 'var(--s1)', borderBottom: '1px solid var(--br)', display: 'flex', alignItems: 'center', gap: 10, position: isMobile ? 'sticky' : 'static', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/roster')} style={{ background: 'var(--br)', border: 'none', borderRadius: 9, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Athlete Profile</span>
        <button onClick={() => navigate(`/roster/${id}/edit`)} style={{ background: 'var(--br)', border: 'none', borderRadius: 9, padding: '7px 13px', fontSize: 12, color: 'var(--mu2)', cursor: 'pointer', fontWeight: 500 }}>Edit</button>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: isMobile ? '0 0 20px' : '20px 16px' }}>

        {/* ── HERO ── */}
        <div style={{ padding: '20px 16px 18px', background: `linear-gradient(160deg,${av.bg.replace(',.15)',',0.06)')} 0%,transparent 65%)`, borderBottom: '1px solid var(--br)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, background: av.bg, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: av.color, marginBottom: 12, fontFamily: 'var(--font-head,sans-serif)' }}>
            {initials(athlete.full_name)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)', marginBottom: 5 }}>{athlete.full_name}</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            {athlete.level && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: lc.bg, color: lc.color }}>{athlete.level}</span>}
            {athlete.group_name && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: 'var(--br)', color: 'var(--mu2)' }}>{athlete.group_name}</span>}
          </div>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ac)', lineHeight: 1, fontFamily: 'var(--font-head,sans-serif)' }}>{assignments.length}</div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Workouts</div>
            </div>
            <div style={{ width: 1, background: 'var(--br)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#4F9EFF', lineHeight: 1, fontFamily: 'var(--font-head,sans-serif)' }}>{Object.keys(groupCounts).length}</div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Muscle groups</div>
            </div>
            {athlete.notes && <><div style={{ width: 1, background: 'var(--br)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, lineHeight: 1 }}>📝</div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Notes</div>
            </div></>}
          </div>
        </div>

        <div style={{ padding: '16px 16px 0' }}>
          {/* ── NOTES ── */}
          {athlete.notes && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.6 }}>{athlete.notes}</div>
            </div>
          )}

          {/* ── MUSCLE GROUP BREAKDOWN ── */}
          {Object.keys(groupCounts).length > 0 && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Training focus</div>
              {Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).map(([group, count]) => {
                const c = GROUP_COLORS[group] || { bg: 'var(--br)', color: 'var(--mu2)' }
                const pct = (count / maxCount) * 100
                return (
                  <div key={group} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{group}</span>
                      <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{count} workout{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--br)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: 3, transition: 'width .4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ASSIGNED WORKOUTS ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>Assigned workouts</span>
            <span style={{ fontSize: 12, color: 'var(--mu)' }}>{assignments.length} total</span>
          </div>

          {assignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--mu)', background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12 }}>
              <p style={{ fontSize: 14 }}>No workouts assigned yet</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Assign workouts from the dashboard</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {assignments.map((a, idx) => {
                const groups = getMuscleGroups(a)
                const accent = ['var(--ac)','#4F9EFF','#C084F5','#30E8C8','#FFB830'][idx % 5]
                return (
                  <div key={a.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 13, padding: 14, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '3px 0 0 3px' }} />
                    <div style={{ paddingLeft: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{a.workouts?.name}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {groups.map(g => {
                          const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu2)' }
                          return <span key={g} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color }}>{g}</span>
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 11 }}>
                        Assigned {new Date(a.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 7 }}>
                        <button onClick={() => copyLink(a.workouts?.share_token)}
                          style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: copied === a.workouts?.share_token ? 'var(--ac)' : 'var(--mu2)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', minHeight: 38 }}>
                          {copied === a.workouts?.share_token ? '✓ Copied!' : '🔗 Copy link'}
                        </button>
                        <button onClick={() => removeAssignment(a.id)}
                          style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#F88080', fontSize: 12, padding: '9px 12px', cursor: 'pointer', minHeight: 38 }}>Remove</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
