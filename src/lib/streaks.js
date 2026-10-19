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
 * What does the schedule say for `dateStr`? One place decides, in this order:
 *   1. a personal override for that date (athlete_day_overrides),
 *   2. the athlete's program cell for that weekday,
 *   3. no program: every day is a plain due day.
 * kind: 'due' (training day, breaks the streak if missed), 'optional' (recovery
 * day with a workout: counts if logged, never breaks), 'rest'.
 *
 * @param programDaysByCell Map keyed by `${week_number}:${day_of_week}` -> { workout_id, day_type?, notes? }
 *   (only cells for the athlete's active program need to be present)
 * @param overridesByDate Map keyed by 'YYYY-MM-DD' -> { day_type, workout_id, notes } (optional)
 * @returns { kind, source: 'override'|'program'|'free', dayType, workoutId, notes }
 */
export function resolveDay(dateStr, activeProgram, programStartedOn, programDaysByCell, overridesByDate) {
  const ov = overridesByDate && overridesByDate.get(dateStr)
  if (ov) return classify(ov, 'override')

  if (!activeProgram || !programStartedOn) {
    return { kind: 'due', source: 'free', dayType: 'training', workoutId: null, notes: null } // no program = plain daily streak
  }
  // Dates before the athlete started this program aren't evaluated against
  // it (v1 simplification — see spec's "program changes mid-stream" note).
  if (toDateOnly(dateStr) < toDateOnly(programStartedOn)) {
    return { kind: 'due', source: 'free', dayType: 'training', workoutId: null, notes: null }
  }
  const { week_number, day_of_week } = resolveProgramCell(programStartedOn, activeProgram.duration_weeks, dateStr)
  const cell = programDaysByCell.get(`${week_number}:${day_of_week}`)
  if (!cell) return { kind: 'rest', source: 'program', dayType: 'rest', workoutId: null, notes: null }
  return classify(cell, 'program')
}

function classify(cell, source) {
  const dayType = cell.day_type || 'training'
  const workoutId = cell.workout_id || null
  const notes = cell.notes || null
  if (workoutId && dayType === 'training') return { kind: 'due', source, dayType, workoutId, notes }
  if (workoutId && dayType === 'recovery') return { kind: 'optional', source, dayType, workoutId, notes }
  return { kind: 'rest', source, dayType, workoutId: null, notes }
}

/**
 * Was `dateStr` a due day for this athlete?
 * @param dateStr 'YYYY-MM-DD'
 * @param activeProgram { id, duration_weeks } or null/undefined
 * @param programStartedOn 'YYYY-MM-DD' or null — required if activeProgram is set
 * @returns { due: boolean, workoutId: string|null }
 */
export function isDueOnDate(dateStr, activeProgram, programStartedOn, programDaysByCell, overridesByDate) {
  const d = resolveDay(dateStr, activeProgram, programStartedOn, programDaysByCell, overridesByDate)
  return d.kind === 'due' ? { due: true, workoutId: d.workoutId } : { due: false, workoutId: null }
}

/**
 * Walk backward from `today` (exclusive) computing how many *elapsed* days in
 * a row were logged (due days must be; non-due days count only if logged), stopping at the first missed due day or when
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
    if (!due) {
      // Not due: never breaks the streak, but a session the athlete chose to
      // log anyway (an optional recovery day, an extra workout) counts.
      if (completedDates.has(dateStr)) streak += 1
      continue
    }
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
    if (!due) {
      if (completedDates.has(dateStr)) streak += 1
      continue
    }
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
  return cachedStreak + (todayLogged ? 1 : 0)
}

/**
 * The longest run the athlete has ever had, walking forward from their first
 * logged day to `today` (inclusive) with the same rule as the live streak.
 * Today itself never breaks a run.
 */
export function computeBestStreak({ today, completedDates, dueCheck }) {
  if (completedDates.size === 0) return 0
  const first = [...completedDates].sort()[0]
  let best = 0
  let run = 0
  for (let d = first; d <= today; d = shiftDateStr(d, 1)) {
    const { due } = dueCheck(d)
    if (completedDates.has(d)) run += 1
    else if (due && d < today) run = 0
    if (run > best) best = run
  }
  return best
}
