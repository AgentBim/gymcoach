// Turns raw rows (athletes, programs, program days, feedback) into what the
// coach screens show: week dots, streak, last trained, and the reasons an
// athlete "needs you". Pure and React-free so Today, Athletes and the athlete
// hub can't disagree. Due-ness always goes through streaks.js.
import { isDueOnDate, resolveProgramCell, walkBackwardStreak, shiftDateStr } from './streaks'
import { mondayOfStr, weekdayShort } from './dates'
import { coachMessagedSince } from './inbox'

export { feelOf } from './feel'

export { mondayOfStr, weekdayShort }
const AT_RISK_MIN_STREAK = 5
const NOTE_WINDOW_DAYS = 1 // feedback from today or yesterday still counts as "new"

function lastTrainedLabel(dateStr, today) {
  if (!dateStr) return 'Never'
  if (dateStr === today) return 'Today'
  if (dateStr === shiftDateStr(today, -1)) return 'Yesterday'
  const days = Math.round((new Date(today + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000)
  if (days < 7) return weekdayShort(dateStr)
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function programWeekLabel(athlete, program, today) {
  if (!athlete.active_program_id || !program) return ''
  if (!athlete.program_started_on) return ''
  if (athlete.program_started_on > today) return `STARTS ${weekdayShort(athlete.program_started_on).toUpperCase()}`
  const { week_number } = resolveProgramCell(athlete.program_started_on, program.duration_weeks, today)
  return `WEEK ${week_number} OF ${program.duration_weeks}`
}

/**
 * Mon..Sun state for the week containing `today`.
 * done | miss | rest | today | future | none
 */
export function weekStates({ athlete, program, daysByCell, completed, today, overrides }) {
  const monday = mondayOfStr(today)
  const startsLater = program && athlete.program_started_on && athlete.program_started_on > today
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDateStr(monday, i)
    const logged = completed.has(date)
    if (startsLater) return 'future'
    if (program && athlete.program_started_on && date < athlete.program_started_on && !logged) return 'none'
    const { due } = isDueOnDate(date, program, athlete.program_started_on, daysByCell, overrides)
    if (date > today) return due ? 'future' : 'rest'
    if (date === today) return logged ? 'done' : due ? 'today' : 'rest'
    return logged ? 'done' : due ? 'miss' : 'rest'
  })
}

// Consecutive missed due days ending yesterday (most recent first).
function recentMisses({ athlete, program, daysByCell, completed, today, overrides }) {
  const misses = []
  for (let i = 1; i <= 14; i++) {
    const date = shiftDateStr(today, -i)
    if (program && athlete.program_started_on && date < athlete.program_started_on) break
    const { due } = isDueOnDate(date, program, athlete.program_started_on, daysByCell, overrides)
    if (!due) continue
    if (completed.has(date)) break
    misses.push(date)
  }
  return misses
}

function joinDays(names) {
  if (names.length <= 1) return names[0] || ''
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

/**
 * @param athletes   rows from athletes (+ id, full_name, group_name, active_program_id, program_started_on, email, user_id, invite_token)
 * @param programsById Map(id -> { id, name, duration_weeks })
 * @param daysByProgram Map(programId -> Map('week:day' -> { workout_id }))
 * @param feedback   rows { athlete_id, completed_date, submitted_at, rpe, emoji_rating, notes, exercises_completed, exercises_total, workouts: { name } }
 * @param streaks    Map(athleteId -> { streak, todayDue, todayWorkoutId, todayLogged })
 */
export function buildRosterStatus({ athletes, programsById, daysByProgram, feedback, streaks, today, overridesMap = new Map(), coachMessages = [] }) {
  const completedBy = new Map()
  const feedbackBy = new Map()
  feedback.forEach(f => {
    if (!f.athlete_id) return
    if (f.completed_date) {
      if (!completedBy.has(f.athlete_id)) completedBy.set(f.athlete_id, new Set())
      completedBy.get(f.athlete_id).add(f.completed_date)
    }
    if (!feedbackBy.has(f.athlete_id)) feedbackBy.set(f.athlete_id, [])
    feedbackBy.get(f.athlete_id).push(f)
  })

  return athletes.map(athlete => {
    const program = athlete.active_program_id ? programsById.get(athlete.active_program_id) || null : null
    const daysByCell = program ? daysByProgram.get(program.id) || new Map() : new Map()
    const completed = completedBy.get(athlete.id) || new Set()
    const overrides = overridesMap.get(athlete.id)
    const ctx = { athlete, program, daysByCell, completed, today, overrides }
    const s = streaks.get(athlete.id) || { streak: athlete.current_streak || 0, todayDue: false, todayWorkoutId: null, todayLogged: false }

    const week = weekStates(ctx)
    const lastDate = [...completed].sort().pop() || null

    // Why this athlete needs the coach, most urgent first.
    const reasons = []
    const misses = recentMisses(ctx)
    if (misses.length >= 2) {
      const ordered = [...misses].reverse()
      const names = misses.length <= 3 ? joinDays(ordered.map(weekdayShort)) : `${misses.length} sessions in a row`
      const before = walkBackwardStreak(misses[misses.length - 1], completed, d => isDueOnDate(d, program, athlete.program_started_on, daysByCell, overrides))
      reasons.push({
        kind: 'missed', count: misses.length, chip: `Missed ${misses.length}`, tone: 'coral', since: `${misses[0]}T00:00:00`,
        reason: `Missed ${names}.${before > 0 ? ` Streak ended at ${before} ${before === 1 ? 'day' : 'days'}.` : ''}`,
      })
    }
    const fb = (feedbackBy.get(athlete.id) || []).slice().sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''))
    const recentNote = fb.find(f => f.notes && f.notes.trim() && f.completed_date && f.completed_date >= shiftDateStr(today, -NOTE_WINDOW_DAYS))
    if (recentNote) {
      reasons.push({
        kind: 'note', chip: 'New note', tone: 'amber', badge: recentNote.rpe ? `RPE ${recentNote.rpe}` : '', feedbackId: recentNote.id, since: recentNote.submitted_at,
        reason: `Note on ${recentNote.workouts?.name || 'your workout'}: "${recentNote.notes.trim()}"`,
      })
    }
    if (s.todayDue && !s.todayLogged && s.streak >= AT_RISK_MIN_STREAK) {
      reasons.push({ kind: 'risk', chip: 'Streak at risk', tone: 'amber', since: `${today}T00:00:00`, reason: `${s.streak}-day streak, nothing logged yet today.` })
    }

    // A reason is handled once the coach has written to the athlete since it arose.
    reasons.forEach(r => {
      const m = coachMessagedSince(coachMessages, athlete.id, r.since)
      if (m) { r.handled = true; r.handledMessageId = m.id }
    })
    const open = reasons.filter(r => !r.handled)

    return {
      athlete,
      program,
      programName: program?.name || '',
      weekLabel: programWeekLabel(athlete, program, today),
      noProgram: !athlete.active_program_id,
      invitePending: !athlete.user_id && !!athlete.invite_token,
      streak: s.streak,
      todayDue: s.todayDue,
      todayLogged: s.todayLogged,
      todayWorkoutId: s.todayWorkoutId,
      week,
      lastDate,
      lastLabel: lastTrainedLabel(lastDate, today),
      reasons: open.length ? open : reasons,
      needsAttention: open.length > 0,
    }
  })
}
