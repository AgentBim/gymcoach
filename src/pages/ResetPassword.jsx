import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { supabase } from '../lib/supabase'

// Landing page for the link in a "reset your password" email. Coaches and
// athletes share one Supabase auth pool, so this one page handles both —
// after the password is set, it looks up which role the session belongs to
// and routes there rather than needing separate coach/athlete versions.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase's client auto-exchanges the recovery link's token for a
    // session on load (detectSessionInUrl), so by the time we check, a
    // valid link has already produced a session. The PASSWORD_RECOVERY
    // event covers the case where that exchange finishes just after mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }

    setLoading(true)
    const { data, error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const userId = data.user.id
    const { data: coachRow } = await supabase.from('coaches').select('id').eq('id', userId).single()
    if (coachRow) { navigate('/dashboard'); return }

    const { data: athleteRow } = await supabase.from('athletes').select('id').eq('user_id', userId).single()
    if (athleteRow) { navigate('/athlete'); return }

    setDone(true)
    setLoading(false)
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
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Choose a new password</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          {checking ? (
            <p style={{ fontSize: 13, color: 'var(--mu)', textAlign: 'center' }}>Verifying link...</p>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <p style={{ fontSize: 13, color: 'var(--tx)' }}>Password updated. Log in to continue.</p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 6 }}>This link is invalid or has expired.</p>
              <p style={{ fontSize: 12, color: 'var(--mu)' }}>Request a new one from the <Link to="/forgot-password" style={{ color: 'var(--ac)' }}>coach login</Link> or <Link to="/athlete/forgot-password" style={{ color: 'var(--ac)' }}>athlete portal</Link>.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>New password</label>
                <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Confirm password</label>
                <input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>

              {error && <p style={{ fontSize: 12, color: '#E2695A', textAlign: 'center' }}>{error}</p>}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 12, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                {loading ? 'Saving...' : 'Set new password →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
