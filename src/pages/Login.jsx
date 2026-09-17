import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { Alert, Button, Card, Field, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (tab === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
      else navigate('/dashboard')
    } else {
      if (!name.trim()) { setError('Full name is required'); setLoading(false); return }
      const { error } = await signUp(email, password, name)
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  async function handlePasswordReset() {
    setError('')
    if (!email.trim()) { setError('Enter your email address first.'); return }
    setLoading(true)
    const { error } = await requestPasswordReset(email.trim())
    setLoading(false)
    if (error) setError(error.message)
    else setError('Check your email for a password reset link.')
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <header className="auth-brand">
          <div className="auth-brand__lockup">
            <ChalkUpLogo size={42} />
            <h1>ChalkUp</h1>
          </div>
          <p>Gymnastics workout planning for coaches</p>
        </header>

        <Card padded className="auth-card">
          <div role="tablist" aria-label="Authentication mode" className="auth-tabs">
            {['login', 'signup'].map(t => (
              <button key={t} id={`${t}-tab`} type="button" role="tab" aria-selected={tab === t} aria-controls="authentication-panel" onClick={() => { setTab(t); setShowReset(false); setError('') }}
                className="auth-tab">
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form id="authentication-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} onSubmit={handleSubmit} className="auth-form">
            {tab === 'signup' && (
              <Field label="Full name" htmlFor="full-name">
                <Input id="full-name" name="name" autoComplete="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jelani Edwards" required aria-invalid={Boolean(error && !name.trim())} />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required aria-describedby={error ? 'auth-message' : undefined} />
            </Field>
            <Field label="Password" htmlFor="password" className="auth-password-field">
              {tab === 'login' && <button type="button" onClick={() => setShowReset(true)} className="auth-forgot">Forgot password?</button>}
              <Input id="password" name="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} aria-describedby={error ? 'auth-message' : tab === 'signup' ? 'signup-password-guidance' : undefined} />
            </Field>

            {tab === 'signup' && <p id="signup-password-guidance" className="auth-guidance">Use at least six characters. This reflects the current application policy.</p>}

            {error && <Alert id="auth-message" tone={error.includes('Check your') ? 'success' : 'error'}>{error}</Alert>}

            <Button type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Please wait...' : tab === 'login' ? 'Log in →' : 'Create account →'}
            </Button>
            {showReset && tab === 'login' && (
              <Button variant="secondary" disabled={loading} onClick={handlePasswordReset}>
                Email reset link
              </Button>
            )}
          </form>
        </Card>
      </div>
    </main>
  )
}
