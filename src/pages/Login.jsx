import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AuthShell, AuthField, AuthSubmit, AuthMessage, AuthGoogleButton, AuthDivider } from '../components/AuthShell'
import { Segmented } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { AUTH_LINK_ERROR } from '../lib/supabase'
import { signInWithGoogle, googleErrorMessage } from '../lib/oauth'

const ATHLETE_ACCOUNT_ERROR = 'This is an athlete account'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const location = useLocation()
  const [error, setError] = useState(location.state?.error || '')
  const [googling, setGoogling] = useState(false)
  const [notice, setNotice] = useState(AUTH_LINK_ERROR ? 'This email link has expired or was already used — just log in below.' : '')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    if (tab === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
      else navigate('/today')
    } else {
      if (!name.trim()) { setError('Full name is required'); setLoading(false); return }
      const { error } = await signUp(email, password, name)
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError(''); setNotice(''); setGoogling(true)
    const { error } = await signInWithGoogle('/auth/callback?role=coach')
    if (error) { setError(googleErrorMessage(error)); setGoogling(false) }
  }

  const signup = tab === 'signup'
  const isAthleteError = error.startsWith(ATHLETE_ACCOUNT_ERROR)
  const confirmMsg = error.includes('Check your')

  return (
    <AuthShell side="coach" eyebrow="Coach" title={signup ? 'Create your account' : 'Welcome back'}
      subtitle={signup ? 'Set up ChalkUp for your gym in a minute.' : 'Log in to see who needs you today.'}
      footer={<>Athlete? <Link to="/athlete/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Log in to your portal →</Link></>}>
      <Segmented label="Log in or sign up" value={tab} onChange={t => { setTab(t); setError('') }} style={{ marginBottom: 22 }}
        options={[{ value: 'login', label: 'Log in' }, { value: 'signup', label: 'Sign up' }]} />

      <AuthGoogleButton onClick={handleGoogle} busy={googling}>{signup ? 'Sign up with Google' : 'Continue with Google'}</AuthGoogleButton>
      <AuthDivider>or use email</AuthDivider>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {signup && <AuthField label="Full name" value={name} onChange={setName} placeholder="Jelani Edwards" autoComplete="name" required />}
        <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" inputMode="email" required />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" required minLength={6}
          autoComplete={signup ? 'new-password' : 'current-password'}
          action={!signup && <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--mu2)' }}>Forgot?</Link>} />

        {notice && <AuthMessage tone="ok">{notice}</AuthMessage>}
        {error && <AuthMessage tone={confirmMsg ? 'ok' : 'error'}>{error}</AuthMessage>}
        {isAthleteError && (
          <Link to="/athlete/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 12, border: '1px solid var(--br2)', color: 'var(--tx)', fontSize: 15, fontWeight: 700 }}>Go to athlete portal →</Link>
        )}

        <AuthSubmit loading={loading}>{loading ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</AuthSubmit>
      </form>
    </AuthShell>
  )
}
