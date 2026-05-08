import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

const LEVEL_COLORS = {
  'Level 5': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Level 6': { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  'Elite': { bg: 'rgba(168,237,82,.12)', color: '#A8ED52' },
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function AthleteProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)

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
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function getMuscleGroups(assignment) {
    const groups = new Set(
      assignment.workouts?.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean)
    )
    return [...groups]
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading...</div></Layout>
  if (!athlete) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Athlete not found</div></Layout>

  const lc = LEVEL_COLORS[athlete.level] || { bg: 'var(--br)', color: 'var(--mu)' }

  return (
    <Layout>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>
        {/* Back */}
        <button onClick={() => navigate('/roster')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Roster
        </button>

        {/* Profile card */}
        <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(168,237,82,.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--ac)', flexShrink: 0 }}>
              {initials(athlete.full_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginBottom: 5 }}>{athlete.full_name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {athlete.level && <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: lc.bg, color: lc.color }}>{athlete.level}</span>}
                {athlete.group_name && <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'var(--br)', color: 'var(--mu)' }}>{athlete.group_name}</span>}
              </div>
            </div>
            <button onClick={() => navigate(`/roster/${id}/edit`)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: 'var(--mu)', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>Edit</button>
          </div>
          {athlete.notes && (
            <div style={{ borderTop: '1px solid var(--br)', paddingTop: 12, fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
              {athlete.notes}
            </div>
          )}
        </div>

        {/* Assignments */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>Assigned workouts</span>
          <span style={{ fontSize: 12, color: 'var(--mu)' }}>{assignments.length} total</span>
        </div>

        {assignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mu)', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12 }}>
            <p style={{ fontSize: 14 }}>No workouts assigned yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Assign workouts from your dashboard</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignments.map(a => {
              const groups = getMuscleGroups(a)
              return (
                <div key={a.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 7 }}>{a.workouts?.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    {groups.map(g => {
                      const c = GROUP_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
                      return <span key={g} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{g}</span>
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }}>
                    Assigned {new Date(a.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 8 }}>
                    <button onClick={() => copyLink(a.workouts?.share_token)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: copied === a.workouts?.share_token ? 'var(--ac)' : 'var(--mu)', fontSize: 12, padding: '7px 10px', cursor: 'pointer' }}>
                      {copied === a.workouts?.share_token ? '✓ Copied!' : '🔗 Copy link'}
                    </button>
                    <button onClick={() => removeAssignment(a.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
