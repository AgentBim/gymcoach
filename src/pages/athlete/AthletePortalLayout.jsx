import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { AthletePortalProvider, useAthletePortal } from '../../hooks/useAthletePortal'
import { Icon } from '../../components/ui'

const TABS = [
  { to: '/athlete', end: true, icon: 'today', label: 'Today' },
  { to: '/athlete/week', icon: 'week', label: 'Week' },
  { to: '/athlete/progress', icon: 'progress', label: 'Progress' },
  { to: '/athlete/coach', icon: 'inbox', label: 'Coach', dot: true },
]

function Shell() {
  const portal = useAthletePortal()
  const { pathname } = useLocation()
  // The runner and the finish screen take over the whole phone.
  const chromeless = pathname.startsWith('/athlete/run') || pathname.startsWith('/athlete/finish')
  const onCoach = pathname.startsWith('/athlete/coach')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {!chromeless && !onCoach && (
        <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '12px 16px', paddingTop: 'max(12px, calc(var(--sat) + 6px))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 24, color: 'var(--ac)' }}>chalkup</span>
          {!portal.loading && portal.streak > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(199,228,92,.12)', border: '1px solid rgba(199,228,92,.3)', color: 'var(--ac)', fontSize: 13, fontWeight: 700 }}>
              <Icon name="flame" size={16} />{portal.streak} day streak
            </span>
          )}
        </header>
      )}

      <div style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', boxSizing: 'border-box', padding: chromeless || onCoach ? 0 : `18px 16px ${chromeless ? 0 : 96}px` }}>
        {portal.loading ? <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading…</div> : <Outlet />}
      </div>

      {!chromeless && (
        <nav aria-label="Main" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--s1)', borderTop: '1px solid var(--br)', padding: '6px 8px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {TABS.map(t => (
              <NavLink key={t.to} to={t.to} end={t.end}
                style={({ isActive }) => ({ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52, fontSize: 11.5, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--ac)' : 'var(--mu2)' })}>
                <Icon name={t.icon} size={22} />{t.label}
                {t.dot && portal.coachUnread && <span aria-label="Unread" style={{ position: 'absolute', top: 6, left: 'calc(50% + 8px)', width: 9, height: 9, borderRadius: '50%', background: '#E2695A' }} />}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default function AthletePortalLayout() {
  const { athlete } = useAthleteAuth()
  return (
    <AthletePortalProvider athlete={athlete}>
      <Shell />
    </AthletePortalProvider>
  )
}
