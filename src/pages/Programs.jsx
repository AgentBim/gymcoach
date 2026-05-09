import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPrograms() }, [user])

  async function fetchPrograms() {
    if (!user) return
    const { data } = await supabase
      .from('programs')
      .select('*, program_days(id)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    setPrograms(data || [])
    setLoading(false)
  }

  async function deleteProgram(id) {
    if (!confirm('Delete this program?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(p => p.filter(x => x.id !== id))
  }

  return (
    <Layout>
      {isMobile && (
        <div style={{ padding: '14px 16px 12px', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)' }}>Programs</span>
          <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
        </div>
      )}
      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}>
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Training programs</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Multi-week plans built from your workouts</p>
            </div>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New program</button>
          </div>
        )}
        {loading ? <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No programs yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Build a multi-week plan from your saved workouts</p>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create program</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {programs.map(p => (
              <div key={p.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8, lineHeight: 1.5 }}>{p.description}</div>}
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>
                  {p.duration_weeks} week{p.duration_weeks !== 1 ? 's' : ''} · {p.program_days?.length || 0} days planned
                </div>
                <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate(`/programs/${p.id}`)} style={{ flex: 1, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 10px', cursor: 'pointer' }}>Open</button>
                  <button onClick={() => deleteProgram(p.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: '#F88080', fontSize: 12, padding: '8px 12px', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
