import { useId, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChalkUpLogo } from './ChalkUpLogo'
import { Icon, Label, WeekDots } from './ui'

// One frame for every signed-out screen (log in, forgot / reset password,
// invite). Desktop: a brand panel beside the form. Phone: the form alone under
// the wordmark.

const PANEL = {
  coach: { line: 'Plan the week. Spot who needs you.', note: 'Programs, check-ins and every athlete’s week in one place.' },
  athlete: { line: 'Show up. Log it. Keep the streak.', note: 'Your week, your workouts and a direct line to your coach.' },
}

function Wordmark({ size = 32 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <ChalkUpLogo size={size} />
      <span style={{ fontFamily: 'var(--font-head)', fontSize: size * 0.9, fontWeight: 800, color: 'var(--tx)', letterSpacing: '.01em' }}>chalkup</span>
    </span>
  )
}

function BrandPanel({ side }) {
  const p = PANEL[side] || PANEL.coach
  return (
    <aside aria-hidden="true" style={{ flex: '1 1 0', minWidth: 0, position: 'relative', overflow: 'hidden', background: 'var(--s1)', borderRight: '1px solid var(--br)', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 20% 85%, rgba(199,228,92,.13), transparent 70%)' }} />
      <div style={{ position: 'relative' }}><Wordmark size={34} /></div>
      <div style={{ position: 'relative', maxWidth: 520 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: 1.02, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-.01em' }}>{p.line}</h2>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--mu2)', marginTop: 18, maxWidth: 420 }}>{p.note}</p>
      </div>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 16, alignSelf: 'flex-start', padding: '14px 18px', border: '1px solid var(--br2)', borderRadius: 14, background: 'rgba(0,0,0,.18)' }}>
        <WeekDots days={['done', 'done', 'rest', 'done', 'today', 'future', 'rest']} size={20} gap={10} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ac)' }}><Icon name="flame" size={16} />14 day streak</span>
      </div>
    </aside>
  )
}

export function AuthShell({ side = 'coach', eyebrow, title, subtitle, children, footer }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg)' }}>
      {!isMobile && <BrandPanel side={side} />}
      <main style={{ flex: isMobile ? '1 1 auto' : '0 0 min(560px, 46%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: isMobile ? 'max(28px, calc(var(--sat) + 16px)) 20px 28px' : '48px 40px', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {isMobile && <div style={{ marginBottom: 36 }}><Wordmark size={30} /></div>}
          {eyebrow && <Label style={{ marginBottom: 10 }}>{eyebrow}</Label>}
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: isMobile ? 44 : 52, lineHeight: 1.04, fontWeight: 800, color: 'var(--tx)' }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--mu2)', marginTop: 10 }}>{subtitle}</p>}
          <div style={{ marginTop: 28 }}>{children}</div>
          {footer && <div style={{ marginTop: 24, fontSize: 14, color: 'var(--mu2)', textAlign: 'center' }}>{footer}</div>}
        </div>
      </main>
    </div>
  )
}

// Inputs are 16px so iOS doesn't zoom on focus, and 48px tall for thumbs.
export function AuthField({ label, type = 'text', value, onChange, action, ...rest }) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--mu2)' }}>{label}</label>
        {action}
      </div>
      <div style={{ position: 'relative' }}>
        <input id={id} type={isPassword && show ? 'text' : type} value={value} onChange={e => onChange(e.target.value)} {...rest}
          style={{ width: '100%', minHeight: 48, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 12, color: 'var(--tx)', padding: isPassword ? '0 64px 0 14px' : '0 14px', fontSize: 16, outline: 'none' }}
          onFocus={e => { e.target.style.borderColor = 'var(--ac)' }} onBlur={e => { e.target.style.borderColor = 'var(--br2)' }} />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: 4, top: 4, bottom: 4, padding: '0 12px', border: 'none', background: 'transparent', color: 'var(--mu2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{show ? 'Hide' : 'Show'}</button>
        )}
      </div>
    </div>
  )
}

export function AuthSubmit({ loading, children, ...rest }) {
  return (
    <button type="submit" disabled={loading} {...rest}
      style={{ width: '100%', minHeight: 52, border: 'none', borderRadius: 12, background: 'var(--ac)', color: 'var(--ac-ink)', fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>{children}</button>
  )
}

// tone: 'error' | 'ok' | 'info'
export function AuthMessage({ tone = 'error', children }) {
  const c = tone === 'error' ? '#E2695A' : 'var(--ac)'
  const bg = tone === 'error' ? 'rgba(226,105,90,.10)' : 'rgba(199,228,92,.08)'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} style={{ fontSize: 14, lineHeight: 1.5, color: c, background: bg, border: `1px solid ${tone === 'error' ? 'rgba(226,105,90,.3)' : 'rgba(199,228,92,.25)'}`, borderRadius: 12, padding: '10px 14px' }}>{children}</p>
  )
}

export function AuthLinkButton({ children, ...rest }) {
  return (
    <button type="button" {...rest}
      style={{ width: '100%', minHeight: 48, border: '1px solid var(--br2)', borderRadius: 12, background: 'transparent', color: 'var(--tx)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{children}</button>
  )
}

// Brand mark per Google's sign-in guidelines (colour G on a light button).
const G = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
)

export function AuthGoogleButton({ onClick, busy, children = 'Continue with Google' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, border: '1px solid #dadce0', borderRadius: 12, background: '#fff', color: '#1f1f1f', fontSize: 16, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
      {G}{busy ? 'Opening Google…' : children}
    </button>
  )
}

export function AuthDivider({ children = 'or' }) {
  return (
    <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0', color: 'var(--mu)', fontSize: 12.5 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--br)' }} />{children}<span style={{ flex: 1, height: 1, background: 'var(--br)' }} />
    </div>
  )
}
