import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchCoach(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchCoach(session.user.id)
      else { setCoach(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCoach(id) {
    const { data } = await supabase.from('coaches').select('*').eq('id', id).single()
    setCoach(data)
    setLoading(false)
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })

    // Supabase's anti-enumeration behavior: signing up with an email that's
    // already registered returns no error and no new email, just a
    // response whose user has no identities attached. Left unchecked, the
    // caller reports this as a normal "check your email" success.
    const alreadyRegistered = data?.user && data.user.identities?.length === 0
    if (alreadyRegistered) {
      return { error: { message: 'An account already exists for this email. Try logging in instead.' } }
    }

    return { error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    // The coach and athlete portals share one Supabase auth pool. Check
    // role at the point of login, not just via route guards, so an athlete
    // account's session never lingers even briefly after signing in here.
    const { data: coachRow } = await supabase.from('coaches').select('id').eq('id', data.user.id).single()
    if (!coachRow) {
      await supabase.auth.signOut()
      return { error: { message: 'This is an athlete account. Log in at the athlete portal instead.' } }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, coach, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
