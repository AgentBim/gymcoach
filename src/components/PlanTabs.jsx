import { NavLink } from 'react-router-dom'

// Programs / Workouts / Exercises: the three sections under Plan.
const TABS = [
  { to: '/plan/programs', label: 'Programs' },
  { to: '/plan/workouts', label: 'Workouts' },
  { to: '/plan/exercises', label: 'Exercises' },
]

export default function PlanTabs() {
  return (
    <nav aria-label="Plan sections" style={{ display: 'flex', gap: 4, padding: '0 16px', borderBottom: '1px solid var(--br)', background: 'var(--bg)', overflowX: 'auto' }}>
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to}
          style={({ isActive }) => ({ padding: '14px 14px 12px', fontSize: 13.5, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
            color: isActive ? 'var(--ac)' : 'var(--mu2)', borderBottom: `2px solid ${isActive ? 'var(--ac)' : 'transparent'}`, marginBottom: -1 })}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
