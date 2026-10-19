import { describe, it, expect } from 'vitest'
import { buildThreads, coachMessagedSince } from '../inbox'

const NOW = new Date('2026-10-16T18:00:00Z').getTime()
const athletes = [{ id: 'a1', full_name: 'Tess O.' }, { id: 'a2', full_name: 'Dev K.' }, { id: 'a3', full_name: 'Quiet Q.' }]
const msg = (id, athlete_id, sender, body, at, extra = {}) => ({ id, athlete_id, sender, kind: 'text', body, created_at: at, unsent_at: null, ...extra })
const fb = (id, athlete_id, at, extra = {}) => ({ id, athlete_id, submitted_at: at, rpe: 9, emoji_rating: 'hard', notes: 'Left shoulder pinchy on dips.', workouts: { name: 'Upper 2' }, ...extra })
const base = { athletes, messages: [], feedback: [], states: [], requests: [], now: NOW }

describe('buildThreads', () => {
  it('orders threads by latest activity and drops empty ones', () => {
    const t = buildThreads({ ...base,
      messages: [msg('m1', 'a2', 'athlete', 'Sorry, rough week.', '2026-10-16T16:55:00Z')],
      feedback: [fb('f1', 'a1', '2026-10-16T17:40:00Z')] })
    expect(t.map(x => x.athlete.id)).toEqual(['a1', 'a2'])
  })

  it('marks a thread unread until the coach has opened it', () => {
    const args = { ...base, messages: [msg('m1', 'a2', 'athlete', 'Hi', '2026-10-16T16:55:00Z')] }
    expect(buildThreads(args)[0].unread).toBe(true)
    expect(buildThreads({ ...args, states: [{ athlete_id: 'a2', coach_read_at: '2026-10-16T17:00:00Z' }] })[0].unread).toBe(false)
    expect(buildThreads({ ...args, states: [{ athlete_id: 'a2', coach_read_at: '2026-10-16T16:00:00Z' }] })[0].unread).toBe(true)
  })

  it("the coach's own messages never make a thread unread", () => {
    const t = buildThreads({ ...base, messages: [msg('m1', 'a2', 'coach', 'Check in', '2026-10-16T16:55:00Z')] })
    expect(t[0].unread).toBe(false)
    expect(t[0].preview).toBe('You: Check in')
  })

  it('shows feedback as a card, with its note in the preview, and ignores old feedback', () => {
    const t = buildThreads({ ...base, feedback: [fb('f1', 'a1', '2026-10-16T17:40:00Z'), fb('f0', 'a3', '2026-09-01T17:40:00Z')] })
    expect(t).toHaveLength(1)
    expect(t[0].items[0]).toMatchObject({ type: 'feedback', title: 'Logged Upper 2', rpe: 9 })
    expect(t[0].preview).toBe('Logged Upper 2: "Left shoulder pinchy on dips."')
  })

  it('hides unsent messages and carries the pending request', () => {
    const req = { id: 'r1', athlete_id: 'a1', status: 'pending', from_date: '2026-10-22', to_date: '2026-10-23' }
    const t = buildThreads({ ...base, requests: [req],
      messages: [msg('m1', 'a1', 'coach', 'oops', '2026-10-16T10:00:00Z', { unsent_at: '2026-10-16T10:01:00Z' }),
                 msg('m2', 'a1', 'athlete', 'Can I move Thursday?', '2026-10-16T17:40:00Z', { kind: 'request', request_id: 'r1' })] })
    expect(t[0].items).toHaveLength(1)
    expect(t[0].request).toBe(req)
    expect(t[0].items[0].request).toBe(req)
  })
})

describe('coachMessagedSince', () => {
  const messages = [msg('m1', 'a1', 'coach', 'hi', '2026-10-16T17:00:00Z'), msg('m2', 'a1', 'athlete', 'yo', '2026-10-16T17:30:00Z')]
  it('finds a later coach message only', () => {
    expect(coachMessagedSince(messages, 'a1', '2026-10-16T16:00:00Z')?.id).toBe('m1')
    expect(coachMessagedSince(messages, 'a1', '2026-10-16T17:10:00Z')).toBeNull()
    expect(coachMessagedSince(messages, 'a2', '2026-10-16T16:00:00Z')).toBeNull()
  })
})
