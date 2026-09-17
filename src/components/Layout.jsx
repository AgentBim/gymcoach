import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useIsMobile } from '../hooks/useIsMobile'
import './Shell.css'

export default function Layout({ children }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="app-shell app-shell--mobile">
        <main className="app-main">
          {children}
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
