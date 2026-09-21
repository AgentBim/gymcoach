import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    // Always show the same success state regardless of whether the email
    // exists — resetPasswordForEmail doesn't error for an unknown address,
    // and echoing that distinction back to the form would leak which
    // emails are registered.
    if (error) setError(error.message)
    else setSent(true)
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
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Reset your coach account password</p>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
              <p style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 6 }}>If an account exists for that email, we've sent a reset link.</p>
              <p style={{ fontSize: 12, color: 'var(--mu)' }}>Check your inbox and follow the link to choose a new password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--mu)', display: 'block', marginBottom: 5 }}>Email</label>
                <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>

              {error && <p style={{ fontSize: 12, color: '#E2695A', textAlign: 'center' }}>{error}</p>}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 12, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
                {loading ? 'Sending...' : 'Send reset link →'}
              </button>
            </form>
          )}
          <p style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'center', marginTop: 16 }}>
            <Link to="/login" style={{ color: 'var(--mu)' }}>← Back to log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
