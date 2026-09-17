import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'
import AppIcon from '../components/AppIcon'
import { Alert, Button, Card, EmptyState, IconButton } from '../components/ui'

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { fetchPrograms() }, [user])

  async function fetchPrograms() {
    if (!user) return
    const { data, error: fetchError } = await supabase
      .from('programs')
      .select('*, program_days(id)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message || 'Could not load programs')
    else setPrograms(data || [])
    setLoading(false)
  }

  async function deleteProgram(id) {
    if (!confirm('Delete this program?')) return
    setError('')
    const { error: deleteError } = await supabase.from('programs').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message || 'Could not delete program')
      return
    }
    setPrograms(p => p.filter(x => x.id !== id))
  }

  return (
    <Layout>
      {isMobile && (
        <div style={{ padding: '14px 16px 12px', paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)' }}>Programs</span>
          <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
        </div>
      )}
      <div className="cu-container cu-page">
        {error && <Alert>{error}</Alert>}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 className="cu-display">Training programs</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Multi-week plans built from your workouts</p>
            </div>
            <Button onClick={() => navigate('/programs/new')}><AppIcon name="plus" /> New program</Button>
          </div>
        )}
        {loading ? <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        : programs.length === 0 ? (
          <EmptyState><div>
            <AppIcon name="programs" size={36} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No programs yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Build a multi-week plan from your saved workouts</p>
            <Button onClick={() => navigate('/programs/new')}>Create program</Button>
          </div></EmptyState>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {programs.map(p => (
              <Card padded key={p.id}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8, lineHeight: 1.5 }}>{p.description}</div>}
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>
                  {p.duration_weeks} week{p.duration_weeks !== 1 ? 's' : ''} · {p.program_days?.length || 0} days planned
                </div>
                <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 8 }}>
                  <Button onClick={() => navigate(`/programs/${p.id}`)} style={{ flex: 1 }}>Open</Button>
                  <IconButton variant="danger" label={`Delete ${p.name}`} onClick={() => deleteProgram(p.id)}><AppIcon name="trash" /></IconButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
