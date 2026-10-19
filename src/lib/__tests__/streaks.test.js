import { describe, it, expect } from 'vitest'
import { resolveDay, isDueOnDate, walkBackwardStreak } from '../streaks'

// Program: Mon/Tue/Thu/Fri training, Sat recovery with a workout, Wed/Sun rest.
// Fri 2026-10-16; started Mon 2026-10-05, so Oct 12-18 is week 2.
const program = { id: 'p', duration_weeks: 4 }
const cells = new Map()
for (let w = 1; w <= 4; w++) {
  ;[0, 1, 3, 4].forEach(d => cells.set(`${w}:${d}`, { workout_id: 'wk', day_type: 'training' }))
  cells.set(`${w}:5`, { workout_id: 'walk', day_type: 'recovery' })
}
const START = '2026-10-05'
const due = (date, overrides) => isDueOnDate(date, program, START, cells, overrides)

describe('program schedule', () => {
  it('a training day with a workout is due; rest is not', () => {
    expect(due('2026-10-12')).toEqual({ due: true, workoutId: 'wk' }) // Mon
    expect(due('2026-10-14')).toEqual({ due: false, workoutId: null }) // Wed
  })

  it('a recovery day is optional: never due, but the workout is known', () => {
    expect(due('2026-10-17')).toEqual({ due: false, workoutId: null })
    expect(resolveDay('2026-10-17', program, START, cells)).toMatchObject({ kind: 'optional', workoutId: 'walk' })
  })

  it('cells saved without a day type still count as training', () => {
    const legacy = new Map([['2:4', { workout_id: 'wk' }]])
    expect(isDueOnDate('2026-10-16', program, START, legacy)).toEqual({ due: true, workoutId: 'wk' })
  })

  it('no program means every day is due', () => {
    expect(isDueOnDate('2026-10-14', null, null, new Map())).toEqual({ due: true, workoutId: null })
  })
})

describe('personal overrides', () => {
  it('a rest override turns a training day into a non-due day', () => {
    const o = new Map([['2026-10-16', { day_type: 'rest', workout_id: null }]])
    expect(due('2026-10-16', o)).toEqual({ due: false, workoutId: null })
    expect(resolveDay('2026-10-16', program, START, cells, o)).toMatchObject({ source: 'override', kind: 'rest' })
  })

  it('a training override on a rest day makes it due with that workout', () => {
    const o = new Map([['2026-10-14', { day_type: 'training', workout_id: 'core' }]])
    expect(due('2026-10-14', o)).toEqual({ due: true, workoutId: 'core' })
  })

  it('only the overridden date changes', () => {
    const o = new Map([['2026-10-16', { day_type: 'rest', workout_id: null }]])
    expect(due('2026-10-15', o)).toEqual({ due: true, workoutId: 'wk' })
  })

  it('overrides win over the pre-start free-for-all', () => {
    const o = new Map([['2026-09-30', { day_type: 'rest', workout_id: null }]])
    expect(isDueOnDate('2026-09-30', program, START, cells, o).due).toBe(false)
    expect(isDueOnDate('2026-09-29', program, START, cells, o).due).toBe(true)
  })
})

describe('streak walk', () => {
  it('skips rest days and honours a personal rest day', () => {
    const completed = new Set(['2026-10-12', '2026-10-13'])
    // Thu Oct 15 was due and missed; with a rest override it is skipped instead.
    const check = overrides => d => isDueOnDate(d, program, START, cells, overrides)
    expect(walkBackwardStreak('2026-10-16', completed, check())).toBe(0)
    const o = new Map([['2026-10-15', { day_type: 'rest', workout_id: null }]])
    expect(walkBackwardStreak('2026-10-16', completed, check(o))).toBe(2)
  })
})
