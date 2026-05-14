import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const EMOJI_MAP = {
  easy:     { icon: '😴', label: 'Too easy',   color: '#6BB5F5' },
  good:     { icon: '😊', label: 'Good',        color: '#5DD99A' },
  hard:     { icon: '💪', label: 'Challenging', color: '#F4B455' },
  veryhard: { icon: '🔥', label: 'Very hard',   color: '#F88080' },
}

const RPE_COLOR = r => r <= 3 ? '#6BB5F5' : r <= 5 ? '#5DD99A' : r <= 7 ? '#F4B455' : '#F88080'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const AVATAR_PALETTE = [
  { bg: 'rgba(200,255,80,.14)', color: '#C8FF50' },
  { bg: 'rgba(79,158,255,.14)', color: '#4F9EFF' },
  { bg: 'rgba(192,132,245,.14)', color: '#C084F5' },
  { bg: 'rgba(48,232,200,.14)', color: '#30E8C8' },
  { bg: 'rgba(255,184,48,.14)', color: '#FFB830' },
]
function initials(name) { return (name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }
function avPal(name) { return AVATAR_PALETTE[(name||'').charCodeAt(0) % AVATAR_PALETTE.length] }

export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [feedback, setFeedback]         = useState([])
  const [workouts, setWorkouts]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterWorkout, setFilterWorkout] = useState('all')
  const [filterEmoji, setFilterEmoji]   = useState('all')
  const [expandedId, setExpandedId]     = useState(null)

  useEffect(() => { fetchData() }, [user])

  async function fetchData() {
    if (!user) return
    const { data: wData } = await supabase
      .from('workouts')
      .select(`id, name, share_token,
        workout_feedback(id, emoji_rating, rpe, notes, exercises_completed, exercises_total, submitted_at),
        workout_assignments(athlete_id, athletes(full_name, group_name, level))`)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    if (!wData) { setLoading(false); return }
    const allFeedback = []
    wData.forEach(w => {
      const assigned = (w.workout_assignments || []).map(a => a.athletes).filter(Boolean)
      ;(w.workout_feedback || []).forEach(fb => allFeedback.push({ ...fb, workout_id: w.id, workout_name: w.name, assigned_athletes: assigned }))
    })
    allFeedback.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    setFeedback(allFeedback)
    setWorkouts(wData.filter(w => w.workout_feedback?.length > 0))
    setLoading(false)
  }

  const filtered = feedback.filter(fb => {
    if (filterWorkout !== 'all' && fb.workout_id !== filterWorkout) return false
    if (filterEmoji !== 'all' && fb.emoji_rating !== filterEmoji) return false
    return true
  })

  const totalFeedback = filtered.length
  const withRpe = filtered.filter(fb => fb.rpe)
  const avgRpe = withRpe.length > 0 ? (withRpe.reduce((s, fb) => s + fb.rpe, 0) / withRpe.length).toFixed(1) : null
  const emojiCounts = filtered.reduce((acc, fb) => { if (fb.emoji_rating) acc[fb.emoji_rating] = (acc[fb.emoji_rating] || 0) + 1; return acc }, {})
  const withNotes = filtered.filter(fb => fb.notes).length

  return (
    <Layout>
      {/* ── MOBILE HEADER ── */}
      {isMobile && (
        <div style={{ paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>History</div>
            <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 1 }}>{totalFeedback} response{totalFeedback !== 1 ? 's' : ''}</div>
          </div>
          {workouts.length > 1 && (
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '0 16px 10px' }}>
              <button onClick={() => setFilterWorkout('all')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: filterWorkout === 'all' ? 700 : 400, background: filterWorkout === 'all' ? 'var(--ac)' : 'var(--s2)', color: filterWorkout === 'all' ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>All</button>
              {workouts.map(w => (
                <button key={w.id} onClick={() => setFilterWorkout(w.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: filterWorkout === w.id ? 700 : 400, background: filterWorkout === w.id ? 'var(--ac)' : 'var(--s2)', color: filterWorkout === w.id ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px', maxWidth: 720 }}>
        {/* ── DESKTOP HEADER ── */}
        {!isMobile && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--font-head,sans-serif)' }}>History</h1>
            <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Athlete feedback from shared workouts</p>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : feedback.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No feedback yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Feedback appears here when athletes complete a shared workout</p>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Go to dashboard</button>
          </div>
        ) : (
          <>
            {/* ── STAT TILES ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { val: totalFeedback, lbl: 'Responses',     col: 'var(--ac)' },
                { val: avgRpe ?? '—', lbl: 'Avg RPE',       col: avgRpe ? RPE_COLOR(Number(avgRpe)) : 'var(--mu)' },
                { val: Object.entries(emojiCounts).sort((a,b)=>b[1]-a[1])[0] ? EMOJI_MAP[Object.entries(emojiCounts).sort((a,b)=>b[1]-a[1])[0][0]]?.icon ?? '—' : '—', lbl: 'Top feel', col: 'var(--tx)' },
                { val: withNotes,     lbl: 'With notes',    col: '#4F9EFF' },
              ].map(({ val, lbl, col }) => (
                <div key={lbl} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, marginBottom: 2, lineHeight: 1, fontFamily: 'var(--font-head,sans-serif)' }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{lbl}</div>
                </div>
              ))}
            </div>

            {/* ── FEEL BREAKDOWN BAR ── */}
            {totalFeedback > 0 && Object.keys(emojiCounts).length > 0 && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Feel breakdown</div>
                <div style={{ display: 'flex', gap: 3, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  {['easy','good','hard','veryhard'].map(key => {
                    const pct = totalFeedback > 0 ? ((emojiCounts[key]||0) / totalFeedback) * 100 : 0
                    return pct > 0 ? <div key={key} style={{ width:`${pct}%`, background: EMOJI_MAP[key].color, borderRadius: 2 }} /> : null
                  })}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {['easy','good','hard','veryhard'].map(key => {
                    const count = emojiCounts[key] || 0
                    if (!count) return null
                    const e = EMOJI_MAP[key]
                    return (
                      <button key={key} onClick={() => setFilterEmoji(filterEmoji === key ? 'all' : key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: filterEmoji === key ? 'var(--br2)' : 'transparent', border: 'none', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', opacity: filterEmoji !== 'all' && filterEmoji !== key ? 0.4 : 1 }}>
                        <span style={{ fontSize: 14 }}>{e.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--mu)' }}>{e.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: e.color }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── DESKTOP WORKOUT FILTER ── */}
            {!isMobile && workouts.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterWorkout('all')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterWorkout === 'all' ? 700 : 400, background: filterWorkout === 'all' ? 'var(--ac)' : 'var(--br)', color: filterWorkout === 'all' ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer' }}>All</button>
                {workouts.map(w => (
                  <button key={w.id} onClick={() => setFilterWorkout(w.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterWorkout === w.id ? 700 : 400, background: filterWorkout === w.id ? 'var(--ac)' : 'var(--br)', color: filterWorkout === w.id ? '#0C1118' : 'var(--mu)', border: 'none', cursor: 'pointer', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</button>
                ))}
              </div>
            )}

            {(filterWorkout !== 'all' || filterEmoji !== 'all') && (
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>
            )}

            {/* ── FEEDBACK FEED ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(fb => {
                const em = fb.emoji_rating ? EMOJI_MAP[fb.emoji_rating] : null
                const isExpanded = expandedId === fb.id
                const pct = fb.exercises_total > 0 ? (fb.exercises_completed / fb.exercises_total) * 100 : 0

                return (
                  <div key={fb.id} onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                    style={{ background: 'var(--s2)', border: `1px solid ${isExpanded ? 'var(--br2)' : 'var(--br)'}`, borderRadius: 14, padding: '13px 14px', cursor: 'pointer', transition: 'border-color .15s' }}>

                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fb.workout_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{timeAgo(fb.submitted_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                        {em && <span style={{ fontSize: 18 }}>{em.icon}</span>}
                        {fb.rpe && (
                          <div style={{ background: 'var(--br)', borderRadius: 8, padding: '3px 8px', display: 'flex', gap: 3, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--mu)' }}>RPE</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: RPE_COLOR(fb.rpe) }}>{fb.rpe}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpanded ? 12 : 0 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--br)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#5DD99A' : 'var(--ac)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0 }}>{fb.exercises_completed}/{fb.exercises_total}</span>
                    </div>

                    {/* Athlete chips row (always visible if assigned) */}
                    {!isExpanded && fb.assigned_athletes?.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                        {fb.assigned_athletes.slice(0, 4).map((a, i) => {
                          const av = avPal(a.full_name)
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--br)', borderRadius: 8, padding: '3px 8px' }}>
                              <div style={{ width: 16, height: 16, borderRadius: 5, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: av.color }}>{initials(a.full_name)}</div>
                              <span style={{ fontSize: 11, color: 'var(--mu2)' }}>{a.full_name.split(' ')[0]}</span>
                            </div>
                          )
                        })}
                        {fb.assigned_athletes.length > 4 && <span style={{ fontSize: 11, color: 'var(--mu)', alignSelf: 'center' }}>+{fb.assigned_athletes.length - 4} more</span>}
                      </div>
                    )}

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--br)', paddingTop: 12 }}>
                        {fb.notes && (
                          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Athlete note</div>
                            <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.6 }}>{fb.notes}</div>
                          </div>
                        )}
                        {fb.assigned_athletes?.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Assigned to</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {fb.assigned_athletes.map((a, i) => {
                                const av = avPal(a.full_name)
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--br)', borderRadius: 20, padding: '4px 10px' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 6, background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: av.color }}>{initials(a.full_name)}</div>
                                    <span style={{ fontSize: 12, color: 'var(--tx)' }}>{a.full_name}</span>
                                    {a.level && <span style={{ fontSize: 10, color: 'var(--mu)' }}>{a.level}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>Submitted {formatDate(fb.submitted_at)}</div>
                      </div>
                    )}

                    {!isExpanded && (fb.notes || fb.assigned_athletes?.length > 0) && (
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 8, opacity: .7 }}>
                        {[fb.notes && 'note', fb.assigned_athletes?.length > 0 && `${fb.assigned_athletes.length} athlete${fb.assigned_athletes.length !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')} · tap to expand
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
