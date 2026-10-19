// One athlete's schedule inputs (program, its cells, personal overrides) plus
// the workout names they reference. Used where a screen needs "what is X
// doing on date D" for a single athlete, e.g. a schedule request in the Inbox.
import { supabase } from './supabase'
import { resolveDay } from './streaks'

export async function loadAthleteSchedule(athleteId) {
  const { data: athlete } = await supabase.from('athletes').select('id, full_name, active_program_id, program_started_on, current_streak').eq('id', athleteId).single()
  if (!athlete) return null
  const [progRes, daysRes, ovRes] = await Promise.all([
    athlete.active_program_id ? supabase.from('programs').select('id, name, duration_weeks').eq('id', athlete.active_program_id).single() : Promise.resolve({ data: null }),
    athlete.active_program_id
      ? supabase.from('program_days').select('week_number, day_of_week, day_type, workout_id, notes, workouts(id, name)').eq('program_id', athlete.active_program_id)
      : Promise.resolve({ data: [] }),
    supabase.from('athlete_day_overrides').select('date, day_type, workout_id, notes, workouts(id, name)').eq('athlete_id', athleteId),
  ])
  const cells = new Map()
  const names = {}
  ;(daysRes.data || []).forEach(d => {
    cells.set(`${d.week_number}:${d.day_of_week}`, { workout_id: d.workout_id, day_type: d.day_type, notes: d.notes })
    if (d.workouts) names[d.workouts.id] = d.workouts.name
  })
  const overrides = new Map()
  ;(ovRes.data || []).forEach(o => {
    overrides.set(o.date, { day_type: o.day_type, workout_id: o.workout_id, notes: o.notes })
    if (o.workouts) names[o.workouts.id] = o.workouts.name
  })
  return { athlete, program: progRes.data || null, cells, overrides, names }
}

/** What the athlete is scheduled to do on a date: { kind, workoutId, name }. */
export function planFor(schedule, date) {
  const d = resolveDay(date, schedule.program, schedule.athlete.program_started_on, schedule.cells, schedule.overrides)
  return { kind: d.kind, workoutId: d.workoutId, name: d.workoutId ? schedule.names[d.workoutId] || 'Workout' : '' }
}
