const TONES = {
  error: { color: '#E2695A', bg: 'rgba(226,105,90,.08)', bd: 'rgba(226,105,90,.3)', icon: '⚠' },
  warn:  { color: '#E7A23E', bg: 'rgba(231,162,62,.08)', bd: 'rgba(231,162,62,.3)', icon: '⚠' },
  info:  { color: '#6BA9DE', bg: 'rgba(107,169,222,.08)', bd: 'rgba(107,169,222,.3)', icon: 'ℹ' },
}

// A one-line callout inside a sheet: { tone: 'error'|'warn'|'info', text }.
export default function Notice({ notice }) {
  if (!notice) return null
  const t = TONES[notice.tone] || TONES.info
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: t.bg, border: `1px solid ${t.bd}` }}>
      <span aria-hidden="true" style={{ color: t.color, fontSize: 14, lineHeight: 1.3 }}>{t.icon}</span>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--tx)' }}>{notice.text}</span>
    </div>
  )
}
