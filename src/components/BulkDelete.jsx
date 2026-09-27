import { useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

// Shared pieces for bulk delete on Home and Programs (mockup "Bulk delete").

const TONES = { warn: '#E7A23E', info: '#6BA9DE', muted: 'var(--mu2)', ok: '#4FB88A' }
const DANGER = '#E2695A'
const DANGER_INK = '#1A0E0C'

// Replaces the bottom nav on mobile while selecting; floats over the page on
// desktop (centered on the area right of the 200px sidebar).
export function SelectionBar({ hint, hintTone = 'muted', count, deleteLabel, onDelete }) {
  const isMobile = useIsMobile()
  const on = count > 0
  const button = (
    <button onClick={onDelete} disabled={!on}
      style={{ minHeight: isMobile ? 48 : 40, padding: '0 18px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: on ? 'pointer' : 'default',
        background: on ? DANGER : 'var(--br)', color: on ? DANGER_INK : 'var(--mu)' }}>
      🗑 {deleteLabel}
    </button>
  )
  const hintText = <span style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.4, color: TONES[hintTone] }}>{hint}</span>

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150, display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', background: 'var(--s1)', borderTop: '1px solid var(--br)' }}>
        {hintText}
        {button}
      </div>
    )
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, left: 'calc(50% + 100px)', transform: 'translateX(-50%)', zIndex: 150, width: 560, maxWidth: 'calc(100vw - 260px)', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 18px', borderRadius: 14, background: 'var(--s2)', border: '1px solid var(--br2)', boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
      {hintText}
      {button}
    </div>
  )
}

// rows: [{ tone: 'warn'|'info'|'muted'|'ok', text, toggle }]. A row with a
// toggle gets the keepToggle switch under its text.
export function ConfirmDeleteSheet({ title, subtitle, loading, rows = [], keepToggle, confirmLabel, confirmDisabled, busy, error, onConfirm, onClose }) {
  const isMobile = useIsMobile()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const disabled = loading || busy || confirmDisabled
  return (
    <div onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 480, maxWidth: '100%', maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '10px 16px calc(env(safe-area-inset-bottom) + 20px)' : 22 }}>
        {isMobile && <div style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, background: 'var(--br2)' }} />}
        <div>
          <h2 id="confirm-delete-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', fontFamily: 'var(--font-head, sans-serif)', color: 'var(--tx)' }}>{title}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.45 }}>{subtitle}</p>
        </div>

        {loading ? (
          <div style={{ padding: '14px 12px', borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--br)', fontSize: 12.5, color: 'var(--mu)' }}>Checking what else this changes…</div>
        ) : rows.length > 0 && (
          <div style={{ borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--br)' }}>
            {rows.map((row, i) => (
              <div key={i} style={{ padding: 12, borderTop: i ? '1px solid var(--br)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: TONES[row.tone], marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--tx)' }}>{row.text}</span>
                </div>
                {row.toggle && keepToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid var(--br)' }}>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{keepToggle.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>{keepToggle.hint}</span>
                    </span>
                    <button type="button" role="switch" aria-checked={keepToggle.checked} aria-label={keepToggle.label} onClick={() => keepToggle.onChange(!keepToggle.checked)}
                      style={{ width: 50, height: 30, flexShrink: 0, borderRadius: 15, border: 'none', padding: 3, cursor: 'pointer', display: 'flex', background: keepToggle.checked ? 'var(--ac)' : 'var(--br)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 12, background: '#ECEEE9', marginLeft: keepToggle.checked ? 20 : 0, transition: 'margin .15s' }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: DANGER }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row-reverse', gap: 8 }}>
          <button onClick={onConfirm} disabled={disabled}
            style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
              background: disabled ? 'var(--br)' : DANGER, color: disabled ? 'var(--mu)' : DANGER_INK }}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
          <button onClick={onClose} disabled={busy}
            style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ message, onClose }) {
  const isMobile = useIsMobile()
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div role="status"
      style={{ position: 'fixed', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 24, left: isMobile ? 16 : 'calc(50% + 100px)', right: isMobile ? 16 : 'auto',
        transform: isMobile ? 'none' : 'translateX(-50%)', zIndex: 450, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px 10px 14px', borderRadius: 12,
        background: '#ECEEE9', color: '#171C0E', boxShadow: '0 8px 24px rgba(0,0,0,.4)', maxWidth: isMobile ? 'none' : 480 }}>
      <span style={{ fontSize: 15 }}>✓</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{message}</span>
      <button onClick={onClose} aria-label="Dismiss" style={{ width: 44, height: 36, background: 'none', border: 'none', color: '#3A4240', fontSize: 18, cursor: 'pointer' }}>×</button>
    </div>
  )
}
