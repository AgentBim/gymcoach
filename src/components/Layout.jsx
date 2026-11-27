import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useIsMobile } from '../hooks/useIsMobile'
import { useLocation } from 'react-router-dom'
import './Layout.css'

export default function Layout({ children }) {
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const mobilePlan = isMobile && pathname.startsWith('/plan/')

  if (isMobile) {
    return (
      <div className={mobilePlan ? 'mobile-plan-layout' : undefined} style={{ display: 'flex', flexDirection: 'column', ...(!mobilePlan && { minHeight: '100vh' }) }}>
        <main className={mobilePlan ? 'mobile-plan-content' : undefined} style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: `calc(${mobilePlan ? 72 : 60}px + env(safe-area-inset-bottom))`,
        }}>
          {children}
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
