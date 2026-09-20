import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { supabase } from '../../lib/supabase'
import { resolveProgramCell, todayLocal } from '../../lib/streaks'
import { DAY_TYPE_COLORS } from '../../lib/theme'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AthleteProgram() {
  const { athlete } = useAthleteAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [daysByCell, setDaysByCell] = useState(new Map())
  const [workoutsById, setWorkoutsById] = useState(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (athlete) fetchProgram() }, [athlete])

  async function fetchProgram() {
    if (!athlete.active_program_id) { setLoading(false); return }

    const { data: prog } = await supabase.from('programs').select('*').eq('id', athlete.active_program_id).single()
    const { data: days } = await supabase.from('program_days').select('*, workouts(id, name)').eq('program_id', athlete.active_program_id)

    const cellMap = new Map()
    const wMap = new Map()
    ;(days || []).forEach(d => {
      cellMap.set(`${d.week_number}:${d.day_of_week}`, d)
      if (d.workouts) wMap.set(d.workouts.id, d.workouts)
    })

    setProgram(prog)
    setDaysByCell(cellMap)
    setWorkoutsById(wMap)
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading...</div>

  if (!program || !athlete.program_started_on) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>📅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Not on a program right now</div>
        <p style={{ fontSize: 13, color: 'var(--mu)' }}>Ask your coach if you should be on one — every day counts toward your streak until then.</p>
      </div>
    )
  }

  const today = todayLocal()
  const { week_number: currentWeek, day_of_week: todayDow } = resolveProgramCell(athlete.program_started_on, program.duration_weeks, today)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', fontFamily: 'var(--font-head)' }}>{program.name}</div>
        <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>Week {currentWeek} of {program.duration_weeks}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAYS.map((label, dayIdx) => {
          const cell = daysByCell.get(`${currentWeek}:${dayIdx}`)
          const workout = cell?.workout_id ? workoutsById.get(cell.workout_id) : null
          const dayType = cell?.day_type || 'rest'
          const meta = DAY_TYPE_COLORS[dayType] || DAY_TYPE_COLORS.rest
          const isToday = todayDow === dayIdx
          const clickable = !!workout

          return (
            <div key={dayIdx} onClick={() => clickable && navigate(`/athlete/program/${workout.id}`)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: isToday ? 'rgba(199,228,92,.08)' : 'var(--s2)',
              border: `1px solid ${isToday ? 'rgba(199,228,92,.35)' : 'var(--br)'}`,
              borderRadius: 12, cursor: clickable ? 'pointer' : 'default',
            }}>
              <div style={{ width: 34, fontSize: 12, fontWeight: 700, color: isToday ? 'var(--ac)' : 'var(--mu)' }}>{label}</div>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                {meta.icon} {meta.label}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {workout && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>}
                {cell?.notes && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{cell.notes}</div>}
              </div>
              {isToday && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ac)', background: 'rgba(199,228,92,.15)', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>Today</span>}
              {clickable && <span style={{ color: 'var(--mu)', fontSize: 13, flexShrink: 0 }}>›</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
