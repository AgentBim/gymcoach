import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Fetches a workout plus its main exercises and prehab list, read-only —
// shared by the athlete portal's full-page preview and the coach-side
// floating preview panel so there's one query shape for "what's in this
// workout," not two.
export function useWorkoutPreview(workoutId) {
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!workoutId) { setLoading(false); return }

    setLoading(true)
    Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', workoutId).order('position'),
      supabase.from('workout_prehab').select('*, exercises(*)').eq('workout_id', workoutId).order('position'),
    ]).then(([{ data: w }, { data: ex }, { data: pre }]) => {
      if (cancelled) return
      setWorkout(w)
      setExercises(ex || [])
      setPrehabExercises(pre || [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workoutId])

  return { workout, exercises, prehabExercises, loading }
}
