import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useInboxCount } from '../hooks/useInboxCount'
import { Avatar, Icon } from './ui'

// The four coach destinations from the redesign mockup. Shared with BottomNav.
export const COACH_NAV = [
  { to: '/today', icon: 'today', label: 'Today' },
  { to: '/athletes', icon: 'athletes', label: 'Athletes' },
  { to: '/inbox', icon: 'inbox', label: 'Inbox', badge: true },
  { to: '/plan', icon: 'plan', label: 'Plan' },
]

export default function Sidebar() {
  const { coach, signOut } = useAuth()
  const navigate = useNavigate()
  const unread = useInboxCount()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={{ width: 220, minWidth: 220, background: 'var(--s1)', borderRight: '1px solid var(--br)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, padding: '20px 14px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, color: 'var(--ac)', letterSpacing: '.01em', padding: '0 12px 18px' }}>chalkup</div>

      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {COACH_NAV.map(item => (
          <NavLink key={item.to} to={item.to}
            style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--ac)' : 'var(--mu2)', background: isActive ? 'rgba(199,228,92,.12)' : 'transparent' })}>
            <Icon name={item.icon} />
            {item.label}
            {item.badge && unread > 0 && (
              <span style={{ marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#E2695A', color: '#1A0E0C', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderTop: '1px solid var(--br)' }}>
        <Avatar name={coach?.full_name || 'Coach'} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coach?.full_name || 'Coach'}</div>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--mu2)', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>
    </aside>
  )
}
