import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { buildThreads } from './inbox'

const HISTORY_DAYS = 90
const FEEDBACK_DAYS = 21

/** Everything the Inbox shows, fetched in one go and folded into threads. */
export function useInbox(coachId) {
  const [state, setState] = useState({ loading: true, threads: [], messages: [], requests: [], athletes: [] })

  const load = useCallback(async () => {
    if (!coachId) return
    const since = d => new Date(Date.now() - d * 86400000).toISOString()
    const [aRes, mRes, fRes, sRes, rRes] = await Promise.all([
      supabase.from('athletes').select('id, full_name, group_name, user_id, active_program_id, program_started_on').eq('coach_id', coachId).order('full_name'),
      supabase.from('messages').select('*').eq('coach_id', coachId).gte('created_at', since(HISTORY_DAYS)).order('created_at'),
      supabase.from('workout_feedback').select('id, athlete_id, submitted_at, rpe, emoji_rating, notes, workouts(name)').gte('submitted_at', since(FEEDBACK_DAYS)).order('submitted_at'),
      supabase.from('thread_state').select('*').eq('coach_id', coachId),
      supabase.from('schedule_requests').select('*').eq('coach_id', coachId).order('created_at'),
    ])
    const athletes = aRes.data || []
    const messages = mRes.data || []
    const requests = rRes.data || []
    const threads = buildThreads({ athletes, messages, feedback: fRes.data || [], states: sRes.data || [], requests })
    setState({ loading: false, threads, messages, requests, athletes })
  }, [coachId])

  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}
