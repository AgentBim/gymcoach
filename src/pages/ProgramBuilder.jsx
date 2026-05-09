import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Layout from '../components/Layout'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_TYPES = [
  { key: 'training',    icon: '💪', label: 'Training',   color: '#A8ED52', bg: 'rgba(168,237,82,.1)' },
  { key: 'rest',        icon: '😴', label: 'Rest',        color: '#6B7A96', bg: 'var(--br)' },
  { key: 'recovery',   icon: '🚶', label: 'Recovery',    color: '#6BB5F5', bg: 'rgba(80,150,230,.1)' },
  { key: 'competition',icon: '🏟', label: 'Competition', color: '#5DD99A', bg: 'rgba(50,200,140,.1)' },
]

function getDayType(key) { return DAY_TYPES.find(d => d.key === key) || DAY_TYPES[0] }

export default function ProgramBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState(4)
  const [days, setDays] = useState({}) // { 'w1d0': { day_type, workout_id, notes } }
  const [workouts, setWorkouts] = useState([])
  const [activeCell, setActiveCell] = useState(null) // 'w1d0'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewWeek, setViewWeek] = useState(1)

  useEffect(() => { fetchWorkouts() }, [user])
  useEffect(() => { if (isEdit) fetchProgram() }, [id])

  async function fetchWorkouts() {
    if (!user) return
    const { data } = await supabase.from('workouts').select('id, name').eq('coach_id', user.id).order('name')
    setWorkouts(data || [])
  }

  async function fetchProgram() {
    const { data: prog } = await supabase.from('programs').select('*').eq('id', id).single()
    if (!prog) return
    setName(prog.name)
    setDescription(prog.description || '')
    setWeeks(prog.duration_weeks)

    const { data: progDays } = await supabase.from('program_days').select('*').eq('program_id', id)
    const dayMap = {}
    ;(progDays || []).forEach(d => {
      dayMap[`w${d.week_number}d${d.day_of_week}`] = {
        day_type: d.day_type,
        workout_id: d.workout_id,
        notes: d.notes || '',
        db_id: d.id,
      }
    })
    setDays(dayMap)
  }

  function setCell(key, updates) {
    setDays(prev => ({ ...prev, [key]: { ...(prev[key] || { day_type: 'training', workout_id: null, notes: '' }), ...updates } }))
  }

  function clearCell(key) {
    setDays(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  async function save() {
    if (!name.trim()) { setError('Program name is required'); return }
    setSaving(true); setError('')
    let progId = id

    if (isEdit) {
      await supabase.from('programs').update({ name, description, duration_weeks: weeks }).eq('id', id)
      await supabase.from('program_days').delete().eq('program_id', id)
    } else {
      const { data: prog, error: pe } = await supabase.from('programs').insert({ coach_id: user.id, name, description, duration_weeks: weeks }).select().single()
      if (pe) { setError(pe.message); setSaving(false); return }
      progId = prog.id
    }

    const rows = Object.entries(days).map(([key, val]) => {
      const [wPart, dPart] = key.split('d')
      return {
        program_id: progId,
        week_number: parseInt(wPart.replace('w', '')),
        day_of_week: parseInt(dPart),
        day_type: val.day_type,
        workout_id: val.workout_id || null,
        notes: val.notes || null,
      }
    })

    if (rows.length) await supabase.from('program_days').insert(rows)
    navigate('/programs')
  }

  const weekData = Array.from({ length: weeks }, (_, i) => i + 1)

  // Desktop grid — 7 columns
  const renderWeekGrid = (week) => (
    <div key={week} style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
        Week {week}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {DAYS.map((day, di) => {
          const key = `w${week}d${di}`
          const cell = days[key]
          const dt = cell ? getDayType(cell.day_type) : null
          const workout = cell?.workout_id ? workouts.find(w => w.id === cell.workout_id) : null
          const isActive = activeCell === key
          return (
            <div key={di} onClick={() => setActiveCell(isActive ? null : key)}
              style={{
                background: cell ? dt.bg : 'var(--br)',
                border: `1px solid ${isActive ? 'var(--ac)' : cell ? 'rgba(255,255,255,.08)' : 'transparent'}`,
                borderRadius: 8, padding: '10px 6px', cursor: 'pointer', textAlign: 'center', minHeight: 72,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                transition: 'all .15s',
              }}>
              <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 500 }}>{day}</div>
              {cell ? (
                <>
                  <div style={{ fontSize: 18 }}>{dt.icon}</div>
                  {workout && <div style={{ fontSize: 9, color: dt.color, fontWeight: 500, lineHeight: 1.2 }}>{workout.name.length > 12 ? workout.name.slice(0, 12) + '…' : workout.name}</div>}
                  {!workout && cell.day_type !== 'training' && <div style={{ fontSize: 9, color: dt.color }}>{dt.label}</div>}
                </>
              ) : (
                <div style={{ fontSize: 16, color: 'var(--br2)' }}>+</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // Mobile list — each day as a full-width row
  const renderWeekList = (week) => (
    <div key={week}>
      {DAYS.map((day, di) => {
        const key = `w${week}d${di}`
        const cell = days[key]
        const dt = cell ? getDayType(cell.day_type) : DAY_TYPES[0]
        const workout = cell?.workout_id ? workouts.find(w => w.id === cell.workout_id) : null
        const isActive = activeCell === key
        return (
          <div key={di}>
            <div onClick={() => setActiveCell(isActive ? null : key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--br)', cursor: 'pointer',
              }}>
              <div style={{ width: 36, fontSize: 11, fontWeight: 600, color: 'var(--mu)', flexShrink: 0 }}>{day}</div>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                background: cell ? dt.bg : 'var(--br)', borderRadius: 10,
                padding: '10px 12px',
                border: `1px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 18 }}>{cell ? dt.icon : '+'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {cell ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: dt.color }}>{dt.label}</div>
                      {workout && <div style={{ fontSize: 12, color: 'var(--tx)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>}
                      {cell.notes && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{cell.notes}</div>}
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--mu)' }}>Tap to set</span>
                  )}
                </div>
                {cell && <div style={{ fontSize: 18, color: 'var(--mu)' }}>›</div>}
              </div>
            </div>
            {/* Inline cell editor on mobile */}
            {isActive && (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10, padding: 14, margin: '8px 0 4px' }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>Day type</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {DAY_TYPES.map(t => (
                    <button key={t.key} onClick={() => setCell(key, { day_type: t.key })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                        background: (cell?.day_type ?? 'training') === t.key ? t.bg : 'var(--br)',
                        color: (cell?.day_type ?? 'training') === t.key ? t.color : 'var(--mu)',
                        outline: (cell?.day_type ?? 'training') === t.key ? `1px solid ${t.color}` : 'none' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                {(cell?.day_type ?? 'training') === 'training' && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Workout</div>
                    <select value={cell?.workout_id || ''} onChange={e => setCell(key, { day_type: cell?.day_type || 'training', workout_id: e.target.value || null, notes: cell?.notes || '' })}
                      style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '9px 10px', fontSize: 13, outline: 'none', marginBottom: 10 }}>
                      <option value="">— no workout —</option>
                      {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveCell(null)} style={{ flex: 1, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                  {cell && <button onClick={() => { clearCell(key); setActiveCell(null) }} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#F88080', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ padding: isMobile ? '12px 16px' : '14px 20px', borderBottom: '1px solid var(--br)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/programs')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Program name..."
            style={{ flex: 1, background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 12px', fontSize: 15, fontWeight: 600, outline: 'none' }} />
          <button onClick={save} disabled={saving} style={{ background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Left: settings */}
          <div style={{ width: isMobile ? '100%' : 220, minWidth: isMobile ? 'auto' : 220, borderRight: isMobile ? 'none' : '1px solid var(--br)', borderBottom: isMobile ? '1px solid var(--br)' : 'none', padding: isMobile ? '12px 16px' : 14, background: 'var(--s1)' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 12 : 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ flex: isMobile ? '1 1 auto' : 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Description</div>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..."
                  style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, color: 'var(--tx)', padding: '7px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Weeks</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setWeeks(w => Math.max(1, w - 1))} style={{ width: 28, height: 28, background: 'var(--br)', border: 'none', borderRadius: 6, color: 'var(--tx)', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{weeks}</span>
                  <button onClick={() => setWeeks(w => Math.min(12, w + 1))} style={{ width: 28, height: 28, background: 'var(--br)', border: 'none', borderRadius: 6, color: 'var(--tx)', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: grid + cell editor */}
          <div style={{ flex: 1, padding: isMobile ? '12px 16px' : 20, overflowY: 'auto' }}>
            {/* Mobile week nav */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={() => setViewWeek(w => Math.max(1, w - 1))} disabled={viewWeek === 1} style={{ background: 'var(--br)', border: 'none', borderRadius: 7, color: 'var(--tx)', padding: '6px 12px', fontSize: 13, cursor: 'pointer', opacity: viewWeek === 1 ? 0.4 : 1 }}>← Prev</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Week {viewWeek} of {weeks}</span>
                <button onClick={() => setViewWeek(w => Math.min(weeks, w + 1))} disabled={viewWeek === weeks} style={{ background: 'var(--br)', border: 'none', borderRadius: 7, color: 'var(--tx)', padding: '6px 12px', fontSize: 13, cursor: 'pointer', opacity: viewWeek === weeks ? 0.4 : 1 }}>Next →</button>
              </div>
            )}

            {/* Grids (desktop) / List (mobile) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isMobile ? renderWeekList(viewWeek) : weekData.map(w => renderWeekGrid(w))}
            </div>

            {/* Cell editor panel — desktop only */}
            {!isMobile && activeCell && (
              <div style={{ marginTop: 16, background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14 }}>
                {(() => {
                  const [wPart, dPart] = activeCell.split('d')
                  const week = parseInt(wPart.replace('w', ''))
                  const dayIdx = parseInt(dPart)
                  const cell = days[activeCell] || { day_type: 'training', workout_id: null, notes: '' }
                  const dt = getDayType(cell.day_type)
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 12 }}>
                        Week {week} · {DAYS[dayIdx]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Day type</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {DAY_TYPES.map(t => (
                          <button key={t.key} onClick={() => setCell(activeCell, { day_type: t.key })}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                              background: cell.day_type === t.key ? t.bg : 'var(--br)',
                              color: cell.day_type === t.key ? t.color : 'var(--mu)',
                              outline: cell.day_type === t.key ? `1px solid ${t.color}` : 'none' }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                      {cell.day_type === 'training' && (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Workout</div>
                          <select value={cell.workout_id || ''} onChange={e => setCell(activeCell, { workout_id: e.target.value || null })}
                            style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none', marginBottom: 10 }}>
                            <option value="">— no workout assigned —</option>
                            {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 7 }}>Notes</div>
                      <input value={cell.notes || ''} onChange={e => setCell(activeCell, { notes: e.target.value })}
                        placeholder="Optional note for this day..."
                        style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setActiveCell(null)} style={{ flex: 1, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                        {days[activeCell] && <button onClick={() => { clearCell(activeCell); setActiveCell(null) }} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 8, color: '#F88080', padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Clear</button>}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {error && <p style={{ fontSize: 12, color: '#F88080', marginTop: 10 }}>{error}</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
