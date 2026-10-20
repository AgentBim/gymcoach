import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeBestStreak, isDueOnDate, resolveDay, todayLocal } from '../lib/streaks'
import { computeStreaks } from '../lib/streakData'

// Everything the athlete portal screens share, loaded once: the athlete's
// program and personal overrides, their completions, messages and the streak.
// One loader so Today, Week, Progress and Coach can't disagree with each other
// (or with the coach's view, which goes through the same streaks.js rules).

const PortalContext = createContext(null)

const META = 'id, name, archived_at, workout_exercises(id), workout_prehab(id)'

export function AthletePortalProvider({ athlete, children }) {
  const [data, setData] = useState(null)
  const [today, setToday] = useState(todayLocal())

  const load = useCallback(async () => {
    if (!athlete) return
    const programId = athlete.active_program_id
    const [progRes, daysRes, ovRes, fbRes, asRes, msgRes, stRes, reqRes, coachRes] = await Promise.all([
      programId ? supabase.from('programs').select('id, name, duration_weeks').eq('id', programId).single() : Promise.resolve({ data: null }),
      programId ? supabase.from('program_days').select(`week_number, day_of_week, day_type, workout_id, notes, workouts(${META})`).eq('program_id', programId) : Promise.resolve({ data: [] }),
      supabase.from('athlete_day_overrides').select(`date, day_type, workout_id, notes, workouts(${META})`).eq('athlete_id', athlete.id),
      supabase.from('workout_feedback').select('id, workout_id, completed_date, submitted_at, rpe, emoji_rating, notes, exercises_completed, exercises_total, workouts(id, name)').eq('athlete_id', athlete.id).order('submitted_at', { ascending: false }),
      supabase.from('workout_assignments').select(`workouts(${META})`).eq('athlete_id', athlete.id).is('revoked_at', null),
      supabase.from('messages').select('id, sender, kind, body, request_id, created_at').eq('athlete_id', athlete.id).order('created_at'),
      supabase.from('thread_state').select('athlete_read_at').eq('athlete_id', athlete.id).maybeSingle(),
      supabase.from('schedule_requests').select('id, from_date, to_date, status, note, created_at').eq('athlete_id', athlete.id).order('created_at'),
      supabase.rpc('athlete_coach_name'),
    ])

    const program = progRes.data || null
    const meta = {}
    const note = w => { if (w) meta[w.id] = { id: w.id, name: w.name, exercises: w.workout_exercises?.length || 0, prehab: w.workout_prehab?.length || 0, archived: !!w.archived_at } }
    const cells = new Map()
    ;(daysRes.data || []).forEach(d => {
      cells.set(`${d.week_number}:${d.day_of_week}`, { workout_id: d.workout_id, day_type: d.day_type, notes: d.notes })
      note(d.workouts)
    })
    const overrides = new Map()
    ;(ovRes.data || []).forEach(o => {
      overrides.set(o.date, { day_type: o.day_type, workout_id: o.workout_id, notes: o.notes })
      note(o.workouts)
    })
    const assigned = (asRes.data || []).map(a => a.workouts).filter(w => w && !w.archived_at)
    assigned.forEach(note)

    const feedback = fbRes.data || []
    const feedbackByDate = new Map()
    ;[...feedback].reverse().forEach(f => { if (f.completed_date) feedbackByDate.set(f.completed_date, f) })
    const completed = new Set(feedbackByDate.keys())

    const programsById = new Map(program ? [[program.id, program]] : [])
    const daysByProgram = new Map(program ? [[program.id, cells]] : [])
    const streakInfo = computeStreaks([athlete], programsById, daysByProgram, new Map([[athlete.id, completed]]), new Map([[athlete.id, overrides]])).get(athlete.id)
    const dueCheck = d => isDueOnDate(d, program, athlete.program_started_on, cells, overrides)
    const t = todayLocal()
    const best = Math.max(streakInfo.streak, computeBestStreak({ today: t, completedDates: completed, dueCheck }))

    const messages = msgRes.data || []
    const readAt = stRes.data?.athlete_read_at ? new Date(stRes.data.athlete_read_at).getTime() : 0
    setToday(t)
    setData({
      program, cells, overrides, meta, assigned, feedback, feedbackByDate, completed, messages, requests: reqRes.data || [],
      coachName: coachRes.data || 'Your coach',
      streak: streakInfo.streak, best, todayLogged: streakInfo.todayLogged,
      coachUnread: messages.some(m => m.sender !== 'athlete' && new Date(m.created_at).getTime() > readAt),
    })
  }, [athlete])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    window.addEventListener('focus', load)
    return () => { clearInterval(t); window.removeEventListener('focus', load) }
  }, [load])

  const value = useMemo(() => {
    if (!data) return { loading: true, athlete, today, refresh: load }
    // What the schedule says for a date, with the workout's name and counts.
    const planFor = date => {
      const d = resolveDay(date, data.program, athlete.program_started_on, data.cells, data.overrides)
      const w = d.workoutId ? data.meta[d.workoutId] : null
      return { ...d, workout: w || null, name: w?.name || '' }
    }
    return { loading: false, athlete, today, refresh: load, planFor, ...data }
  }, [data, athlete, today, load])

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

export function useAthletePortal() {
  return useContext(PortalContext)
}
