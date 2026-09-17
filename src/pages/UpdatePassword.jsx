import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import { Alert, Button, Card, Field, Input } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

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

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <header className="auth-brand">
          <div className="auth-brand__lockup">
            <ChalkUpLogo size={42} />
            <span className="auth-brand__name">ChalkUp</span>
          </div>
        </header>
        <Card padded className="auth-card">
          <form onSubmit={submit} className="auth-form" aria-describedby="password-guidance">
            <div className="auth-card__heading">
              <p className="auth-card__eyebrow">Account recovery</p>
              <h1>Choose a new password</h1>
              <p id="password-guidance">Use at least eight characters. Your reset link securely signed you in for this change.</p>
            </div>
            <Field label="New password" htmlFor="new-password">
              <Input id="new-password" name="new-password" autoComplete="new-password" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'password-error' : 'password-guidance'} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password">
              <Input id="confirm-password" name="confirm-password" autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'password-error' : 'password-guidance'} />
            </Field>
            {error && <Alert id="password-error">{error}</Alert>}
            <Button disabled={saving} type="submit" className="auth-submit">
              {saving ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
