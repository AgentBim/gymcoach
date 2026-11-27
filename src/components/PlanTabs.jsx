import { NavLink } from 'react-router-dom'
import './PlanTabs.css'

// Programs / Workouts / Exercises: the three sections under Plan.
const TABS = [
  { to: '/plan/programs', label: 'Programs' },
  { to: '/plan/workouts', label: 'Workouts' },
  { to: '/plan/exercises', label: 'Exercises' },
]

export default function PlanTabs() {
  return (
    <nav aria-label="Plan sections" className="plan-tabs">
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to}
          className="plan-tab"
          style={({ isActive }) => ({ fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--ac)' : 'var(--mu2)', borderBottom: `2px solid ${isActive ? 'var(--ac)' : 'transparent'}` })}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
