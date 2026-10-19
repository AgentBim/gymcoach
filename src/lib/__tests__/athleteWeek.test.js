import { describe, it, expect } from 'vitest'
import { buildWeek, athleteStats, weeklyTrend, programProgress, programWeekOf, weekRange } from '../athleteWeek'

// Fri 2026-10-16, week 2 of a 4-week program started Mon Oct 5.
const TODAY = '2026-10-16'
const program = { id: 'p', duration_weeks: 4 }
const athlete = { program_started_on: '2026-10-05' }
const cells = new Map()
for (let w = 1; w <= 4; w++) {
  ;[0, 1, 3, 4].forEach(d => cells.set(`${w}:${d}`, { workout_id: 'wk', day_type: 'training' }))
  cells.set(`${w}:5`, { workout_id: 'walk', day_type: 'recovery' })
}
const fb = (date, rpe = 7) => ({ completed_date: date, rpe })
const byDate = rows => new Map(rows.map(r => [r.completed_date, r]))

describe('buildWeek', () => {
  const week = overrides => buildWeek({
    monday: '2026-10-12', athlete, program, cells, overrides, today: TODAY,
    feedbackByDate: byDate([fb('2026-10-12'), fb('2026-10-13'), fb('2026-10-15')]),
  })

  it('labels done, rest, due today, optional and rest days', () => {
    expect(week().map(d => d.status)).toEqual(['done', 'done', 'rest', 'done', 'due', 'optional', 'rest'])
  })

  it('marks overridden days as adjusted and honours them', () => {
    const w = week(new Map([['2026-10-16', { day_type: 'rest', workout_id: null }]]))
    expect(w[4]).toMatchObject({ adjusted: true, kind: 'rest', status: 'rest' })
    expect(w[3].adjusted).toBe(false)
  })

  it('can ignore an override to show the program day again', () => {
    const w = buildWeek({
      monday: '2026-10-12', athlete, program, cells, today: TODAY, feedbackByDate: new Map(),
      overrides: new Map([['2026-10-16', { day_type: 'rest', workout_id: null }]]), ignoreOverrideDates: new Set(['2026-10-16']),
    })
    expect(w[4]).toMatchObject({ adjusted: false, status: 'due' })
  })

  it('a past due day with nothing logged is missed', () => {
    const w = buildWeek({ monday: '2026-10-12', athlete, program, cells, today: TODAY, feedbackByDate: new Map() })
    expect(w[0].status).toBe('missed')
    expect(w[4].status).toBe('due')
  })
})

describe('week labels', () => {
  it('finds the program week and the date range', () => {
    expect(programWeekOf(athlete, program, '2026-10-12')).toBe(2)
    expect(programWeekOf(athlete, program, '2026-09-28')).toBeNull()
    expect(weekRange('2026-10-12')).toBe('Oct 12 – 18')
    expect(weekRange('2026-10-26')).toBe('Oct 26 – Nov 1')
  })
})

describe('athleteStats', () => {
  const feedback = [fb('2026-10-12', 7), fb('2026-10-13', 8), fb('2026-10-15', 7), fb('2026-10-06', 6)]
  it('counts the month, averages RPE and measures follow-through', () => {
    const s = athleteStats({ feedback, athlete, program, cells, today: TODAY })
    expect(s.doneThisMonth).toBe(4)
    expect(s.avgRpe).toBe(7)
    // due days since start (Oct 5 .. Oct 15): 5, 6, 8, 9, 12, 13, 15 = 7; logged: 6, 12, 13, 15 = 4
    expect(s.followThrough).toBe(Math.round((4 / 7) * 100))
  })
})

describe('weeklyTrend and programProgress', () => {
  it('sums sessions per week, current week last', () => {
    const t = weeklyTrend({ feedback: [fb('2026-10-12', 8), fb('2026-10-13', 6), fb('2026-10-05', 7)], today: TODAY, n: 3 })
    expect(t.map(x => x.sessions)).toEqual([0, 1, 2])
    expect(t[2]).toMatchObject({ rpe: '7.0', current: true })
  })

  it('reports sessions done of total in this pass', () => {
    const p = programProgress({ athlete, program, cells, completedDates: new Set(['2026-10-06', '2026-10-12']), today: TODAY })
    expect(p).toEqual({ done: 2, total: 16, week: 2 })
  })
})
