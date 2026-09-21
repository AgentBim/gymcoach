// Single source of truth for the "is a day due, and what's the current streak"
// rule. Athlete portal and coach views must both go through this module so
// they can never disagree — see the feature spec for the full rule writeup.
//
// A calendar day is DUE for an athlete if:
//  - they're on an active program and that program's schedule for that
//    weekday has a workout attached, or
//  - they're not on any active program (every day is due).
// Walking backward from today: a due day that's logged continues the streak,
// a due day with nothing logged breaks it, a non-due day is skipped (neither
// extends nor breaks), and today is never itself a break condition.

export const DUE_STATUS = { DUE: 'due', NOT_DUE: 'not_due' }

function toDateOnly(d) {
  const date = d instanceof Date ? d : new Date(d + 'T00:00:00')
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateOnly(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocal() {
  return formatDateOnly(new Date())
}

function addDays(dateOnly, n) {
  const d = new Date(dateOnly)
  d.setDate(d.getDate() + n)
  return d
}

export function shiftDateStr(dateStr, n) {
  return formatDateOnly(addDays(toDateOnly(dateStr), n))
}

function mondayOf(dateOnly) {
  const d = new Date(dateOnly)
  const dow = (d.getDay() + 6) % 7 // Mon=0..Sun=6
  d.setDate(d.getDate() - dow)
  return d
}

// Mon=0..Sun=6, matching ProgramBuilder's DAYS array and program_days.day_of_week.
function weekdayIndex(dateOnly) {
  return (dateOnly.getDay() + 6) % 7
}

/**
 * Resolve which (week_number, day_of_week) cell of a program applies to a
 * given calendar date, cycling the schedule once the athlete has been on it
 * longer than duration_weeks. Weeks are calendar weeks (Monday-start),
 * anchored to the Monday of the week the athlete started the program.
 */
export function resolveProgramCell(programStartedOn, durationWeeks, dateStr) {
  const date = toDateOnly(dateStr)
  const startMonday = mondayOf(toDateOnly(programStartedOn))
  const targetMonday = mondayOf(date)
  const diffWeeks = Math.round((targetMonday - startMonday) / (7 * 86400000))
  const cyclic = ((diffWeeks % durationWeeks) + durationWeeks) % durationWeeks
  return { week_number: cyclic + 1, day_of_week: weekdayIndex(date) }
}

/**
 * Was `dateStr` a due day for this athlete?
 *
 * @param dateStr 'YYYY-MM-DD'
 * @param activeProgram { id, duration_weeks } or null/undefined
 * @param programStartedOn 'YYYY-MM-DD' or null — required if activeProgram is set
 * @param programDaysByCell Map keyed by `${week_number}:${day_of_week}` -> { workout_id }
 *   (only cells for the athlete's active program need to be present)
 * @returns { due: boolean, workoutId: string|null }
 */
export function isDueOnDate(dateStr, activeProgram, programStartedOn, programDaysByCell) {
  if (!activeProgram || !programStartedOn) {
    return { due: true, workoutId: null } // no program = plain daily streak
  }
  // Dates before the athlete started this program aren't evaluated against
  // it (v1 simplification — see spec's "program changes mid-stream" note).
  if (toDateOnly(dateStr) < toDateOnly(programStartedOn)) {
    return { due: true, workoutId: null }
  }
  const { week_number, day_of_week } = resolveProgramCell(programStartedOn, activeProgram.duration_weeks, dateStr)
  const cell = programDaysByCell.get(`${week_number}:${day_of_week}`)
  if (cell && cell.workout_id) return { due: true, workoutId: cell.workout_id }
  return { due: false, workoutId: null } // rest day, or a day with nothing attached
}

/**
 * Walk backward from `today` (exclusive) computing how many *elapsed* due
 * days in a row were logged, stopping at the first missed due day or when
 * running out of history. Does not look at today itself — callers layer
 * "is today due and already logged" on top separately, since today is never
 * a break condition.
 *
 * @param today 'YYYY-MM-DD'
 * @param completedDates Set of 'YYYY-MM-DD' strings the athlete logged a completion on
 * @param dueCheck (dateStr) => { due, workoutId } — e.g. bind isDueOnDate's other args
 * @param maxDays safety bound on how far back to walk (default ~5 years)
 */
export function walkBackwardStreak(today, completedDates, dueCheck, maxDays = 1825) {
  let streak = 0
  let cursor = toDateOnly(today)
  for (let i = 0; i < maxDays; i++) {
    cursor = addDays(cursor, -1)
    const dateStr = formatDateOnly(cursor)
    const { due } = dueCheck(dateStr)
    if (!due) continue // skipped, doesn't break or extend
    if (completedDates.has(dateStr)) streak += 1
    else break // due day, nothing logged -> streak stops here
  }
  return streak
}

/**
 * Incrementally advance a cached streak from `lastComputedDate` (exclusive,
 * or null for "never computed") through `throughDate` (inclusive), which
 * should be the last *fully elapsed* day (i.e. yesterday, never today).
 * Returns the same shape whether or not any advancing was needed.
 */
export function advanceStreakCache({ cachedStreak, lastComputedDate, throughDate, completedDates, dueCheck, maxDays = 1825 }) {
  if (lastComputedDate && toDateOnly(lastComputedDate) >= toDateOnly(throughDate)) {
    return { streak: cachedStreak, lastComputedDate }
  }
  if (!lastComputedDate) {
    // Never computed before: full walk-backward from the day after throughDate.
    const streak = walkBackwardStreak(formatDateOnly(addDays(toDateOnly(throughDate), 1)), completedDates, dueCheck, maxDays)
    return { streak, lastComputedDate: throughDate }
  }
  let streak = cachedStreak
  let cursor = toDateOnly(lastComputedDate)
  const end = toDateOnly(throughDate)
  for (let i = 0; i < maxDays && cursor < end; i++) {
    cursor = addDays(cursor, 1)
    const dateStr = formatDateOnly(cursor)
    const { due } = dueCheck(dateStr)
    if (!due) continue
    if (completedDates.has(dateStr)) streak += 1
    else streak = 0
  }
  return { streak, lastComputedDate: throughDate }
}

/**
 * The number to actually display: the persisted cache (accurate through
 * yesterday) plus 1 if today is itself a due day that's already been logged.
 * Today never subtracts from the streak — an undecided due day just isn't
 * added yet.
 */
export function displayStreak(cachedStreak, todayDue, todayLogged) {
  return cachedStreak + (todayDue && todayLogged ? 1 : 0)
}
