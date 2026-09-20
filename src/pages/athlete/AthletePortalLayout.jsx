import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ChalkUpLogo } from '../../components/ChalkUpLogo'
import { StreakFlame } from '../../components/StreakFlame'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { useAthleteStreak } from '../../hooks/useAthleteStreak'

export default function AthletePortalLayout() {
  const { athlete, signOut } = useAthleteAuth()
  const { streak, loading } = useAthleteStreak(athlete?.id)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/athlete/login')
  }

  const tab = (to, label, exact = true) => (
    <NavLink to={to} end={exact}
      style={({ isActive }) => ({
        flex: 1, textAlign: 'center', padding: '10px 4px', textDecoration: 'none',
        fontSize: 12, fontWeight: isActive ? 700 : 500,
        color: isActive ? 'var(--ac)' : 'var(--mu)',
        borderBottom: `2px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
      })}>
      {label}
    </NavLink>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'var(--s1)', borderBottom: '1px solid var(--br)',
        padding: '13px 16px', paddingTop: 'max(13px, calc(var(--sat) + 6px))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChalkUpLogo size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ac)', fontFamily: 'var(--font-head)' }}>chalkup</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!loading && <StreakFlame streak={streak} />}
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'var(--s1)', borderBottom: '1px solid var(--br)', position: 'sticky', top: 'calc(var(--sat) + 51px)', zIndex: 9 }}>
        {tab('/athlete', 'Today')}
        {tab('/athlete/history', 'History')}
        {tab('/athlete/program', 'Program', false)}
      </div>

      <div style={{ flex: 1, maxWidth: 600, width: '100%', margin: '0 auto', padding: '20px 16px', boxSizing: 'border-box' }}>
        <Outlet context={{ athleteId: athlete?.id }} />
      </div>
    </div>
  )
}
