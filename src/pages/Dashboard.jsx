import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

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

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading...</div></Layout>

  const gridCols = isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))'

  return (
    <Layout>
      {isMobile && (
        <div style={{ padding: '14px 16px 12px', background: 'var(--s1)', borderBottom: '1px solid var(--br)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, background: 'var(--ac)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🏆</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.02em' }}>GymCoach</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 1 }}>
              {coach?.full_name ? `Coach ${coach.full_name.split(' ')[0]}` : 'Dashboard'}
            </p>
          </div>
          <button onClick={() => navigate('/workout/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700 }}>
            + New
          </button>
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>My workouts</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>{workouts.length} saved</p>
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
            {workouts.map(w => (
              <div key={w.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: isMobile ? 14 : 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{w.name}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {getMuscleGroups(w).map(g => <Badge key={g} group={g} />)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>
                  {w.workout_exercises?.length || 0} exercises
                </div>
                <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={() => copyShareLink(w.share_token)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: copied === w.share_token ? 'var(--ac)' : 'var(--mu)', fontSize: 12, padding: '8px 10px' }}>
                    {copied === w.share_token ? '✓ Copied!' : '🔗 Share'}
                  </button>
                  <button onClick={() => navigate(`/workout/${w.id}/edit`)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '8px 12px' }}>
                    Edit
                  </button>
                  <button onClick={() => deleteWorkout(w.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '8px 12px' }}>
                    🗑
                  </button>
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
    </Layout>
  )
}
