import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const ACCENTS = ['var(--ac)', '#4F9EFF', '#C084F5', '#30E8C8', '#FFB830']

export default function Programs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading]   = useState(true)

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
      {/* ── MOBILE HEADER ── */}
      {isMobile && (
        <div style={{ paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Programs</div>
              <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 1 }}>Multi-week training plans</div>
            </div>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}>
        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>Training programs</h1>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Multi-week plans built from your workouts</p>
            </div>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New program</button>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No programs yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Build a multi-week plan from your saved workouts</p>
            <button onClick={() => navigate('/programs/new')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create program</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))', gap: isMobile ? 10 : 14 }}>
            {programs.map((p, idx) => {
              const accent = ACCENTS[idx % ACCENTS.length]
              const days = p.program_days?.length || 0
              return (
                <div key={p.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 14, padding: '14px 14px 12px', position: 'relative', overflow: 'hidden' }}>
                  {/* Accent bar */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, borderRadius: '3px 0 0 3px' }} />
                  <div style={{ paddingLeft: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 8, lineHeight: 1.5 }}>{p.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(200,255,80,.1)', color: 'var(--ac)' }}>
                        {p.duration_weeks} week{p.duration_weeks !== 1 ? 's' : ''}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--br)', color: 'var(--mu2)' }}>
                        {days} day{days !== 1 ? 's' : ''} planned
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--br)', paddingTop: 10, display: 'flex', gap: 7 }}>
                      <button onClick={() => navigate(`/programs/${p.id}`)}
                        style={{ flex: 1, background: 'rgba(200,255,80,.08)', border: '1px solid rgba(200,255,80,.2)', borderRadius: 9, color: 'var(--ac)', fontSize: 13, fontWeight: 600, padding: '9px 10px', cursor: 'pointer' }}>
                        Open
                      </button>
                      <button onClick={() => deleteProgram(p.id)}
                        style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 9, color: '#F88080', fontSize: 13, padding: '9px 12px', cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!isMobile && (
              <div onClick={() => navigate('/programs/new')} style={{ border: '1.5px dashed var(--br)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 8, cursor: 'pointer', color: 'var(--mu)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--br)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
                <span style={{ fontSize: 13 }}>New program</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
