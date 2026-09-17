import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const e2eBypass = import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH_BYPASS === 'true' && window.localStorage.getItem('chalkup-e2e-auth') === 'true'
  const [user, setUser] = useState(e2eBypass ? { id: 'e2e-coach', email: 'coach@example.test' } : null)
  const [coach, setCoach] = useState(e2eBypass ? { id: 'e2e-coach', full_name: 'Test Coach' } : null)
  const [loading, setLoading] = useState(!e2eBypass)

  useEffect(() => {
    if (e2eBypass) return undefined
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
  }, [e2eBypass])

  async function fetchCoach(id) {
    const { data } = await supabase.from('coaches').select('*').eq('id', id).single()
    setCoach(data)
    setLoading(false)
  }

  async function signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    return { error }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    return { error }
  }

  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, coach, loading, signUp, signIn, signOut, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
