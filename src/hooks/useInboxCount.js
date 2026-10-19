import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Unread-thread count for the Inbox badge. Refreshes on focus, every minute,
// and straight away when something in the app changes it (notifyInboxChanged).
const EVENT = 'inbox:changed'
export function notifyInboxChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function useInboxCounts() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ unread: 0, requests: 0 })

  const refresh = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase.rpc('coach_inbox_counts')
    if (!error && data) setCounts({ unread: data.unread || 0, requests: data.requests || 0 })
  }, [user])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener(EVENT, refresh)
    return () => { clearInterval(t); window.removeEventListener('focus', refresh); window.removeEventListener(EVENT, refresh) }
  }, [refresh])

  return counts
}

export function useInboxCount() {
  return useInboxCounts().unread
}
