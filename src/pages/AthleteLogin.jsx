import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { useAthleteAuth } from '../hooks/useAthleteAuth'
import { supabase } from '../lib/supabase'
import { PENDING_INVITE_KEY } from '../lib/athleteInvite'

export default function AthleteLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
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

  const inp = { width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <ChalkUpLogo size={36} />
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', fontFamily: 'var(--font-head)' }}>chalkup</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Your training portal</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Email</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {error && <p style={{ fontSize: 12, color: '#E2695A', textAlign: 'center' }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading ? 'Please wait...' : 'Log in →'}
            </button>
          </form>
          <p style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'center', marginTop: 16 }}>
            New here? Ask your coach for an invite link.
          </p>
        </div>
      </div>
    </div>
  )
}
