import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell, AuthField, AuthSubmit, AuthMessage } from '../components/AuthShell'
import { supabase } from '../lib/supabase'

export default function AthleteForgotPassword() {
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
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <AuthShell side="athlete" eyebrow="Password reset" title="Forgot your password?" subtitle="Enter your email and we’ll send a link to choose a new one."
      footer={<Link to="/athlete/login" style={{ color: 'var(--mu2)' }}>← Back to log in</Link>}>
      {sent ? (
        <AuthMessage tone="ok">If an account exists for that email, we’ve sent a reset link. Check your inbox and follow it to choose a new password.</AuthMessage>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" inputMode="email" required />
          {error && <AuthMessage>{error}</AuthMessage>}
          <AuthSubmit loading={loading}>{loading ? 'Sending…' : 'Send reset link'}</AuthSubmit>
        </form>
      )}
    </AuthShell>
  )
}
