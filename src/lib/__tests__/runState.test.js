import { describe, it, expect } from 'vitest'
import { runItems, runTotals } from '../runState'

describe('exercise demonstrations in set-based workouts', () => {
  it('retains media and stable exercise identity without changing progress keys or prescribed doses', () => {
    const exercise = { id: 'exercise-id', name: 'Wall Sit', description: 'Keep position.', media: { version_id: 'v1' } }
    const row = { id: 'main-row', exercises: exercise, sets: 3, reps: null, duration_seconds: 45, rest_seconds: 30 }
    const prehab = { ...row, id: 'pre-row', sets: 2, duration_seconds: 20 }
    const items = runItems([row, { ...row, id: 'second-row' }], [prehab])
    expect(items.map(x => x.key)).toEqual(['ppre-row', 'emain-row', 'esecond-row'])
    expect(items.map(x => x.exercise)).toEqual([exercise, exercise, exercise])
    expect(items[1]).toMatchObject({ name: 'Wall Sit', cue: 'Keep position.', dose: '3 × 45s', rest: 30, sets: 3 })
    expect(runTotals(items, { 'ppre-row': 2, 'emain-row': 1 })).toEqual({
      totalSets: 8, doneSets: 3, mainTotal: 6, mainDone: 1, prehabTotal: 2, prehabDone: 2, exercisesDone: 0,
    })
  })

  it('keeps a workout usable when its joined exercise or media is absent', () => {
    const items = runItems([{ id: 'row', sets: 2, reps: 8, rest_seconds: 15 }], [])
    expect(items[0]).toMatchObject({ exercise: null, name: 'Exercise', dose: '2 × 8', rest: 15 })
    expect(runTotals(items, { erow: 2 }).exercisesDone).toBe(1)
  })
})
