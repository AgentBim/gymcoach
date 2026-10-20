import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell, AuthMessage } from '../components/AuthShell'

// Where Google sends people back to. The two portals share one auth pool, so
// signing in with Google can land an athlete on the coach login or the other
// way round. Check which kind of account this is and route (or bounce) it.
const COACH_ON_ATHLETE = 'This Google account isn’t linked to an athlete profile. Use the email your coach invited, or ask them for a new invite link.'
const ATHLETE_ON_COACH = 'This is an athlete account. Log in at the athlete portal instead.'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const role = params.get('role') === 'athlete' ? 'athlete' : 'coach'
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let done = false
    const home = role === 'athlete' ? '/athlete/login' : '/login'
    const bounce = message => { done = true; navigate(home, { replace: true, state: { error: message } }) }

    // Google/Supabase report problems (access_denied, cancelled consent) in the
    // query string or the hash depending on the flow.
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const err = params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error')
    if (err) { bounce(err.replace(/\+/g, ' ')); return }

    async function route(session) {
      if (done) return
      done = true
      const uid = session.user.id
      const { data: coachRow } = await supabase.from('coaches').select('id').eq('id', uid).maybeSingle()
      const { data: athleteRow } = await supabase.from('athletes').select('id').eq('user_id', uid).maybeSingle()
      if (role === 'athlete') {
        if (athleteRow) { navigate('/athlete', { replace: true }); return }
        await supabase.auth.signOut()
        navigate(home, { replace: true, state: { error: COACH_ON_ATHLETE } })
      } else {
        // An account that is both (shouldn't happen) is treated as the coach it was asked to be.
        if (coachRow) { navigate('/today', { replace: true }); return }
        await supabase.auth.signOut()
        navigate(home, { replace: true, state: { error: athleteRow ? ATHLETE_ON_COACH : 'We couldn’t find an account for that Google login. Try again.' } })
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => { if (session) route(session) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (session) route(session) })
    const timer = setTimeout(() => { if (!done) { done = true; setFailed('Google sign-in didn’t finish. Go back and try again.') } }, 10000)
    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  return (
    <AuthShell side={role} eyebrow="Google" title={failed ? 'Something went wrong' : 'Signing you in'}>
      {failed ? <AuthMessage>{failed}</AuthMessage> : <AuthMessage tone="info">Finishing up with Google…</AuthMessage>}
    </AuthShell>
  )
}
