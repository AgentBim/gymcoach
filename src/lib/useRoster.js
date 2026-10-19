import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { todayLocal } from './streaks'
import { computeStreaks, fetchProgramDaysByProgramIds } from './streakData'
import { buildRosterStatus } from './rosterStatus'

/**
 * One fetch for everything the coach screens need about the roster: the
 * athletes, their programs, program days and feedback, folded into per-athlete
 * status (streak, week dots, why they need attention). Shared by Today and
 * Athletes so the numbers match.
 */
export function useRoster(coachId) {
  const [state, setState] = useState({ loading: true, rows: [], feedback: [], programs: [], error: null })

  const load = useCallback(async () => {
    if (!coachId) return
    const today = todayLocal()
    const { data: athletes, error } = await supabase
      .from('athletes')
      .select('id, full_name, group_name, level, email, user_id, invite_token, active_program_id, program_started_on, current_streak, streak_last_computed_date')
      .eq('coach_id', coachId)
      .order('full_name')
    if (error) { setState(s => ({ ...s, loading: false, error })); return }

    const ids = athletes.map(a => a.id)
    const programIds = [...new Set(athletes.map(a => a.active_program_id).filter(Boolean))]

    const [programsRes, daysByProgram, fbRes] = await Promise.all([
      supabase.from('programs').select('id, name, duration_weeks').eq('coach_id', coachId),
      fetchProgramDaysByProgramIds(programIds),
      ids.length
        ? supabase.from('workout_feedback')
            .select('id, athlete_id, workout_id, completed_date, submitted_at, rpe, emoji_rating, notes, exercises_completed, exercises_total, workouts(name)')
            .in('athlete_id', ids)
            .order('submitted_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    const programs = programsRes.data || []
    const programsById = new Map(programs.map(p => [p.id, p]))
    const feedback = fbRes.data || []

    const completedMap = new Map()
    feedback.forEach(f => {
      if (!f.athlete_id || !f.completed_date) return
      if (!completedMap.has(f.athlete_id)) completedMap.set(f.athlete_id, new Set())
      completedMap.get(f.athlete_id).add(f.completed_date)
    })

    const streaks = computeStreaks(athletes, programsById, daysByProgram, completedMap)
    const rows = buildRosterStatus({ athletes, programsById, daysByProgram, feedback, streaks, today })
    setState({ loading: false, rows, feedback, programs, error: null })
  }, [coachId])

  useEffect(() => { load() }, [load])

  return { ...state, reload: load }
}
