// Supabase-backed wrapper around streaks.js: fetches what's needed to
// evaluate an athlete's (or a roster's worth of athletes') streak, advances
// the cache, persists it, and returns the number to display. Both the
// athlete portal and coach views go through this so their numbers can't
// drift apart from each other or from the underlying rule.
import { supabase } from './supabase'
import { advanceStreakCache, isDueOnDate, displayStreak, todayLocal, shiftDateStr } from './streaks'

async function fetchProgramDaysByProgramIds(programIds) {
  const map = new Map() // programId -> Map(cellKey -> { workout_id })
  if (programIds.length === 0) return map
  const { data } = await supabase
    .from('program_days')
    .select('program_id, week_number, day_of_week, workout_id')
    .in('program_id', programIds)
  ;(data || []).forEach(d => {
    if (!map.has(d.program_id)) map.set(d.program_id, new Map())
    map.get(d.program_id).set(`${d.week_number}:${d.day_of_week}`, { workout_id: d.workout_id })
  })
  return map
}

async function fetchCompletedDatesByAthleteIds(athleteIds) {
  const map = new Map() // athleteId -> Set(dateStr)
  if (athleteIds.length === 0) return map
  const { data } = await supabase
    .from('workout_feedback')
    .select('athlete_id, completed_date')
    .in('athlete_id', athleteIds)
    .not('completed_date', 'is', null)
  ;(data || []).forEach(row => {
    if (!map.has(row.athlete_id)) map.set(row.athlete_id, new Set())
    map.get(row.athlete_id).add(row.completed_date)
  })
  return map
}

/**
 * athleteRows: [{ id, active_program_id, program_started_on, current_streak, streak_last_computed_date }]
 * programsById: Map(program_id -> { id, duration_weeks })
 * Returns Map(athleteId -> { streak, todayDue, todayWorkoutId, todayLogged }).
 * Fire-and-forgets a persist of any athlete whose cache advanced.
 */
export async function batchComputeStreaks(athleteRows, programsById) {
  const ids = athleteRows.map(a => a.id)
  const programIds = [...new Set(athleteRows.map(a => a.active_program_id).filter(Boolean))]
  const [programDaysMap, completedMap] = await Promise.all([
    fetchProgramDaysByProgramIds(programIds),
    fetchCompletedDatesByAthleteIds(ids),
  ])

  const today = todayLocal()
  const yesterday = shiftDateStr(today, -1)
  const result = new Map()
  const toPersist = []

  for (const a of athleteRows) {
    const program = a.active_program_id ? programsById.get(a.active_program_id) : null
    const cellMap = program ? (programDaysMap.get(a.active_program_id) || new Map()) : new Map()
    const dueCheck = (dateStr) => isDueOnDate(dateStr, program, a.program_started_on, cellMap)
    const completedDates = completedMap.get(a.id) || new Set()

    const advance = advanceStreakCache({
      cachedStreak: a.current_streak || 0,
      lastComputedDate: a.streak_last_computed_date,
      throughDate: yesterday,
      completedDates,
      dueCheck,
    })

    const { due: todayDue, workoutId: todayWorkoutId } = dueCheck(today)
    const todayLogged = completedDates.has(today)
    const streak = displayStreak(advance.streak, todayDue, todayLogged)

    result.set(a.id, { streak, todayDue, todayWorkoutId, todayLogged })

    if (advance.streak !== (a.current_streak || 0) || advance.lastComputedDate !== a.streak_last_computed_date) {
      toPersist.push({ id: a.id, current_streak: advance.streak, streak_last_computed_date: advance.lastComputedDate })
    }
  }

  if (toPersist.length > 0) {
    supabase.from('athletes').upsert(toPersist).then(({ error }) => {
      if (error) console.error('Failed to persist streak cache', error)
    })
  }

  return result
}

/** Convenience wrapper for a single athlete (portal / profile views). */
export async function computeSingleAthleteStreak(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, active_program_id, program_started_on, current_streak, streak_last_computed_date, programs:active_program_id(id, duration_weeks)')
    .eq('id', athleteId)
    .single()

  if (!athlete) return null

  const program = athlete.programs || null
  const programsById = new Map(program ? [[program.id, program]] : [])
  const row = {
    id: athlete.id,
    active_program_id: athlete.active_program_id,
    program_started_on: athlete.program_started_on,
    current_streak: athlete.current_streak,
    streak_last_computed_date: athlete.streak_last_computed_date,
  }
  const results = await batchComputeStreaks([row], programsById)
  return results.get(athleteId)
}
