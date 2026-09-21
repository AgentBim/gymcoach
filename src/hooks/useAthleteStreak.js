import { useState, useEffect, useCallback } from 'react'
import { computeSingleAthleteStreak } from '../lib/streakData'

export function useAthleteStreak(athleteId) {
  const [state, setState] = useState({ loading: true, streak: 0, todayDue: true, todayWorkoutId: null, todayLogged: false })

  const refresh = useCallback(async () => {
    if (!athleteId) { setState(s => ({ ...s, loading: false })); return }
    setState(s => ({ ...s, loading: true }))
    const result = await computeSingleAthleteStreak(athleteId)
    setState({ loading: false, ...(result || { streak: 0, todayDue: true, todayWorkoutId: null, todayLogged: false }) })
  }, [athleteId])

  useEffect(() => { refresh() }, [refresh])

  return { ...state, refresh }
}
