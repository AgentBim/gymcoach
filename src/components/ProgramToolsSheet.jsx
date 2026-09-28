import { useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

const TOOLS = [
  { id: 'full', icon: '📅', title: 'Generate full program', desc: 'Every week at once: pick a split, how workouts vary between weeks, and progression with deloads', primary: true },
  { id: 'fill', icon: '🔀', title: 'Fill a week', desc: 'Randomize the days you pick in one week, with a body-part focus for each day' },
  { id: 'copy', icon: '⧉', title: 'Copy weeks', desc: 'Repeat one week across any others, either linked to the same workouts or as separate copies' },
]

// The builder's "Program tools" menu (mockup screen of the same name): a
// bottom sheet on mobile, a small dialog on desktop. onPick(id) with 'full',
// 'fill' or 'copy'.
export default function ProgramToolsSheet({ onPick, onClose }) {
  const isMobile = useIsMobile()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="program-tools-title" onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 460, maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '10px 16px calc(env(safe-area-inset-bottom) + 20px)' : 20 }}>
        {isMobile && <div style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, background: 'var(--br2)' }} />}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 id="program-tools-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', fontFamily: 'var(--font-head, sans-serif)', color: 'var(--tx)' }}>Program tools</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.45 }}>Everything here changes your draft only. Nothing is saved until you press Save, and every change can be undone.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 22, background: 'var(--s2)', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TOOLS.map(t => (
            <button key={t.id} type="button" onClick={() => onPick(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer', color: 'var(--tx)',
                background: t.primary ? 'rgba(199,228,92,.07)' : 'var(--s2)', border: `1px solid ${t.primary ? 'rgba(199,228,92,.3)' : 'var(--br)'}` }}>
              <span style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, fontSize: 20,
                background: t.primary ? 'var(--ac)' : 'var(--br)' }}>{t.icon}</span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</span>
                <span style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.4 }}>{t.desc}</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 18, color: 'var(--mu)' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
