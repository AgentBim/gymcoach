// Turns raw rows into the Inbox: one thread per athlete, newest activity
// first. Pure so it can be tested; src/lib/useInbox.js does the fetching.
//
// A thread is the athlete's and the coach's messages plus the athlete's workout
// feedback ("Tess logged Upper 2"), read from workout_feedback rather than
// copied. "Unread" means something from the athlete is newer than the last time
// the coach opened the thread (thread_state.coach_read_at).
import { feelOf } from './feel'

const FEEDBACK_WINDOW_DAYS = 21

function feedbackItem(f) {
  const feel = feelOf(f.emoji_rating)
  return {
    type: 'feedback', id: 'fb-' + f.id, at: f.submitted_at, feedbackId: f.id,
    title: `Logged ${f.workouts?.name || 'a workout'}`,
    workoutName: f.workouts?.name || '',
    rpe: f.rpe || null, feel, note: f.notes || '',
  }
}

function previewOf(item) {
  if (!item) return ''
  if (item.type === 'feedback') {
    return item.note
      ? `${item.title}: "${item.note}"`
      : [item.title, item.rpe && `RPE ${item.rpe}`, item.feel?.label].filter(Boolean).join(' · ')
  }
  if (item.sender === 'coach') return 'You: ' + item.body
  return item.body
}

/**
 * @param athletes [{ id, full_name, group_name, ... }]
 * @param messages rows from messages (unsent ones are dropped)
 * @param feedback rows from workout_feedback with workouts(name)
 * @param states   rows from thread_state
 * @param requests rows from schedule_requests
 * @returns [{ athlete, items, unread, request (pending) | null, last, preview, at }]
 */
export function buildThreads({ athletes, messages, feedback, states, requests, now = Date.now() }) {
  const readAt = new Map(states.map(s => [s.athlete_id, new Date(s.coach_read_at).getTime()]))
  const athleteReadAt = new Map(states.map(s => [s.athlete_id, new Date(s.athlete_read_at).getTime()]))
  const cutoff = now - FEEDBACK_WINDOW_DAYS * 86400000
  const requestById = new Map(requests.map(r => [r.id, r]))
  const pendingBy = new Map(requests.filter(r => r.status === 'pending').map(r => [r.athlete_id, r]))

  return athletes.map(athlete => {
    const items = []
    messages.filter(m => m.athlete_id === athlete.id && !m.unsent_at).forEach(m => {
      items.push({ type: 'message', id: m.id, at: m.created_at, sender: m.sender, kind: m.kind, body: m.body, request: m.request_id ? requestById.get(m.request_id) || null : null })
    })
    feedback.filter(f => f.athlete_id === athlete.id && new Date(f.submitted_at).getTime() >= cutoff).forEach(f => items.push(feedbackItem(f)))
    items.sort((a, b) => new Date(a.at) - new Date(b.at))

    const since = readAt.get(athlete.id) ?? 0
    const unread = items.some(i => (i.type === 'feedback' || i.sender === 'athlete') && new Date(i.at).getTime() > since)
    const last = items[items.length - 1] || null
    const request = pendingBy.get(athlete.id) || null
    return { athlete, items, unread, request, last, preview: previewOf(last), at: last?.at || null, athleteReadAt: athleteReadAt.get(athlete.id) ?? 0 }
  })
    .filter(t => t.items.length > 0 || t.request)
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
}

/** Has the coach written to this athlete since `since` (ISO or ms)? Used to clear a Needs-you item once handled. */
export function coachMessagedSince(messages, athleteId, since) {
  const t = new Date(since).getTime()
  return messages.find(m => m.athlete_id === athleteId && m.sender === 'coach' && !m.unsent_at && new Date(m.created_at).getTime() > t) || null
}
