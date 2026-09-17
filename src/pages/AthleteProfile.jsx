import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Alert, Badge, Button, Card, EmptyState } from '../components/ui'

const GROUP_COLORS = {
  Arms: { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  Back: { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  Legs: { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
  Core: { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function AthleteProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('assigned')

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [{ data: a }, { data: assigns }] = await Promise.all([
      supabase.from('athletes').select('*').eq('id', id).single(),
      supabase.from('workout_assignments')
        .select('*, workouts(id, name, workout_exercises(exercises(muscle_group))), workout_feedback(id, emoji_rating, rpe, notes, exercises_completed, exercises_total, submitted_at)')
        .eq('athlete_id', id)
        .order('assigned_at', { ascending: false }),
    ])
    setAthlete(a)
    setAssignments(assigns || [])
    setLoading(false)
  }

  async function removeAssignment(assignId) {
    if (!window.confirm('Remove this workout assignment? The athlete link will stop working.')) return
    setError('')
    const { error: removeError } = await supabase.from('workout_assignments').delete().eq('id', assignId)
    if (removeError) {
      setError(removeError.message || 'Could not remove assignment')
      return
    }
    setAssignments(prev => prev.filter(a => a.id !== assignId))
  }

  async function rotateLink(assignId) {
    setError('')
    const { data: token, error: rotateError } = await supabase.rpc('rotate_assignment_link', {
      p_assignment_id: assignId,
    })
    if (rotateError) {
      setError(rotateError.message || 'Could not rotate athlete link')
      return
    }
    setAssignments(prev => prev.map(a => a.id === assignId
      ? { ...a, assignment_token: token, expires_at: new Date(Date.now() + 180 * 86400000).toISOString() }
      : a))
    await copyLink(token)
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('The link could not be copied. Check browser clipboard permissions and try again.')
    }
  }

  function getMuscleGroups(assignment) {
    const groups = new Set(
      assignment.workouts?.workout_exercises?.map(we => we.exercises?.muscle_group).filter(Boolean)
    )
    return [...groups]
  }

  if (loading) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Loading...</div></Layout>
  if (!athlete) return <Layout><div style={{ padding: 40, color: 'var(--mu)' }}>Athlete not found</div></Layout>

  return (
    <Layout>
      <div className="cu-container cu-page" style={{ maxWidth: 720 }}>
        {error && <Alert>{error}</Alert>}
        {/* Back */}
        <button onClick={() => navigate('/roster')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Roster
        </button>

        {/* Profile card */}
        <Card padded style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(168,237,82,.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--ac)', flexShrink: 0 }}>
              {initials(athlete.full_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginBottom: 5 }}>{athlete.full_name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {athlete.level && <Badge tone="info">{athlete.level}</Badge>}
                {athlete.group_name && <Badge>{athlete.group_name}</Badge>}
              </div>
            </div>
            <Button variant="secondary" onClick={() => navigate(`/roster/${id}/edit`)}>Edit</Button>
          </div>
          {athlete.notes && (
            <div style={{ borderTop: '1px solid var(--br)', paddingTop: 12, fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
              {athlete.notes}
            </div>
          )}
        </Card>

        <div role="tablist" aria-label="Athlete activity" className="auth-tabs" style={{ marginBottom: 16 }}>
          <button type="button" role="tab" aria-selected={tab === 'assigned'} className="auth-tab" onClick={() => setTab('assigned')}>Assigned</button>
          <button type="button" role="tab" aria-selected={tab === 'feedback'} className="auth-tab" onClick={() => setTab('feedback')}>Feedback</button>
        </div>

        {tab === 'assigned' ? <>
        {/* Assignments */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>Assigned workouts</span>
          <span style={{ fontSize: 12, color: 'var(--mu)' }}>{assignments.length} total</span>
        </div>

        {assignments.length === 0 ? (
          <EmptyState>
            <div>
            <p style={{ fontSize: 14 }}>No workouts assigned yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Assign workouts from your dashboard</p>
            </div>
          </EmptyState>
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
                    {a.expires_at && <> · {new Date(a.expires_at) <= new Date() ? 'Link expired' : `Expires ${new Date(a.expires_at).toLocaleDateString()}`}</>}
                  </div>
                  <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 8 }}>
                    <button onClick={() => copyLink(a.assignment_token)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: copied === a.assignment_token ? 'var(--ac)' : 'var(--mu)', fontSize: 12, padding: '10px 10px', cursor: 'pointer', minHeight: 40 }}>
                      {copied === a.assignment_token ? '✓ Copied!' : '🔗 Copy athlete link'}
                    </button>
                    <button onClick={() => rotateLink(a.id)} title="Invalidate the old link and copy a new one" style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: 'var(--mu)', fontSize: 12, padding: '10px 12px', cursor: 'pointer', minHeight: 40 }}>
                      Rotate
                    </button>
                    <button onClick={() => removeAssignment(a.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '10px 12px', cursor: 'pointer', minHeight: 40 }}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </> : <FeedbackPanel assignments={assignments} />}
      </div>
    </Layout>
  )
}

function FeedbackPanel({ assignments }) {
  const responses = assignments.flatMap(assignment => (assignment.workout_feedback || []).map(feedback => ({ ...feedback, workoutName: assignment.workouts?.name })))
  if (!responses.length) return <EmptyState><div><h2>No feedback yet</h2><p>Athlete responses will appear here after a shared workout is completed.</p></div></EmptyState>
  return <div style={{ display: 'grid', gap: 10 }}>{responses.map(response => (
    <Card padded key={response.id}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}><strong>{response.workoutName}</strong><Badge tone="success">{response.emoji_rating || 'Completed'}</Badge></div>
      <p style={{ color:'var(--chalk-dim)', margin:'8px 0 0' }}>{response.exercises_completed}/{response.exercises_total} exercises{response.rpe ? ` · RPE ${response.rpe}` : ''}</p>
      {response.notes && <p style={{ margin:'10px 0 0' }}>{response.notes}</p>}
      <p className="cu-label" style={{ margin:'10px 0 0' }}>{new Date(response.submitted_at).toLocaleDateString()}</p>
    </Card>
  ))}</div>
}
