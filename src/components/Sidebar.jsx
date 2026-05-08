import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ChalkUpLogo } from './ChalkUpLogo'

const s = {
  sidebar: { width: 200, minWidth: 200, background: 'var(--s1)', borderRight: '1px solid var(--br)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 },
  logo: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--br)' },
  logoIcon: { width: 28, height: 28, background: 'var(--ac)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 },
  logoText: { fontSize: 16, fontWeight: 700, color: 'var(--ac)', letterSpacing: '-0.03em' },
  nav: { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  link: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--mu)', transition: 'all .15s', textDecoration: 'none' },
  cta: { margin: '6px 8px', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ac)', background: 'rgba(168,237,82,.08)', border: '1px solid rgba(168,237,82,.2)', textDecoration: 'none' },
  avatar: { padding: '12px 16px', borderTop: '1px solid var(--br)', display: 'flex', alignItems: 'center', gap: 10 },
  avatarIcon: { width: 30, height: 30, background: 'rgba(168,237,82,.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ac)', flexShrink: 0 },
}

export default function Sidebar() {
  const { coach, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = coach?.full_name
    ? coach.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'GC'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const activeStyle = { color: 'var(--tx)', background: 'var(--br)' }

  return (
    <aside style={s.sidebar}>
      <div style={s.logo}>
        <ChalkUpLogo size={28} />
        <span style={s.logoText}>chalkup</span>
      </div>

      <nav style={s.nav}>
        <NavLink to="/dashboard" style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
          🏠 Dashboard
        </NavLink>
        <NavLink to="/roster" style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
          🤸 Roster
        </NavLink>
        <NavLink to="/library" style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
          📚 Exercise library
        </NavLink>
        <NavLink to="/workout/new" style={({ isActive }) => ({ ...s.cta, ...(isActive ? { opacity: 0.8 } : {}) })}>
          ＋ New workout
        </NavLink>
      </nav>

      <div style={s.avatar}>
        <div style={s.avatarIcon}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {coach?.full_name || 'Coach'}
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--mu)', padding: 0, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
