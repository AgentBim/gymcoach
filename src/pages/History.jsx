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

const RPE_COLOR = (rpe) => {
  if (rpe <= 3) return '#6BB5F5'
  if (rpe <= 5) return '#5DD99A'
  if (rpe <= 7) return '#F4B455'
  return '#F88080'
}

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

export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [feedback, setFeedback] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  const [filterWorkout, setFilterWorkout] = useState('all')
  const [filterEmoji, setFilterEmoji] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { fetchData() }, [user])

  async function fetchData() {
    if (!user) return

    // Get all coach workouts with their feedback and assignments
    const { data: wData } = await supabase
      .from('workouts')
      .select(`
        id, name, share_token,
        workout_feedback(id, emoji_rating, rpe, notes, exercises_completed, exercises_total, submitted_at),
        workout_assignments(athlete_id, athletes(full_name, group_name, level))
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (!wData) { setLoading(false); return }

    // Flatten feedback with workout context
    const allFeedback = []
    wData.forEach(w => {
      const assignedAthletes = (w.workout_assignments || []).map(a => a.athletes).filter(Boolean)
      ;(w.workout_feedback || []).forEach(fb => {
        allFeedback.push({
          ...fb,
          workout_id: w.id,
          workout_name: w.name,
          assigned_athletes: assignedAthletes,
        })
      })
    })

    // Sort by most recent
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

  // Summary stats
  const totalFeedback = filtered.length
  const withRpe = filtered.filter(fb => fb.rpe)
  const avgRpe = withRpe.length > 0
    ? (withRpe.reduce((s, fb) => s + fb.rpe, 0) / withRpe.length).toFixed(1)
    : null
  const emojiCounts = filtered.reduce((acc, fb) => {
    if (fb.emoji_rating) acc[fb.emoji_rating] = (acc[fb.emoji_rating] || 0) + 1
    return acc
  }, {})
  const withNotes = filtered.filter(fb => fb.notes).length

  return (
    <Layout>
      {/* Mobile header */}
      {isMobile && (
        <div style={{ padding: '14px 16px 12px', paddingTop: 'max(14px, calc(var(--sat) + 6px))', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>Feedback history</div>
          <div style={{ fontSize: 12, color: 'var(--mu)' }}>{totalFeedback} response{totalFeedback !== 1 ? 's' : ''}</div>
        </div>
      )}

      <div style={{ padding: isMobile ? '14px 16px' : '20px 24px', maxWidth: 720 }}>

        {/* Desktop header */}
        {!isMobile && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Feedback history</h1>
            <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>Athlete responses from shared workouts</p>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : feedback.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>No feedback yet</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Feedback appears here when athletes complete a shared workout</p>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Go to dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{totalFeedback}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Total responses</div>
              </div>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: avgRpe ? RPE_COLOR(Number(avgRpe)) : 'var(--mu)', marginBottom: 2 }}>
                  {avgRpe ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Avg RPE</div>
              </div>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>
                  {Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0]
                    ? EMOJI_MAP[Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0][0]]?.icon ?? '—'
                    : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Most common feel</div>
              </div>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{withNotes}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>With notes</div>
              </div>
            </div>

            {/* Emoji breakdown bar */}
            {totalFeedback > 0 && Object.keys(emojiCounts).length > 0 && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Feel breakdown</div>
                <div style={{ display: 'flex', gap: 4, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  {['easy', 'good', 'hard', 'veryhard'].map(key => {
                    const count = emojiCounts[key] || 0
                    const pct = totalFeedback > 0 ? (count / totalFeedback) * 100 : 0
                    if (pct === 0) return null
                    return <div key={key} style={{ width: `${pct}%`, background: EMOJI_MAP[key].color, borderRadius: 2 }} />
                  })}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {['easy', 'good', 'hard', 'veryhard'].map(key => {
                    const count = emojiCounts[key] || 0
                    if (count === 0) return null
                    const e = EMOJI_MAP[key]
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 14 }}>{e.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--mu)' }}>{e.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: e.color }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <select value={filterWorkout} onChange={e => setFilterWorkout(e.target.value)}
                style={{ background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '7px 11px', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="all">All workouts</option>
                {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => setFilterEmoji('all')} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', background: filterEmoji === 'all' ? 'var(--ac)' : 'var(--br)', color: filterEmoji === 'all' ? '#0C1118' : 'var(--mu)' }}>All</button>
                {Object.entries(EMOJI_MAP).map(([key, e]) => (
                  <button key={key} onClick={() => setFilterEmoji(filterEmoji === key ? 'all' : key)}
                    style={{ padding: '6px 10px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer', background: filterEmoji === key ? 'var(--br2)' : 'var(--br)', opacity: filterEmoji !== 'all' && filterEmoji !== key ? 0.5 : 1 }}>
                    {e.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback count after filter */}
            {(filterWorkout !== 'all' || filterEmoji !== 'all') && (
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>
            )}

            {/* Feedback feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(fb => {
                const em = fb.emoji_rating ? EMOJI_MAP[fb.emoji_rating] : null
                const isExpanded = expandedId === fb.id
                return (
                  <div key={fb.id}
                    onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                    style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '13px 14px', cursor: 'pointer', transition: 'border-color .15s', borderColor: isExpanded ? 'var(--br2)' : 'var(--br)' }}>

                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fb.workout_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{timeAgo(fb.submitted_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {em && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 18 }}>{em.icon}</span>
                            <span style={{ fontSize: 11, color: em.color, fontWeight: 500 }}>{em.label}</span>
                          </div>
                        )}
                        {fb.rpe && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--br)', borderRadius: 8, padding: '3px 8px' }}>
                            <span style={{ fontSize: 11, color: 'var(--mu)' }}>RPE</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: RPE_COLOR(fb.rpe) }}>{fb.rpe}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpanded ? 12 : 0 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--br)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${fb.exercises_total > 0 ? (fb.exercises_completed / fb.exercises_total) * 100 : 0}%`, height: '100%', background: 'var(--ac)', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--mu)', flexShrink: 0 }}>
                        {fb.exercises_completed}/{fb.exercises_total} exercises
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--br)', paddingTop: 12 }}>
                        {/* Notes */}
                        {fb.notes && (
                          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Athlete note</div>
                            <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.6 }}>{fb.notes}</div>
                          </div>
                        )}

                        {/* Assigned athletes */}
                        {fb.assigned_athletes?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                              Assigned to
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {fb.assigned_athletes.map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--br)', borderRadius: 20, padding: '4px 10px' }}>
                                  <div style={{ width: 18, height: 18, background: 'rgba(168,237,82,.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: 'var(--ac)' }}>
                                    {a.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <span style={{ fontSize: 12, color: 'var(--tx)' }}>{a.full_name}</span>
                                  {a.level && <span style={{ fontSize: 10, color: 'var(--mu)' }}>{a.level}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timestamp */}
                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--mu)' }}>
                          Submitted {formatDate(fb.submitted_at)}
                        </div>
                      </div>
                    )}

                    {/* Expand hint */}
                    {!isExpanded && (fb.notes || fb.assigned_athletes?.length > 0) && (
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8 }}>
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
