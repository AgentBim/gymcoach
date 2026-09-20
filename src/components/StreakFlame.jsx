import { useState } from 'react'

const TOOLTIP_TEXT = "Consecutive days you've completed what's due. Rest days (or days with nothing assigned) never cost you your streak — only a missed training day does."

/** Small flame + count badge used in the athlete portal header, roster rows, and profile tiles. */
export function StreakFlame({ streak, size = 'md', showTooltip = true }) {
  const [open, setOpen] = useState(false)
  if (!streak || streak <= 0) return null

  const fontSize = size === 'sm' ? 11 : 13
  const iconSize = size === 'sm' ? 12 : 15

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        onClick={() => showTooltip && setOpen(o => !o)}
        onMouseEnter={() => showTooltip && setOpen(true)}
        onMouseLeave={() => showTooltip && setOpen(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,140,40,.12)', border: '1px solid rgba(255,140,40,.3)',
          borderRadius: 20, padding: size === 'sm' ? '2px 7px' : '4px 10px',
          cursor: showTooltip ? 'pointer' : 'default',
        }}>
        <span style={{ fontSize: iconSize }}>🔥</span>
        <span style={{ fontSize, fontWeight: 700, color: '#FFA94D' }}>{streak}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
          width: 220, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 10,
          padding: '10px 12px', fontSize: 11, color: 'var(--mu)', lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {TOOLTIP_TEXT}
        </div>
      )}
    </div>
  )
}
