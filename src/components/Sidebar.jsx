import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AppIcon from './AppIcon'
import { ChalkUpLogo } from './ChalkUpLogo'

const navigation = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/roster', icon: 'roster', label: 'Roster' },
  { to: '/programs', icon: 'programs', label: 'Programs' },
  { to: '/history', icon: 'history', label: 'History' },
  { to: '/library', icon: 'library', label: 'Exercise library' },
]

export default function Sidebar() {
  const { coach, signOut } = useAuth()
  const navigate = useNavigate()
  const initials = coach?.full_name
    ? coach.full_name.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2)
    : 'GC'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar" aria-label="Coach workspace">
      <NavLink to="/dashboard" className="sidebar__brand" aria-label="ChalkUp dashboard">
        <ChalkUpLogo size={32} />
        <span className="sidebar__brand-name">ChalkUp</span>
      </NavLink>
      <nav className="sidebar__nav" aria-label="Primary navigation">
        <p className="sidebar__section-label">Workspace</p>
        {navigation.map(item => (
          <NavLink key={item.to} to={item.to} className="sidebar__link">
            <AppIcon name={item.icon} className="sidebar__icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink to="/workout/new" className="sidebar__link sidebar__cta">
          <AppIcon name="plus" />
          <span>New workout</span>
        </NavLink>
      </nav>
      <div className="sidebar__profile">
        <div className="sidebar__avatar" aria-hidden="true">{initials}</div>
        <div className="sidebar__profile-copy">
          <div className="sidebar__profile-name">{coach?.full_name || 'Coach'}</div>
          <button type="button" onClick={handleSignOut} className="sidebar__signout">
            <AppIcon name="logout" size={15} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
