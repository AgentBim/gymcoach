import { describe, it, expect } from 'vitest'
import { buildRosterStatus, weekStates } from '../rosterStatus'

// Friday 2026-10-16. Program: Mon, Tue, Thu, Fri are training days.
const TODAY = '2026-10-16'
const program = { id: 'p1', name: 'Strength Base', duration_weeks: 4 }
const cells = new Map()
for (let w = 1; w <= 4; w++) [0, 1, 3, 4].forEach(d => cells.set(`${w}:${d}`, { workout_id: 'w' }))
const daysByProgram = new Map([['p1', cells]])
const programsById = new Map([['p1', program]])

const athlete = (over = {}) => ({ id: 'a1', full_name: 'Maya R.', active_program_id: 'p1', program_started_on: '2026-10-05', user_id: 'u', invite_token: null, current_streak: 0, ...over })
const fb = (date, extra = {}) => ({ id: date, athlete_id: 'a1', completed_date: date, submitted_at: `${date}T17:00:00Z`, rpe: 7, emoji_rating: 'good', notes: null, workouts: { name: 'Lower 1' }, ...extra })
const run = (a, feedback, streak = {}) =>
  buildRosterStatus({
    athletes: [a], programsById, daysByProgram, feedback,
    streaks: new Map([[a.id, { streak: 0, todayDue: true, todayLogged: false, todayWorkoutId: 'w', ...streak }]]),
    today: TODAY,
  })[0]

describe('weekStates', () => {
  it('marks done, rest, due-today and future days', () => {
    const w = weekStates({ athlete: athlete(), program, daysByCell: cells, completed: new Set(['2026-10-12', '2026-10-13', '2026-10-15']), today: TODAY })
    expect(w).toEqual(['done', 'done', 'rest', 'done', 'today', 'rest', 'rest'])
  })

  it('marks a due day with nothing logged as missed', () => {
    const w = weekStates({ athlete: athlete(), program, daysByCell: cells, completed: new Set(['2026-10-12']), today: TODAY })
    expect(w.slice(0, 5)).toEqual(['done', 'miss', 'rest', 'miss', 'today'])
  })

  it('shows every day as upcoming before the program starts', () => {
    const a = athlete({ program_started_on: '2026-10-19' })
    expect(weekStates({ athlete: a, program, daysByCell: cells, completed: new Set(), today: TODAY })).toEqual(Array(7).fill('future'))
  })

  it('treats every day as due when the athlete has no program', () => {
    const a = athlete({ active_program_id: null, program_started_on: null })
    const w = weekStates({ athlete: a, program: null, daysByCell: new Map(), completed: new Set(['2026-10-12']), today: TODAY })
    expect(w.slice(0, 5)).toEqual(['done', 'miss', 'miss', 'miss', 'today'])
  })
})

describe('buildRosterStatus', () => {
  it('flags two missed sessions in a row and names the days', () => {
    const r = run(athlete(), [fb('2026-10-12')])
    expect(r.reasons[0]).toMatchObject({ kind: 'missed', count: 2, chip: 'Missed 2' })
    expect(r.reasons[0].reason).toContain('Missed Tue and Thu.')
    expect(r.needsAttention).toBe(true)
  })

  it('does not flag a single missed session', () => {
    const r = run(athlete(), [fb('2026-10-12'), fb('2026-10-15')])
    expect(r.reasons.find(x => x.kind === 'missed')).toBeUndefined()
  })

  it('surfaces a fresh note and ignores an old one', () => {
    const fresh = run(athlete(), [fb('2026-10-15', { notes: 'Shoulder pinchy' })], { streak: 1 })
    expect(fresh.reasons.find(x => x.kind === 'note')).toMatchObject({ badge: 'RPE 7' })
    const old = run(athlete(), [fb('2026-10-12', { notes: 'Shoulder pinchy' })])
    expect(old.reasons.find(x => x.kind === 'note')).toBeUndefined()
  })

  it('flags a long streak with nothing logged today as at risk', () => {
    const r = run(athlete(), [fb('2026-10-15')], { streak: 14 })
    expect(r.reasons.map(x => x.kind)).toContain('risk')
    expect(run(athlete(), [fb('2026-10-15')], { streak: 14, todayLogged: true }).reasons.map(x => x.kind)).not.toContain('risk')
  })

  it('labels program week, last trained and invite state', () => {
    const r = run(athlete(), [fb('2026-10-15')])
    expect(r.weekLabel).toBe('WEEK 2 OF 4')
    expect(r.lastLabel).toBe('Yesterday')
    expect(run(athlete({ program_started_on: '2026-10-19' }), []).weekLabel).toBe('STARTS MON')
    expect(run(athlete({ user_id: null, invite_token: 'tok' }), []).invitePending).toBe(true)
    expect(run(athlete({ active_program_id: null, program_started_on: null }), []).noProgram).toBe(true)
  })
})
