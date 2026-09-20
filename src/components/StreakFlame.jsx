import { useState } from 'react'

/** Small flame + count badge used in the athlete portal header, roster rows, and profile tiles. */
export function StreakFlame({ streak, size = 'md', showTooltip = true }) {
  const [open, setOpen] = useState(false)
  if (!streak || streak <= 0) return null

  const fontSize = size === 'sm' ? 11 : 13
  const iconSize = size === 'sm' ? 12 : 15
  const tooltipText = `${streak}-day streak. Rest days (and days with nothing assigned) don't break it — only a missed training day does.`

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        onClick={() => showTooltip && setOpen(o => !o)}
        onMouseEnter={() => showTooltip && setOpen(true)}
        onMouseLeave={() => showTooltip && setOpen(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(199,228,92,.12)', border: '1px solid rgba(199,228,92,.3)',
          borderRadius: 999, padding: size === 'sm' ? '2px 7px' : '4px 10px',
          cursor: showTooltip ? 'pointer' : 'default',
        }}>
        <span style={{ fontSize: iconSize }}>🔥</span>
        <span style={{ fontSize, fontWeight: 700, color: 'var(--ac)', fontFamily: 'var(--mono)' }}>{streak}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
          width: 220, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 10,
          padding: '10px 12px', fontSize: 11, color: 'var(--mu)', lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {tooltipText}
        </div>
      )}
    </div>
  )
}
