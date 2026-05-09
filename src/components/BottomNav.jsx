import { NavLink, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()

  const tab = (to, icon, label, exact) => (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        padding: '8px 4px',
        textDecoration: 'none',
        color: isActive ? 'var(--ac)' : 'var(--mu)',
        fontSize: 10,
        fontWeight: isActive ? 600 : 400,
        transition: 'color .15s',
      })}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'calc(60px + env(safe-area-inset-bottom))',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'var(--s1)',
      borderTop: '1px solid var(--br)',
      display: 'flex',
      alignItems: 'stretch',
      zIndex: 100,
    }}>
      {tab('/dashboard', '🏠', 'Home', true)}
      {tab('/roster', '🤸', 'Roster', true)}

      {/* Centre new workout button */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => navigate('/workout/new')}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--ac)', border: 'none', color: '#0C1118',
            fontSize: 26, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(168,237,82,.35)', cursor: 'pointer', marginBottom: 4,
          }}
        >＋</button>
      </div>

      {tab('/history', '📊', 'History', true)}
      {tab('/library', '📚', 'Library', true)}
    </nav>
  )
}
