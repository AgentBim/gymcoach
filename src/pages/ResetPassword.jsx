import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthShell, AuthField, AuthSubmit, AuthMessage, AuthLinkButton } from '../components/AuthShell'
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
    if (coachRow) { navigate('/today'); return }

    const { data: athleteRow } = await supabase.from('athletes').select('id').eq('user_id', userId).single()
    if (athleteRow) { navigate('/athlete'); return }

    setDone(true)
    setLoading(false)
  }

  return (
    <AuthShell side="coach" eyebrow="Password reset" title="Choose a new password"
      subtitle={ready && !done ? 'Use at least 6 characters.' : undefined}>
      {checking ? (
        <AuthMessage tone="info">Verifying your link…</AuthMessage>
      ) : done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthMessage tone="ok">Password updated. Log in to continue.</AuthMessage>
          <AuthLinkButton onClick={() => navigate('/login')}>Go to log in</AuthLinkButton>
        </div>
      ) : !ready ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthMessage>This link is invalid or has expired.</AuthMessage>
          <p style={{ fontSize: 14, color: 'var(--mu2)', lineHeight: 1.5 }}>Request a new one from the <Link to="/forgot-password" style={{ color: 'var(--ac)', fontWeight: 600 }}>coach login</Link> or the <Link to="/athlete/forgot-password" style={{ color: 'var(--ac)', fontWeight: 600 }}>athlete portal</Link>.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthField label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" required minLength={6} />
          <AuthField label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Type it again" autoComplete="new-password" required minLength={6} />
          {error && <AuthMessage>{error}</AuthMessage>}
          <AuthSubmit loading={loading}>{loading ? 'Saving…' : 'Set new password'}</AuthSubmit>
        </form>
      )}
    </AuthShell>
  )
}
