import { supabase } from './supabase'

// What a bulk delete would change, for the confirmation sheet. The deletes
// themselves happen in the delete_workouts / delete_programs RPCs
// (supabase/migrations/0010_bulk_delete.sql); these reads only describe them.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function nameList(names) {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${plural(names.length - 2, 'other', 'others')}`
}

// What's about to be deleted, for the sheet's subtitle: up to three names.
export function describeSelection(names) {
  if (names.length <= 3) return names.length === 3 ? `${names[0]}, ${names[1]} and ${names[2]}` : names.join(' and ')
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

// Per workout: completions and distinct athletes (workout_feedback, which
// cascades on delete), assignments (also cascade) and program days that
// would be left without a workout.
export async function fetchWorkoutImpact(ids) {
  const [feedback, assignments, days] = await Promise.all([
    supabase.from('workout_feedback').select('workout_id, athlete_id, athlete_name').in('workout_id', ids),
    supabase.from('workout_assignments').select('workout_id').in('workout_id', ids),
    supabase.from('program_days').select('workout_id, programs(name)').in('workout_id', ids),
  ])
  const error = feedback.error || assignments.error || days.error
  if (error) throw error

  const impact = Object.fromEntries(ids.map(id => [id, { completions: 0, athletes: new Set(), assignments: 0, programDays: 0, programs: new Set() }]))
  feedback.data.forEach(r => {
    const x = impact[r.workout_id]
    x.completions += 1
    x.athletes.add(r.athlete_id || r.athlete_name || 'share link')
  })
  assignments.data.forEach(r => { impact[r.workout_id].assignments += 1 })
  days.data.forEach(r => {
    const x = impact[r.workout_id]
    x.programDays += 1
    x.programs.add(r.programs?.name || 'a program')
  })
  return impact
}

// The confirmation for deleting workouts. keepHistory skips workouts with
// athlete history, as delete_workouts does; historyOnly is Home's "Kept for
// athlete history" list, where history is the point and can't be kept.
export function workoutDeletePlan(workouts, impact, { keepHistory, historyOnly = false }) {
  const withHistory = workouts.filter(w => impact[w.id]?.completions > 0)
  const toDelete = keepHistory && !historyOnly ? workouts.filter(w => !(impact[w.id]?.completions > 0)) : workouts
  const sum = (list, key) => list.reduce((n, w) => n + (impact[w.id]?.[key] || 0), 0)
  const athleteCount = new Set(withHistory.flatMap(w => [...impact[w.id].athletes])).size
  const scheduled = toDelete.filter(w => impact[w.id]?.programDays > 0)
  const programNames = [...new Set(scheduled.flatMap(w => [...impact[w.id].programs]))]
  const assignmentCount = sum(toDelete, 'assignments')
  const rows = []

  if (withHistory.length) {
    const who = historyOnly
      ? (workouts.length === 1 ? 'It has' : 'They have')
      : `${nameList(withHistory.map(w => w.name))} ${withHistory.length === 1 ? 'has' : 'have'}`
    rows.push({
      tone: 'warn',
      text: `${who} athlete history: ${plural(sum(withHistory, 'completions'), 'completion', 'completions')} from ${plural(athleteCount, 'athlete', 'athletes')}. Deleting erases ${withHistory.length === 1 ? 'it' : 'them'} from History and streaks.`,
      toggle: historyOnly ? null : true,
    })
  }
  if (scheduled.length) {
    const dayCount = sum(scheduled, 'programDays')
    rows.push({
      tone: 'info',
      text: `${nameList(scheduled.map(w => w.name))} ${scheduled.length === 1 ? 'is' : 'are'} scheduled on ${plural(dayCount, 'day', 'days')} in ${nameList(programNames)}. ${dayCount === 1 ? 'That day is' : 'Those days are'} left without a workout.`,
    })
  }
  if (assignmentCount) {
    rows.push({ tone: 'muted', text: `Removes ${plural(assignmentCount, 'assignment', 'assignments')}. Those athletes lose the workout and its share link.` })
  }
  if (!rows.length) {
    rows.push({ tone: 'ok', text: `${workouts.length === 1 ? 'It isn’t' : 'None of these are'} assigned, scheduled in a program, or completed by an athlete.` })
  }

  return {
    toDelete,
    keptCount: workouts.length - toDelete.length,
    rows,
    confirmLabel: toDelete.length
      ? `Delete ${plural(toDelete.length, 'workout', 'workouts')}${historyOnly ? ` and ${toDelete.length === 1 ? 'its' : 'their'} history` : ''}`
      : 'Nothing to delete',
  }
}

// Per selection of programs: athletes who have one as their active program
// (cleared on delete) and the programs' generated workouts. delete_program
// keeps generated workouts with feedback or assignments.
export async function fetchProgramImpact(ids) {
  const [athletes, generated] = await Promise.all([
    supabase.from('athletes').select('full_name, active_program_id').in('active_program_id', ids),
    supabase.from('workouts').select('id, workout_feedback(id), workout_assignments(id)').in('source_program_id', ids),
  ])
  const error = athletes.error || generated.error
  if (error) throw error
  const kept = generated.data.filter(w => w.workout_feedback.length || w.workout_assignments.length).length
  return {
    athletes: athletes.data.map(a => a.full_name),
    generated: generated.data.length,
    kept,
  }
}

export function programDeletePlan(programs, impact) {
  const n = programs.length
  const rows = []
  if (impact.athletes.length) {
    rows.push({ tone: 'warn', text: `Active program for ${nameList(impact.athletes)}. They’ll have no program until you assign another.` })
  }
  if (impact.generated) {
    const deleted = impact.generated - impact.kept
    rows.push({
      tone: 'info',
      text: `${plural(deleted, 'program workout is', 'program workouts are')} deleted with ${n === 1 ? 'it' : 'them'}.` +
        (impact.kept ? ` ${plural(impact.kept, 'is', 'are')} kept because athletes completed or were assigned ${impact.kept === 1 ? 'it' : 'them'}; ${impact.kept === 1 ? 'it stays' : 'they stay'} under Home › Program workouts › Kept for athlete history.` : ''),
    })
  }
  rows.push({ tone: 'ok', text: `Hand-built workouts used in ${n === 1 ? 'this program' : 'these programs'} are never deleted.` })
  return { rows, confirmLabel: `Delete ${plural(n, 'program', 'programs')}` }
}
