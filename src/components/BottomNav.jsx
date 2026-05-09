import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const tab = (to, icon, label, exact) => (
    <NavLink to={to} end={exact} onClick={() => setMoreOpen(false)}
      style={({ isActive }) => ({
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: '8px 4px',
        textDecoration: 'none',
        color: isActive ? 'var(--ac)' : 'var(--mu)',
        fontSize: 10, fontWeight: isActive ? 600 : 400, transition: 'color .15s',
      })}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )

  return (
    <>
      {/* More overlay */}
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 'calc(60px + env(safe-area-inset-bottom))',
              left: 0, right: 0, background: 'var(--s1)',
              borderTop: '1px solid var(--br)', borderRadius: '14px 14px 0 0',
              padding: '12px 0 8px',
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.07em', padding: '0 16px 10px' }}>More</div>
            {[
              { to: '/programs', icon: '📅', label: 'Programs' },
              { to: '/history',  icon: '📊', label: 'History' },
            ].map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px', textDecoration: 'none',
                  color: isActive ? 'var(--ac)' : 'var(--tx)',
                  fontSize: 15, borderBottom: '1px solid var(--br)',
                })}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--s1)', borderTop: '1px solid var(--br)',
        display: 'flex', alignItems: 'stretch', zIndex: 100,
      }}>
        {tab('/dashboard', '🏠', 'Home', true)}
        {tab('/roster', '🤸', 'Roster', true)}

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => { setMoreOpen(false); navigate('/workout/new') }}
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'var(--ac)', border: 'none', color: '#0C1118',
              fontSize: 24, fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(168,237,82,.35)', cursor: 'pointer', marginBottom: 4,
            }}>＋</button>
        </div>

        {tab('/library', '📚', 'Library', true)}

        <button onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '8px 4px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: moreOpen ? 'var(--ac)' : 'var(--mu)', fontSize: 10,
          }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>•••</span>
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
