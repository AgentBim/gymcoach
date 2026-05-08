import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Layout({ children }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
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
