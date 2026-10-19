// Who a program edit touches, for the editor's impact panel and the save
// dialog. Programs repeat (see streaks.js#resolveProgramCell), so a week an
// athlete already did is "applies later", not "no effect".
import { resolveProgramCell } from './streaks'
import { mondayOfStr, shiftDateStr, fmtShort } from './dates'

function list(names) {
  if (names.length <= 1) return names[0] || ''
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

/** Where an athlete is in the program today: { week } or { startsOn }. */
export function athleteWeek(athlete, weeks, today) {
  if (!athlete.program_started_on) return { startsOn: mondayOfStr(today) }
  if (athlete.program_started_on > today) return { startsOn: athlete.program_started_on }
  return { week: resolveProgramCell(athlete.program_started_on, weeks, today).week_number }
}

/** The Monday on which this athlete next reaches `week` (or is in it now). */
function reachDate(athlete, week, weeks, today) {
  const where = athleteWeek(athlete, weeks, today)
  if (where.startsOn) return shiftDateStr(mondayOfStr(where.startsOn), 7 * (week - 1))
  const ahead = (((week - where.week) % weeks) + weeks) % weeks
  return shiftDateStr(mondayOfStr(today), 7 * ahead)
}

/**
 * @param athletes [{ id, full_name, program_started_on }] currently on the program
 * @returns { head, text, tone: 'amber'|'green'|'muted', live, affected: [ids] }
 *   live = somebody is in that week right now, so "leave this week / update now" applies.
 */
export function impactForWeek({ athletes, week, weeks, today }) {
  if (athletes.length === 0) {
    return { head: 'No athletes yet', text: 'Nobody is on this program, so nothing changes for anyone.', tone: 'muted', live: false, affected: [] }
  }
  const now = []
  const pending = []
  athletes.forEach(a => {
    const w = athleteWeek(a, weeks, today)
    if (w.week === week) now.push(a)
    else pending.push(a)
  })

  if (now.length) {
    const names = now.map(a => a.full_name)
    const starting = pending.filter(a => athleteWeek(a, weeks, today).startsOn)
    let text = `${list(names)} ${now.length === 1 ? 'is' : 'are'} in week ${week} now.`
    if (starting.length) {
      const date = reachDate(starting[0], 1, weeks, today)
      text += ` ${list(starting.map(a => a.full_name))} start${starting.length === 1 ? 's' : ''} on ${fmtShort(date)}.`
    }
    return {
      head: `${now.length} athlete${now.length === 1 ? '' : 's'} affected`,
      text, tone: 'amber', live: true, affected: now.map(a => a.id),
    }
  }

  const soonest = pending.map(a => reachDate(a, week, weeks, today)).sort()[0]
  return {
    head: 'Applies later',
    text: `Athletes reach week ${week} on ${fmtShort(soonest)}. Nobody sees this yet.`,
    tone: 'green', live: false, affected: [],
  }
}
