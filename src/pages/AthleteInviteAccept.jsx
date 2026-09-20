import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { PENDING_INVITE_KEY } from '../lib/athleteInvite'

export default function AthleteInviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  useEffect(() => { fetchInvite() }, [token])

  async function fetchInvite() {
    const { data } = await supabase
      .from('athletes')
      .select('id, full_name, user_id')
      .eq('invite_token', token)
      .single()

    if (!data || data.user_id) { setNotFound(true); setLoading(false); return }
    setAthlete(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { role: 'athlete' } },
    })
    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (data.session) {
      const { error: claimError } = await supabase.rpc('claim_athlete_invite', { p_invite_token: token, p_email: email })
      if (claimError) {
        setError(claimError.message)
        setSubmitting(false)
        return
      }
      navigate('/athlete')
    } else {
      // Email confirmation required before a session exists — finish the
      // claim once they come back and log in.
      localStorage.setItem(PENDING_INVITE_KEY, token)
      setNeedsConfirmation(true)
    }
    setSubmitting(false)
  }

  const inp = { width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)' }}>Loading...</div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--mu)', textAlign: 'center', padding: 20 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }}>Invite not found</p>
      <p style={{ fontSize: 13 }}>This link is invalid or has already been used.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <ChalkUpLogo size={36} />
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--tx)' }}>chalkup</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Welcome, {athlete.full_name.split(' ')[0]} — set up your portal login</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          {needsConfirmation ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
              <p style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 6 }}>Check your email to confirm your account.</p>
              <p style={{ fontSize: 12, color: 'var(--mu)' }}>Then come back and log in to finish setup.</p>
              <button onClick={() => navigate('/athlete/login')}
                style={{ marginTop: 16, width: '100%', padding: 12, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700 }}>
                Go to login →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Choose a password</label>
                <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>

              {error && <p style={{ fontSize: 12, color: '#F88080', textAlign: 'center' }}>{error}</p>}

              <button type="submit" disabled={submitting}
                style={{ width: '100%', padding: 12, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: submitting ? 0.7 : 1, marginTop: 4 }}>
                {submitting ? 'Setting up...' : 'Create my login →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
