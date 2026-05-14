import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import Layout from '../components/Layout'
import AssignModal from '../components/AssignModal'

const ACCENT_COLORS = ['var(--ac)', '#4F9EFF', '#C084F5', '#30E8C8', '#FFB830', '#F88080']

const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

const AVATAR_PALETTE = [
  { bg: 'rgba(200,255,80,.12)',  color: '#C8FF50' },
  { bg: 'rgba(79,158,255,.12)',  color: '#4F9EFF' },
  { bg: 'rgba(192,132,245,.12)', color: '#C084F5' },
  { bg: 'rgba(48,232,200,.12)',  color: '#30E8C8' },
  { bg: 'rgba(255,184,48,.12)',  color: '#FFB830' },
  { bg: 'rgba(248,128,128,.12)', color: '#F88080' },
]

function initials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function avatarPalette(name) {
  return AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length]
}

function getMuscleGroups(workout) {
  const groups = new Set(workout.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
  return [...groups]
}

function getDayGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const GROUP_OPTIONS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']

export default function Dashboard() {
  const { user, coach } = useAuth()
  const [workouts, setWorkouts]           = useState([])
  const [athletes, setAthletes]           = useState([])
  const [completionCount, setCompletionCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [copied, setCopied]               = useState(null)
  const [assigningWorkout, setAssigningWorkout] = useState(null)
  const [sheetWorkout, setSheetWorkout]   = useState(null)
  const [search, setSearch]               = useState('')
  const [filterGroup, setFilterGroup]     = useState('All')
  const [filterOpen, setFilterOpen]       = useState(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => { fetchAll() }, [user])

  async function fetchAll() {
    if (!user) return
    const [wRes, aRes, fbRes] = await Promise.all([
      supabase.from('workouts')
        .select('*, workout_exercises(exercise_id, exercises(muscle_group)), workout_assignments(id, athlete_id, athletes(full_name))')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('athletes').select('id, full_name').eq('coach_id', user.id),
      supabase.from('workout_feedback')
        .select('id, workouts!inner(coach_id)')
        .eq('workouts.coach_id', user.id),
    ])
    setWorkouts(wRes.data || [])
    setAthletes(aRes.data || [])
    setCompletionCount((fbRes.data || []).length)
    setLoading(false)
  }

  async function deleteWorkout(id) {
    if (!confirm('Delete this workout?')) return
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(w => w.filter(x => x.id !== id))
  }

  async function duplicateWorkout(w) {
    const { data: newW } = await supabase.from('workouts')
      .insert({ coach_id: user.id, name: `${w.name} (copy)` }).select().single()
    if (!newW) return
    const { data: ex } = await supabase.from('workout_exercises').select('*').eq('workout_id', w.id)
    if (ex?.length) await supabase.from('workout_exercises').insert(
      ex.map(e => ({ workout_id: newW.id, exercise_id: e.exercise_id, position: e.position, sets: e.sets, reps: e.reps, duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds }))
    )
    fetchAll()
  }

  function copyShareLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredWorkouts = workouts.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterGroup !== 'All') {
      const groups = new Set(w.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
      if (!groups.has(filterGroup)) return false
    }
    return true
  })

  const coachFirst = coach?.full_name?.split(' ')[0] || 'Coach'
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // ── WORKOUT CARD ──────────────────────────────────────────────
  function WorkoutCard({ w, idx }) {
    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length]
    const groups = getMuscleGroups(w)
    const assigned = w.workout_assignments || []
    const exCount = w.workout_exercises?.length || 0

    return (
      <div style={{
        background: 'var(--s2)',
        border: `1px solid ${w.is_ai_generated ? 'rgba(167,139,250,.22)' : 'var(--br)'}`,
        borderRadius: 14,
        padding: isMobile ? '14px 14px 12px' : '16px 16px 14px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Left accent bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '3px 0 0 3px' }} />

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
              {w.is_ai_generated && <span style={{ fontSize: 10, background: 'rgba(167,139,250,.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,.25)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, flexShrink: 0 }}>✦ AI</span>}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{exCount} exercise{exCount !== 1 ? 's' : ''}</span>
              {groups.slice(0, 3).map(g => {
                const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu2)' }
                return <span key={g} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
              })}
            </div>
          </div>
          {isMobile && (
            <button onClick={() => setSheetWorkout(w)}
              style={{ background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--mu)', fontSize: 16, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
              ···
            </button>
          )}
        </div>

        {/* Assigned athletes mini avatars */}
        {assigned.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingLeft: 2 }}>
            <div style={{ display: 'flex' }}>
              {assigned.slice(0, 5).map((a, i) => {
                const av = avatarPalette(a.athletes?.full_name || '')
                return (
                  <div key={a.id} style={{ width: 22, height: 22, borderRadius: 7, background: av.bg, border: '1.5px solid var(--bg)', marginLeft: i === 0 ? 0 : -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: av.color, zIndex: 5 - i }}>
                    {initials(a.athletes?.full_name || '')}
                  </div>
                )
              })}
              {assigned.length > 5 && (
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--br2)', border: '1.5px solid var(--bg)', marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--mu2)', fontWeight: 600 }}>
                  +{assigned.length - 5}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{assigned.length} assigned</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, paddingLeft: 2 }}>
          {isMobile ? (
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={() => copyShareLink(w.share_token)}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 9, color: copied === w.share_token ? 'var(--ac)' : 'var(--mu2)', fontSize: 12, padding: '10px 8px', cursor: 'pointer', minHeight: 40, fontWeight: 500 }}>
                {copied === w.share_token ? '✓ Copied!' : '🔗 Share'}
              </button>
              <button onClick={() => setAssigningWorkout(w)}
                style={{ flex: 1, background: 'rgba(168,237,82,.07)', border: '1px solid rgba(168,237,82,.2)', borderRadius: 9, color: 'var(--ac)', fontSize: 12, padding: '10px 8px', cursor: 'pointer', fontWeight: 600, minHeight: 40 }}>
                Assign
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => copyShareLink(w.share_token)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: copied === w.share_token ? 'var(--ac)' : 'var(--mu2)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', minHeight: 36 }}>
                  {copied === w.share_token ? '✓ Copied!' : '🔗 Share'}
                </button>
                <button onClick={() => setAssigningWorkout(w)}
                  style={{ flex: 1, background: 'rgba(168,237,82,.07)', border: '1px solid rgba(168,237,82,.2)', borderRadius: 8, color: 'var(--ac)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', fontWeight: 500, minHeight: 36 }}>
                  Assign
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => navigate(`/workout/${w.id}/edit`)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 32 }}>✏️ Edit</button>
                <button onClick={() => duplicateWorkout(w)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 32 }}>⧉ Copy</button>
                <button onClick={() => deleteWorkout(w.id)}
                  style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#F88080', fontSize: 12, padding: '7px 12px', cursor: 'pointer', minHeight: 32 }}>🗑</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading…</div></Layout>

  return (
    <Layout>
      {/* ── MOBILE STICKY HEADER ── */}
      {isMobile && (
        <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10, paddingTop: 'var(--sat)' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChalkUpLogo size={22} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em', flex: 1 }}>chalkup</span>
            <button onClick={() => setFilterOpen(o => !o)} style={{ background: filterOpen || search || filterGroup !== 'All' ? 'rgba(168,237,82,.12)' : 'var(--br)', border: 'none', borderRadius: 8, color: filterOpen || search || filterGroup !== 'All' ? 'var(--ac)' : 'var(--mu)', padding: '7px 10px', fontSize: 13, cursor: 'pointer' }}>
              {filterOpen ? '✕' : '🔍'}
            </button>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
          </div>
          {filterOpen && (
            <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts…" autoFocus
                style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 11px', fontSize: 13, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {GROUP_OPTIONS.map(g => (
                  <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--s2)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{g}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '0' : '20px 24px' }}>

        {/* ── MOBILE GREETING + STATS ── */}
        {isMobile && (
          <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(160deg,rgba(200,255,80,.04) 0%,transparent 60%)' }}>
            <div style={{ fontSize: 11, color: 'var(--mu2)', marginBottom: 3 }}>{getDayGreeting()} · {day}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)', marginBottom: 14 }}>
              Hey, <span style={{ color: 'var(--ac)' }}>{coachFirst}</span> 👋
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: workouts.length, lbl: 'Workouts', col: 'var(--ac)' },
                { val: athletes.length, lbl: 'Athletes',  col: '#4F9EFF' },
                { val: completionCount, lbl: 'Completions', col: '#FFB830' },
              ].map(({ val, lbl, col }) => (
                <div key={lbl} style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 4, fontFamily: 'var(--font-head,sans-serif)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 4 }}>{getDayGreeting()}, {day}</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-head,sans-serif)' }}>
                Hey, <span style={{ color: 'var(--ac)' }}>{coachFirst}</span> 👋
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {[
                { val: workouts.length, lbl: 'Workouts', col: 'var(--ac)' },
                { val: athletes.length, lbl: 'Athletes',  col: '#4F9EFF' },
                { val: completionCount, lbl: 'Completions', col: '#FFB830' },
              ].map(({ val, lbl, col }) => (
                <div key={lbl} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, lineHeight: 1, marginBottom: 3, fontFamily: 'var(--font-head,sans-serif)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{lbl}</div>
                </div>
              ))}
              <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New workout</button>
            </div>
          </div>
        )}

        {/* ── DESKTOP FILTERS ── */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts…"
              style={{ background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '7px 11px', fontSize: 13, outline: 'none', width: 200 }} />
            {GROUP_OPTIONS.map(g => (
              <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterGroup === g ? 700 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer' }}>{g}</button>
            ))}
          </div>
        )}

        {/* ── WORKOUT LIST ── */}
        {workouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No workouts yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Create your first workout to get started</p>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create workout</button>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '4px 16px 16px' : 0 }}>
            {isMobile && (
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                My workouts <span style={{ color: 'var(--mu2)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{filteredWorkouts.length} saved</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))', gap: isMobile ? 10 : 14 }}>
              {filteredWorkouts.map((w, i) => <WorkoutCard key={w.id} w={w} idx={i} />)}
              {!isMobile && (
                <div onClick={() => navigate('/workout/new')} style={{ border: '1.5px dashed var(--br)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, cursor: 'pointer', color: 'var(--mu)', transition: 'border-color .15s' }}>
                  <div style={{ width: 36, height: 36, background: 'var(--br)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
                  <span style={{ fontSize: 13 }}>New workout</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {assigningWorkout && <AssignModal workout={assigningWorkout} onClose={() => setAssigningWorkout(null)} />}

      {/* ── MOBILE ··· BOTTOM SHEET ── */}
      {sheetWorkout && (
        <div onClick={() => setSheetWorkout(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--s1)', borderRadius: '20px 20px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', overflow: 'hidden' }}>
            <div style={{ width: 32, height: 3, background: 'var(--br2)', borderRadius: 2, margin: '12px auto 16px' }} />
            <div style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--br)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{sheetWorkout.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>{sheetWorkout.workout_exercises?.length || 0} exercises</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 16px 4px' }}>
              {[
                { icon: '✏️', label: 'Edit',       action: () => { setSheetWorkout(null); navigate(`/workout/${sheetWorkout.id}/edit`) } },
                { icon: '⧉',  label: 'Duplicate',  action: () => { duplicateWorkout(sheetWorkout); setSheetWorkout(null) } },
                { icon: '🔗', label: 'Copy link',  action: () => { copyShareLink(sheetWorkout.share_token); setSheetWorkout(null) } },
                { icon: '🗑', label: 'Delete', danger: true, action: () => { deleteWorkout(sheetWorkout.id); setSheetWorkout(null) } },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ background: item.danger ? 'rgba(248,128,128,.07)' : 'var(--s2)', border: `1px solid ${item.danger ? 'rgba(248,128,128,.2)' : 'var(--br)'}`, borderRadius: 14, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 80 }}>
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: item.danger ? '#F88080' : 'var(--tx)', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '10px 16px 0' }}>
              <button onClick={() => setSheetWorkout(null)}
                style={{ width: '100%', padding: '14px', background: 'var(--br)', border: 'none', borderRadius: 12, color: 'var(--mu)', fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
