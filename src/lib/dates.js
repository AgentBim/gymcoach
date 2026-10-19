// Date-only helpers ('YYYY-MM-DD' strings), Monday-start weeks like streaks.js.
import { formatDateOnly, shiftDateStr } from './streaks'

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export { DAY_SHORT }

const dow = (dateStr) => (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7

export function mondayOfStr(dateStr) {
  return shiftDateStr(dateStr, -dow(dateStr))
}

export function weekdayShort(dateStr) {
  return DAY_SHORT[dow(dateStr)]
}

/** The Monday strictly after dateStr (a Monday still returns the next one). */
export function nextMondayStr(dateStr) {
  return shiftDateStr(dateStr, 7 - dow(dateStr))
}

/** 'Mon, Oct 19' */
export function fmtShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** 'Oct 19' */
export function fmtMonthDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export { formatDateOnly, shiftDateStr }

/** 'Edited 3 days ago' style relative label for a timestamp. */
export function ago(iso) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.round(days / 7)
  if (days < 60) return `${weeks} weeks ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** 'Today' / 'Yesterday' / 'Mon' / 'Oct 5' for a date-only or timestamp string; 'Never' when empty. */
export function dayLabel(value, today) {
  if (!value) return 'Never'
  const d = value.slice(0, 10)
  if (d === today) return 'Today'
  if (d === shiftDateStr(today, -1)) return 'Yesterday'
  const days = Math.round((new Date(today + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000)
  return days < 7 ? weekdayShort(d) : fmtMonthDay(d)
}

/** 'Friday, Oct 16' */
export function fmtLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Whole days from `from` to `to` (date-only strings). */
export function daysBetween(from, to) {
  return Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000)
}
