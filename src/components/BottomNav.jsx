import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const RosterIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
  </svg>
)
const LibraryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const tab = (to, Icon, label, exact) => (
    <NavLink to={to} end={exact} onClick={() => setMoreOpen(false)}
      style={({ isActive }) => ({
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: '8px 4px',
        textDecoration: 'none',
        color: isActive ? 'var(--ac)' : 'var(--mu)',
        fontSize: 10, fontWeight: isActive ? 600 : 400, transition: 'color .15s',
      })}>
      {({ isActive }) => (
        <>
          <Icon isActive={isActive} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <>
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 'calc(60px + env(safe-area-inset-bottom))',
              left: 0, right: 0,
              background: 'var(--s1)',
              borderTop: '1px solid var(--br)',
              borderRadius: '16px 16px 0 0',
              padding: '12px 0 8px',
            }}>
            <div style={{ width: 32, height: 3, background: 'var(--br2)', borderRadius: 2, margin: '0 auto 14px' }} />
            {[
              { to: '/programs', icon: '📅', label: 'Programs' },
              { to: '/history',  icon: '📊', label: 'History'  },
            ].map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', textDecoration: 'none',
                  color: isActive ? 'var(--ac)' : 'var(--tx)',
                  fontSize: 15, borderBottom: '1px solid var(--br)',
                })}>
                <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(15,21,32,.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--br)',
        display: 'flex', alignItems: 'stretch', zIndex: 100,
      }}>
        {tab('/dashboard', HomeIcon,    'Home',    true)}
        {tab('/roster',    RosterIcon,  'Roster',  true)}

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => { setMoreOpen(false); navigate('/workout/new') }}
            style={{
              width: 46, height: 46, borderRadius: 15,
              background: 'var(--ac)', border: 'none', color: '#0C1118',
              fontSize: 24, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(168,237,82,.4)', cursor: 'pointer', marginBottom: 4,
            }}>＋</button>
        </div>

        {tab('/library', LibraryIcon, 'Library', true)}

        <button onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '8px 4px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: moreOpen ? 'var(--ac)' : 'var(--mu)', fontSize: 10,
          }}>
          <MoreIcon />
          <span style={{ fontWeight: moreOpen ? 600 : 400 }}>More</span>
        </button>
      </nav>
    </>
  )
}
