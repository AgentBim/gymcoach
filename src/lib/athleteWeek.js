// What one athlete's week looks like to the coach: each day's plan (program or
// personal override), whether it was done, and the headline stats. Pure, built
// on streaks.js#resolveDay so it agrees with the portal and the streak.
import { resolveDay, resolveProgramCell, shiftDateStr } from './streaks'
import { mondayOfStr, DAY_SHORT, DAY_LONG, fmtMonthDay } from './dates'

/**
 * @param monday   'YYYY-MM-DD' of the Monday to show
 * @param feedbackByDate Map(date -> feedback row) (the first/latest per date is fine)
 * @param overrides Map(date -> { day_type, workout_id, notes }) | undefined
 * @param ignoreOverrideDates Set(date) whose override should be ignored (a pending revert)
 * @returns 7 days: { date, label, long, num, kind, source, dayType, workoutId, notes, status, log, adjusted }
 *   status: done | missed | due | scheduled | optional | rest
 */
export function buildWeek({ monday, athlete, program, cells, overrides, feedbackByDate, today, ignoreOverrideDates = new Set() }) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDateStr(monday, i)
    const ov = overrides && !ignoreOverrideDates.has(date) ? overrides : undefined
    const d = resolveDay(date, program, athlete.program_started_on, cells, ov)
    const log = feedbackByDate.get(date) || null
    let status
    if (log) status = 'done'
    else if (d.kind === 'due') status = date < today ? 'missed' : date === today ? 'due' : 'scheduled'
    else if (d.kind === 'optional') status = 'optional'
    else status = 'rest'
    return {
      date, label: DAY_SHORT[i], long: DAY_LONG[i], num: Number(date.slice(8)),
      kind: d.kind, source: d.source, dayType: d.dayType, workoutId: d.workoutId, notes: d.notes,
      status, log, adjusted: d.source === 'override',
    }
  })
}

/** 'Week 2 of 4' info for the Monday, or null when the athlete has no program / hasn't started. */
export function programWeekOf(athlete, program, monday) {
  if (!program || !athlete.program_started_on) return null
  if (monday < mondayOfStr(athlete.program_started_on)) return null
  return resolveProgramCell(athlete.program_started_on, program.duration_weeks, monday).week_number
}

export function weekRange(monday) {
  const sunday = shiftDateStr(monday, 6)
  return `${fmtMonthDay(monday)} – ${monday.slice(5, 7) === sunday.slice(5, 7) ? Number(sunday.slice(8)) : fmtMonthDay(sunday)}`
}

/**
 * Headline stats for the hub. `feedback` is every completion for the athlete.
 * followThrough: completed due days / due days over the last 28 days (null when nothing was due).
 */
export function athleteStats({ feedback, athlete, program, cells, overrides, today }) {
  const dates = new Set(feedback.map(f => f.completed_date).filter(Boolean))
  const month = today.slice(0, 7)
  const doneThisMonth = [...dates].filter(d => d.startsWith(month)).length

  const since = shiftDateStr(today, -29)
  const rpes = feedback.filter(f => f.rpe && f.completed_date && f.completed_date >= since).map(f => f.rpe)
  const avgRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null

  let dueDays = 0
  let doneDue = 0
  for (let i = 1; i <= 28; i++) {
    const date = shiftDateStr(today, -i)
    if (program && athlete.program_started_on && date < athlete.program_started_on) break
    const d = resolveDay(date, program, athlete.program_started_on, cells, overrides)
    if (d.kind !== 'due') continue
    dueDays++
    if (dates.has(date)) doneDue++
  }
  const followThrough = dueDays ? Math.round((doneDue / dueDays) * 100) : null
  return { doneThisMonth, avgRpe, followThrough }
}

/** Sessions done and average RPE for the last `n` weeks, oldest first, ending with the current week. */
export function weeklyTrend({ feedback, today, n = 5 }) {
  const thisMonday = mondayOfStr(today)
  return Array.from({ length: n }, (_, k) => {
    const monday = shiftDateStr(thisMonday, -7 * (n - 1 - k))
    const end = shiftDateStr(monday, 6)
    const inWeek = feedback.filter(f => f.completed_date && f.completed_date >= monday && f.completed_date <= end)
    const rpes = inWeek.filter(f => f.rpe).map(f => f.rpe)
    return {
      monday, label: fmtMonthDay(monday), sessions: new Set(inWeek.map(f => f.completed_date)).size,
      rpe: rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '–',
      current: k === n - 1,
    }
  })
}

/** Done / total scheduled sessions in the current pass through the program. */
export function programProgress({ athlete, program, cells, completedDates, today }) {
  if (!program || !athlete.program_started_on || athlete.program_started_on > today) return null
  const total = [...cells.values()].filter(c => c.workout_id && (c.day_type || 'training') === 'training').length
  const startMonday = mondayOfStr(athlete.program_started_on)
  const diffWeeks = Math.round((new Date(mondayOfStr(today) + 'T00:00:00') - new Date(startMonday + 'T00:00:00')) / (7 * 86400000))
  const cycleStart = shiftDateStr(startMonday, Math.floor(diffWeeks / program.duration_weeks) * program.duration_weeks * 7)
  const done = [...completedDates].filter(d => d >= cycleStart && d <= today).length
  return { done, total, week: resolveProgramCell(athlete.program_started_on, program.duration_weeks, today).week_number }
}
