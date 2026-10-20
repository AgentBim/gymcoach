import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AuthShell, AuthField, AuthSubmit, AuthMessage, AuthGoogleButton, AuthDivider } from '../components/AuthShell'
import { useAthleteAuth } from '../hooks/useAthleteAuth'
import { supabase } from '../lib/supabase'
import { PENDING_INVITE_KEY } from '../lib/athleteInvite'
import { signInWithGoogle, googleErrorMessage } from '../lib/oauth'

export default function AthleteLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const location = useLocation()
  const [error, setError] = useState(location.state?.error || '')
  const [googling, setGoogling] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAthleteAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If they arrived here after signing up from an invite link but email
    // confirmation delayed getting a session, finish claiming the invite now.
    const pendingToken = localStorage.getItem(PENDING_INVITE_KEY)
    if (pendingToken) {
      await supabase.rpc('claim_athlete_invite', { p_invite_token: pendingToken, p_email: email })
      localStorage.removeItem(PENDING_INVITE_KEY)
    }

    setLoading(false)
    navigate('/athlete')
  }

  async function handleGoogle() {
    setError(''); setGoogling(true)
    const { error } = await signInWithGoogle('/auth/callback?role=athlete')
    if (error) { setError(googleErrorMessage(error)); setGoogling(false) }
  }

  return (
    <AuthShell side="athlete" eyebrow="Athlete portal" title="Let’s train" subtitle="Log in to see today’s workout and your streak."
      footer={<>New here? Ask your coach for an invite link.<br /><Link to="/login" style={{ color: 'var(--mu2)', fontSize: 13, display: 'inline-block', marginTop: 10 }}>Coach? Log in here</Link></>}>
      <AuthGoogleButton onClick={handleGoogle} busy={googling} />
      <AuthDivider>or use email</AuthDivider>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" inputMode="email" required />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" required minLength={6} autoComplete="current-password"
          action={<Link to="/athlete/forgot-password" style={{ fontSize: 13, color: 'var(--mu2)' }}>Forgot?</Link>} />
        {error && <AuthMessage>{error}</AuthMessage>}
        <AuthSubmit loading={loading}>{loading ? 'Please wait…' : 'Log in'}</AuthSubmit>
      </form>
    </AuthShell>
  )
}
