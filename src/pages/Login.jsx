import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { useAuth } from '../hooks/useAuth'
import { AUTH_LINK_ERROR } from '../lib/supabase'

const ATHLETE_ACCOUNT_ERROR = 'This is an athlete account'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
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
      else navigate('/dashboard')
    } else {
      if (!name.trim()) { setError('Full name is required'); setLoading(false); return }
      const { error } = await signUp(email, password, name)
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  const inp = { width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: 'var(--ac)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏆</div>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', fontFamily: 'var(--font-head)' }}>chalkup</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Gymnastics workout planning for coaches</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', background: 'var(--br)', borderRadius: 'var(--r)', padding: 3, marginBottom: 22 }}>
            {['login', 'signup'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500, background: tab === t ? 'var(--s2)' : 'transparent', color: tab === t ? 'var(--tx)' : 'var(--mu)', transition: 'all .15s' }}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'signup' && (
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Full name</label>
                <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jelani Edwards" required />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Email</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, color: 'var(--mu)' }}>Password</label>
                {tab === 'login' && <Link to="/forgot-password" style={{ fontSize: 11, color: 'var(--mu)' }}>Forgot?</Link>}
              </div>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {notice && <p style={{ fontSize: 12, color: 'var(--ac)', textAlign: 'center' }}>{notice}</p>}

            {error && <p style={{ fontSize: 12, color: error.includes('Check your') ? 'var(--ac)' : '#E2695A', textAlign: 'center' }}>{error}</p>}

            {error.startsWith(ATHLETE_ACCOUNT_ERROR) && (
              <Link to="/athlete/login"
                style={{ display: 'block', width: '100%', padding: 12, background: 'var(--br)', color: 'var(--tx)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                Go to athlete portal →
              </Link>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading ? 'Please wait...' : tab === 'login' ? 'Log in →' : 'Create account →'}
            </button>
          </form>
        </div>

        <p style={{ fontSize: 12, color: 'var(--mu)', textAlign: 'center', marginTop: 16 }}>
          Athlete? <Link to="/athlete/login" style={{ color: 'var(--ac)' }}>Log in here →</Link>
        </p>
      </div>
    </div>
  )
}
