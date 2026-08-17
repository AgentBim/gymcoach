export function getFeedbackAthlete(feedback) {
  const assignment = Array.isArray(feedback.workout_assignments)
    ? feedback.workout_assignments[0]
    : feedback.workout_assignments
  const athlete = assignment?.athletes

  if (athlete) return { ...athlete, attribution: 'assignment' }
  if (feedback.athlete_name) {
    return { full_name: feedback.athlete_name, attribution: 'legacy' }
  }
  return null
}

export function flattenWorkoutFeedback(workouts = []) {
  return workouts
    .flatMap(workout => (workout.workout_feedback || []).map(item => ({
      ...item,
      workout_id: workout.id,
      workout_name: workout.name,
      athlete: getFeedbackAthlete(item),
    })))
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
}
