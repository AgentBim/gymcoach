import { useState, useEffect } from 'react'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { useAthleteStreak } from '../../hooks/useAthleteStreak'
import { supabase } from '../../lib/supabase'

const EMOJI_MAP = {
  easy:     { icon: '😴', label: 'Too easy',   color: '#6BB5F5' },
  good:     { icon: '😊', label: 'Good',        color: '#5DD99A' },
  hard:     { icon: '💪', label: 'Challenging', color: '#F4B455' },
  veryhard: { icon: '🔥', label: 'Very hard',   color: '#F88080' },
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function AthleteHistory() {
  const { athlete } = useAthleteAuth()
  const { streak, loading: streakLoading } = useAthleteStreak(athlete?.id)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (athlete) fetchLogs() }, [athlete])

  async function fetchLogs() {
    const { data } = await supabase
      .from('workout_feedback')
      .select('id, rpe, emoji_rating, notes, completed_date, submitted_at, workouts(name)')
      .eq('athlete_id', athlete.id)
      .order('submitted_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  const withRpe = logs.filter(l => l.rpe)
  const avgRpe = withRpe.length > 0 ? (withRpe.reduce((s, l) => s + l.rpe, 0) / withRpe.length).toFixed(1) : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { val: logs.length, lbl: 'Workouts', col: 'var(--ac)' },
          { val: avgRpe ?? '—', lbl: 'Avg RPE', col: '#4F9EFF' },
          { val: streakLoading ? '—' : streak, lbl: 'Day streak', col: '#FFA94D' },
        ].map(({ val, lbl, col }) => (
          <div key={lbl} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: col, marginBottom: 2 }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--mu)' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 30 }}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mu)' }}>
          <p style={{ fontSize: 14 }}>No workouts logged yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map(l => {
            const em = l.emoji_rating ? EMOJI_MAP[l.emoji_rating] : null
            return (
              <div key={l.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{l.workouts?.name || 'Workout'}</span>
                  {em && <span style={{ fontSize: 16 }}>{em.icon}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>
                  {formatDate(l.completed_date || l.submitted_at)}{l.rpe ? ` · RPE ${l.rpe}` : ''}
                </div>
                {l.notes && <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 6, lineHeight: 1.5 }}>{l.notes}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
