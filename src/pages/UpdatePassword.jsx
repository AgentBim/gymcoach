import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setSaving(true)
    const { error } = await updatePassword(password)
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/dashboard', { replace: true })
  }

  const inputStyle = { width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 'var(--r)', color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none' }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 16 }}>
      <form onSubmit={submit} style={{ width: 340, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Choose a new password</h1>
          <p style={{ color: 'var(--mu)', fontSize: 13 }}>Your reset link securely signed you in for this change.</p>
        </div>
        <div>
          <label htmlFor="new-password" style={{ display: 'block', color: 'var(--mu)', fontSize: 11, marginBottom: 5 }}>New password</label>
          <input id="new-password" autoComplete="new-password" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="confirm-password" style={{ display: 'block', color: 'var(--mu)', fontSize: 11, marginBottom: 5 }}>Confirm password</label>
          <input id="confirm-password" autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
        </div>
        {error && <p role="alert" style={{ color: '#F88080', fontSize: 12 }}>{error}</p>}
        <button disabled={saving} type="submit" style={{ padding: 12, background: 'var(--ac)', color: '#0C1118', border: 0, borderRadius: 'var(--r)', fontWeight: 700, opacity: saving ? .7 : 1 }}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </main>
  )
}
