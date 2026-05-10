import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import Layout from '../components/Layout'
import AssignModal from '../components/AssignModal'

const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

function Badge({ group }) {
  const c = GROUP_COLORS[group] || { bg: 'var(--br)', color: 'var(--mu)' }
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{group}</span>
}

export default function Dashboard() {
  const { user, coach } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [assigningWorkout, setAssigningWorkout] = useState(null)
  const [sheetWorkout, setSheetWorkout] = useState(null)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => { fetchWorkouts() }, [user])

  async function fetchWorkouts() {
    if (!user) return
    const { data } = await supabase
      .from('workouts')
      .select('*, workout_exercises(exercise_id, exercises(muscle_group))')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    setWorkouts(data || [])
    setLoading(false)
  }

  async function deleteWorkout(id) {
    if (!confirm('Delete this workout?')) return
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(w => w.filter(x => x.id !== id))
  }

  async function duplicateWorkout(w) {
    const { data: newW } = await supabase
      .from('workouts')
      .insert({ coach_id: user.id, name: `${w.name} (copy)` })
      .select().single()
    if (!newW) return
    const { data: exercises } = await supabase
      .from('workout_exercises').select('*').eq('workout_id', w.id)
    if (exercises?.length) {
      await supabase.from('workout_exercises').insert(
        exercises.map(e => ({
          workout_id: newW.id, exercise_id: e.exercise_id,
          position: e.position, sets: e.sets, reps: e.reps,
          duration_seconds: e.duration_seconds, rest_seconds: e.rest_seconds,
        }))
      )
    }
    fetchWorkouts()
  }

    function copyShareLink(token) {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function getMuscleGroups(workout) {
    const groups = new Set(workout.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
    return [...groups]
  }

  const GROUP_OPTIONS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']

  const filteredWorkouts = workouts.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterGroup !== 'All') {
      const groups = new Set(w.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean))
      if (!groups.has(filterGroup)) return false
    }
    return true
  })

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading...</div></Layout>

  const gridCols = isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))'

  return (
    <Layout>
      {isMobile && (
        <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          {/* Main header row */}
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChalkUpLogo size={22} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em', flex: 1 }}>chalkup</span>
            <button onClick={() => setFilterOpen(o => !o)} style={{ background: filterOpen || search || filterGroup !== 'All' ? 'rgba(168,237,82,.12)' : 'var(--br)', border: 'none', borderRadius: 8, color: filterOpen || search || filterGroup !== 'All' ? 'var(--ac)' : 'var(--mu)', padding: '7px 10px', fontSize: 13, cursor: 'pointer' }}>
              {filterOpen ? '✕' : '🔍'}
            </button>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
          </div>
          {/* Expandable search + filter */}
          {filterOpen && (
            <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts..." autoFocus
                style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 11px', fontSize: 13, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                {GROUP_OPTIONS.map(g => <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: filterGroup === g ? 600 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--s2)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{g}</button>)}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>My workouts</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>{filteredWorkouts.length} of {workouts.length}</p>
            </div>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>
              + New workout
            </button>
          </div>
        )}

        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>My workouts</span>
            <span style={{ fontSize: 12, color: 'var(--mu)' }}>{workouts.length} saved</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workouts..." style={{ background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '7px 11px', fontSize: 13, outline: 'none', width: 200 }} />
          {GROUP_OPTIONS.map(g => <button key={g} onClick={() => setFilterGroup(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterGroup === g ? 600 : 400, background: filterGroup === g ? 'var(--ac)' : 'var(--br)', color: filterGroup === g ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer' }}>{g}</button>)}
        </div>
        {workouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }}>No workouts yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Create your first workout to get started</p>
            <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '10px 20px', fontSize: 13, fontWeight: 700 }}>
              Create workout
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 10 : 14 }}>
            {filteredWorkouts.map(w => (
              <div key={w.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: isMobile ? 14 : 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{w.name}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {getMuscleGroups(w).map(g => <Badge key={g} group={g} />)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>
                  {w.workout_exercises?.length || 0} exercises
                </div>
                <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10 }}>
                  {isMobile ? (
                    /* Mobile: Share + Assign + ••• */
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => copyShareLink(w.share_token)}
                        style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: copied === w.share_token ? 'var(--ac)' : 'var(--mu)', fontSize: 13, padding: '11px 10px', cursor: 'pointer', minHeight: 44 }}>
                        {copied === w.share_token ? '✓ Copied!' : '🔗 Share'}
                      </button>
                      <button onClick={() => setAssigningWorkout(w)}
                        style={{ flex: 1, background: 'rgba(168,237,82,.08)', border: '1px solid rgba(168,237,82,.2)', borderRadius: 8, color: 'var(--ac)', fontSize: 13, padding: '11px 10px', cursor: 'pointer', fontWeight: 600, minHeight: 44 }}>
                        Assign
                      </button>
                      <button onClick={() => setSheetWorkout(w)}
                        style={{ width: 44, minHeight: 44, background: 'var(--br)', border: 'none', borderRadius: 8, color: 'var(--mu)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        •••
                      </button>
                    </div>
                  ) : (
                    /* Desktop: two-row layout */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => copyShareLink(w.share_token)}
                          style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: copied === w.share_token ? 'var(--ac)' : 'var(--mu)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', minHeight: 36 }}>
                          {copied === w.share_token ? '✓ Copied!' : '🔗 Share'}
                        </button>
                        <button onClick={() => setAssigningWorkout(w)}
                          style={{ flex: 1, background: 'rgba(168,237,82,.08)', border: '1px solid rgba(168,237,82,.2)', borderRadius: 6, color: 'var(--ac)', fontSize: 12, padding: '9px 10px', cursor: 'pointer', fontWeight: 500, minHeight: 36 }}>
                          Assign
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => navigate(`/workout/${w.id}/edit`)}
                          style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 34 }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => duplicateWorkout(w)}
                          style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '7px 10px', cursor: 'pointer', minHeight: 34 }}>
                          ⧉ Duplicate
                        </button>
                        <button onClick={() => deleteWorkout(w.id)}
                          style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '7px 12px', cursor: 'pointer', minHeight: 34 }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!isMobile && (
              <div onClick={() => navigate('/workout/new')} style={{ border: '1.5px dashed var(--br)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, cursor: 'pointer', color: 'var(--mu)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--br)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
                <span style={{ fontSize: 13 }}>Create new workout</span>
              </div>
            )}
          </div>
        )}
      </div>
      {assigningWorkout && (
        <AssignModal
          workout={assigningWorkout}
          onClose={() => setAssigningWorkout(null)}
        />
      )}

      {/* Mobile ••• bottom sheet */}
      {sheetWorkout && (
        <div
          onClick={() => setSheetWorkout(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--s1)', borderRadius: '18px 18px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', overflow: 'hidden' }}>

            {/* Handle */}
            <div style={{ width: 36, height: 4, background: 'var(--br2)', borderRadius: 2, margin: '12px auto 16px' }} />

            {/* Workout name */}
            <div style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--br)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{sheetWorkout.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)' }}>{sheetWorkout.workout_exercises?.length || 0} exercises</div>
            </div>

            {/* 2×2 action grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 16px 4px' }}>
              {[
                { icon: '✏️', label: 'Edit', color: 'var(--tx)', action: () => { setSheetWorkout(null); navigate(`/workout/${sheetWorkout.id}/edit`) } },
                { icon: '⧉',  label: 'Duplicate', color: 'var(--tx)', action: () => { duplicateWorkout(sheetWorkout); setSheetWorkout(null) } },
                { icon: '🔗', label: 'Copy link', color: 'var(--tx)', action: () => { copyShareLink(sheetWorkout.share_token); setSheetWorkout(null) } },
                { icon: '🗑', label: 'Delete', color: '#F88080', action: () => { deleteWorkout(sheetWorkout.id); setSheetWorkout(null) }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{
                    background: item.danger ? 'rgba(248,128,128,.07)' : 'var(--s2)',
                    border: `1px solid ${item.danger ? 'rgba(248,128,128,.2)' : 'var(--br)'}`,
                    borderRadius: 12, padding: '16px 12px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', minHeight: 80,
                  }}>
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: item.color, fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Cancel */}
            <div style={{ padding: '10px 16px 0' }}>
              <button onClick={() => setSheetWorkout(null)}
                style={{ width: '100%', padding: '14px', background: 'var(--br)', border: 'none', borderRadius: 12, color: 'var(--mu)', fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
