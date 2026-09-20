import { useState, useEffect } from 'react'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { useAthleteStreak } from '../../hooks/useAthleteStreak'
import { supabase } from '../../lib/supabase'
import { WorkoutRunner } from '../../components/WorkoutRunner'
import { todayLocal } from '../../lib/streaks'

export default function AthleteToday() {
  const { athlete } = useAthleteAuth()
  const { streak, loading: streakLoading, todayDue, todayWorkoutId, todayLogged, refresh } = useAthleteStreak(athlete?.id)

  const [assignedWorkouts, setAssignedWorkouts] = useState([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loadingWorkout, setLoadingWorkout] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const effectiveWorkoutId = todayWorkoutId || selectedWorkoutId

  // Off-program (or on-program-but-no-specific-workout) days let the athlete
  // pick from whatever's been assigned to them directly.
  useEffect(() => {
    if (streakLoading || todayWorkoutId || todayLogged) return
    fetchAssignedWorkouts()
  }, [streakLoading, todayWorkoutId, todayLogged, athlete?.id])

  async function fetchAssignedWorkouts() {
    if (!athlete) return
    const { data } = await supabase
      .from('workout_assignments')
      .select('workout_id, workouts(id, name)')
      .eq('athlete_id', athlete.id)
    setAssignedWorkouts((data || []).map(a => a.workouts).filter(Boolean))
  }

  useEffect(() => {
    if (!effectiveWorkoutId) { setWorkout(null); return }
    fetchWorkout(effectiveWorkoutId)
  }, [effectiveWorkoutId])

  async function fetchWorkout(id) {
    setLoadingWorkout(true)
    const { data: w } = await supabase.from('workouts').select('*').eq('id', id).single()
    const { data: ex } = await supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', id).order('position')
    const { data: pre } = await supabase.from('workout_prehab').select('*, exercises(*)').eq('workout_id', id).order('position')
    setWorkout(w)
    setExercises(ex || [])
    setPrehabExercises(pre || [])
    setLoadingWorkout(false)
  }

  async function submitFeedback(payload) {
    await supabase.from('workout_feedback').insert({
      workout_id: effectiveWorkoutId,
      athlete_id: athlete.id,
      athlete_name: athlete.full_name,
      completed_date: todayLocal(),
      ...payload,
    })
  }

  if (streakLoading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading...</div>

  if (!todayDue) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>😴</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Rest day</div>
        <p style={{ fontSize: 13, color: 'var(--mu)' }}>Nothing's due today — your streak is safe.</p>
      </div>
    )
  }

  if (todayLogged || justCompleted) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Already logged today</div>
        <p style={{ fontSize: 13, color: 'var(--mu)' }}>Nice work — see you tomorrow.</p>
      </div>
    )
  }

  if (!todayWorkoutId && !selectedWorkoutId) {
    return (
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>What are you logging today?</div>
        <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16 }}>You're not on a set program, so any completed workout keeps your streak going.</p>
        {assignedWorkouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--mu)', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12 }}>
            No workouts assigned yet — ask your coach.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignedWorkouts.map(w => (
              <button key={w.id} onClick={() => setSelectedWorkoutId(w.id)}
                style={{ textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '14px 16px', color: 'var(--tx)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {w.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loadingWorkout || !workout) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading workout...</div>

  return (
    <WorkoutRunner
      workout={workout}
      exercises={exercises}
      prehabExercises={prehabExercises}
      onSubmitFeedback={submitFeedback}
      onFeedbackSubmitted={() => { setJustCompleted(true); refresh() }}
    />
  )
}
