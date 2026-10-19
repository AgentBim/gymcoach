import { describe, it, expect } from 'vitest'
import { resolveDay, isDueOnDate, walkBackwardStreak, advanceStreakCache, displayStreak, computeBestStreak } from '../streaks'

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

describe('optional days and best streak', () => {
  const check = d => isDueOnDate(d, program, START, cells)

  it('a logged recovery day counts toward the streak and a skipped one never breaks it', () => {
    // Fri Oct 9 (due), Sat Oct 10 (recovery, logged), Mon Oct 12 (due)
    const logged = new Set(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-15'])
    expect(walkBackwardStreak('2026-10-16', logged, check)).toBe(6)
    logged.delete('2026-10-10')
    expect(walkBackwardStreak('2026-10-16', logged, check)).toBe(5)
  })

  it('the live streak adds today whenever it is logged, due or not', () => {
    expect(displayStreak(14, true, true)).toBe(15)
    expect(displayStreak(14, false, true)).toBe(15)
    expect(displayStreak(14, true, false)).toBe(14)
  })

  it('advancing the cache counts a logged optional day', () => {
    const r = advanceStreakCache({ cachedStreak: 3, lastComputedDate: '2026-10-09', throughDate: '2026-10-12', completedDates: new Set(['2026-10-10', '2026-10-12']), dueCheck: check })
    expect(r.streak).toBe(5)
  })

  it('finds the longest run in the history', () => {
    // Oct 5-6 done (2), Oct 8 missed (breaks), Oct 9, 12, 13 done (3), Oct 15 done (4), today due and unlogged
    const logged = new Set(['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-15'])
    expect(computeBestStreak({ today: '2026-10-16', completedDates: logged, dueCheck: check })).toBe(4)
    expect(computeBestStreak({ today: '2026-10-16', completedDates: new Set(), dueCheck: check })).toBe(0)
  })
})
