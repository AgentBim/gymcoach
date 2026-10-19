import { NavLink } from 'react-router-dom'
import { useInboxCount } from '../hooks/useInboxCount'
import { COACH_NAV } from './Sidebar'
import { Icon } from './ui'

export default function BottomNav() {
  const unread = useInboxCount()
  return (
    <nav aria-label="Main"
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'var(--s1)', borderTop: '1px solid var(--br)',
        padding: '6px 8px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
      {COACH_NAV.map(item => (
        <NavLink key={item.to} to={item.to}
          style={({ isActive }) => ({ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52,
            fontSize: 11.5, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--ac)' : 'var(--mu2)' })}>
          <Icon name={item.icon} size={22} />
          {item.label}
          {item.badge && unread > 0 && (
            <span style={{ position: 'absolute', top: 4, left: 'calc(50% + 6px)', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#E2695A', color: '#1A0E0C', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
