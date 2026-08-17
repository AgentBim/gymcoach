import { describe, expect, it } from 'vitest'
import { flattenWorkoutFeedback, getFeedbackAthlete } from '../src/lib/history'

describe('feedback attribution', () => {
  it('uses the athlete bound to the submitting assignment', () => {
    const feedback = {
      athlete_name: 'Spoofed Name',
      workout_assignments: {
        athletes: { full_name: 'Amina Cole', group_name: 'Senior', level: 'Elite' },
      },
    }

    expect(getFeedbackAthlete(feedback)).toEqual({
      full_name: 'Amina Cole', group_name: 'Senior', level: 'Elite', attribution: 'assignment',
    })
  })

  it('labels pre-assignment feedback as a legacy recorded name', () => {
    expect(getFeedbackAthlete({ athlete_name: 'Legacy Athlete' })).toEqual({
      full_name: 'Legacy Athlete', attribution: 'legacy',
    })
  })

  it('keeps each response paired with its own athlete and sorts newest first', () => {
    const result = flattenWorkoutFeedback([{ id: 'w1', name: 'Strength', workout_feedback: [
      { id: 'f1', submitted_at: '2026-08-01T10:00:00Z', workout_assignments: { athletes: { full_name: 'Athlete One' } } },
      { id: 'f2', submitted_at: '2026-08-02T10:00:00Z', workout_assignments: { athletes: { full_name: 'Athlete Two' } } },
    ] }])

    expect(result.map(item => [item.id, item.athlete.full_name])).toEqual([
      ['f2', 'Athlete Two'], ['f1', 'Athlete One'],
    ])
  })
})
