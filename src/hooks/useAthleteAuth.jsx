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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    // Mirror useAuth's coach check: verify role at login itself, not just
    // via route guards, so a coach account's session never lingers here.
    const { data: athleteRow } = await supabase.from('athletes').select('id').eq('user_id', data.user.id).single()
    if (athleteRow) return { error: null }

    // No linked athletes row — figure out why before blaming it on being a
    // coach account. A signed-up-but-never-linked athlete (the
    // email-confirmation redirect never completing the claim) looks
    // identical from here unless we actually check, and wrongly telling
    // someone "you're a coach" sends them chasing the wrong problem.
    const { data: coachRow } = await supabase.from('coaches').select('id').eq('id', data.user.id).single()
    await supabase.auth.signOut()
    if (coachRow) {
      return { error: { message: 'This is a coach account. Log in at the coach dashboard instead.' } }
    }
    return { error: { message: "Your invite hasn't finished linking to your coach's roster. Ask your coach to resend your invite link, or try the original invite link again." } }
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
