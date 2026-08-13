import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { useAuth } from '../hooks/useAuth'

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

  const inp = { width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none' }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: 'var(--ac)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏆</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--tx)', margin: 0 }}>chalkup</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Gymnastics workout planning for coaches</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          <div role="tablist" aria-label="Authentication mode" style={{ display: 'flex', background: 'var(--br)', borderRadius: 'var(--r)', padding: 3, marginBottom: 22 }}>
            {['login', 'signup'].map(t => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setShowReset(false); setError('') }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500, background: tab === t ? 'var(--s2)' : 'transparent', color: tab === t ? 'var(--tx)' : 'var(--mu)', transition: 'all .15s' }}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'signup' && (
              <div>
                <label htmlFor="full-name" style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Full name</label>
                <input id="full-name" name="name" autoComplete="name" style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jelani Edwards" required />
              </div>
            )}
            <div>
              <label htmlFor="email" style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Email</label>
              <input id="email" name="email" autoComplete="email" style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label htmlFor="password" style={{ fontSize: 11, color: 'var(--mu)' }}>Password</label>
                {tab === 'login' && <button type="button" onClick={() => setShowReset(true)} style={{ background: 'none', border: 0, color: 'var(--ac)', fontSize: 11, padding: 0 }}>Forgot password?</button>}
              </div>
              <input id="password" name="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {error && <p style={{ fontSize: 12, color: error.includes('Check your') ? 'var(--ac)' : '#F88080', textAlign: 'center' }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading ? 'Please wait...' : tab === 'login' ? 'Log in →' : 'Create account →'}
            </button>
            {showReset && tab === 'login' && (
              <button type="button" disabled={loading} onClick={handlePasswordReset}
                style={{ width: '100%', padding: 10, background: 'transparent', color: 'var(--ac)', border: '1px solid var(--br2)', borderRadius: 'var(--r)', fontSize: 13 }}>
                Email reset link
              </button>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}
