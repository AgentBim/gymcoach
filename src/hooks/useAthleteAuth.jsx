import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AthleteAuthContext = createContext(null)

// Parallel to useAuth (coaches), but resolves the session to an `athletes`
// row via user_id instead of a `coaches` row. Shares the same Supabase auth
// session as the coach app — a coach and an athlete can't be signed in at
// once in the same browser tab, which is fine since each normally uses
// their own device.
export function AthleteAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchAthlete(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchAthlete(session.user.id)
      else { setAthlete(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAthlete(userId) {
    const { data } = await supabase.from('athletes').select('*').eq('user_id', userId).single()
    setAthlete(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const refreshAthlete = useCallback(() => { if (user) fetchAthlete(user.id) }, [user])

  return (
    <AthleteAuthContext.Provider value={{ user, athlete, loading, signIn, signOut, refreshAthlete }}>
      {children}
    </AthleteAuthContext.Provider>
  )
}

export function useAthleteAuth() {
  return useContext(AthleteAuthContext)
}
