import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Fetches a workout plus its main exercises and prehab list, read-only —
// shared by the athlete portal's full-page preview and the coach-side
// floating preview panel so there's one query shape for "what's in this
// workout," not two.
//
// draftWorkout ({ name, exercises, prehab }, already joined to exercise rows)
// is an unsaved program workout: it has no id yet, so it's returned as-is
// with no fetch.
export function useWorkoutPreview(workoutId, draftWorkout = null) {
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchId = draftWorkout ? null : workoutId

  useEffect(() => {
    let cancelled = false
    if (!fetchId) { setLoading(false); return }

    setLoading(true)
    Promise.all([
      supabase.from('workouts').select('*').eq('id', fetchId).single(),
      supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', fetchId).order('position'),
      supabase.from('workout_prehab').select('*, exercises(*)').eq('workout_id', fetchId).order('position'),
    ]).then(([{ data: w }, { data: ex }, { data: pre }]) => {
      if (cancelled) return
      setWorkout(w)
      setExercises(ex || [])
      setPrehabExercises(pre || [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [fetchId])

  if (draftWorkout) {
    return { workout: draftWorkout, exercises: draftWorkout.exercises, prehabExercises: draftWorkout.prehab, loading: false }
  }
  return { workout, exercises, prehabExercises, loading }
}
