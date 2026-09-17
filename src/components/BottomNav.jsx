import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'

const primaryItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/roster', icon: 'roster', label: 'Roster' },
  { to: '/library', icon: 'library', label: 'Library' },
]
const moreItems = [
  { to: '/programs', icon: 'programs', label: 'Programs' },
  { to: '/history', icon: 'history', label: 'History' },
]

function NavItem({ item, onClick }) {
  return (
    <NavLink to={item.to} end onClick={onClick} className="bottom-nav__item">
      <AppIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef(null)
  const isMoreRoute = moreItems.some(item => location.pathname.startsWith(item.to))

  useEffect(() => {
    if (!moreOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMoreOpen(false)
        moreButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [moreOpen])

  return (
    <>
      {moreOpen && (
        <>
          <button type="button" className="more-backdrop" aria-label="Close more navigation" onClick={() => setMoreOpen(false)} />
          <section id="more-navigation" className="more-sheet" aria-labelledby="more-navigation-title">
            <h2 id="more-navigation-title" className="more-sheet__title">More navigation</h2>
            {moreItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)} className="more-sheet__link">
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </section>
        </>
      )}
      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavItem item={primaryItems[0]} onClick={() => setMoreOpen(false)} />
        <NavItem item={primaryItems[1]} onClick={() => setMoreOpen(false)} />
        <button type="button" className="bottom-nav__item bottom-nav__create" aria-label="Create new workout" onClick={() => { setMoreOpen(false); navigate('/workout/new') }}>
          <AppIcon name="plus" size={25} />
        </button>
        <NavItem item={primaryItems[2]} onClick={() => setMoreOpen(false)} />
        <button ref={moreButtonRef} type="button" className={`bottom-nav__item${isMoreRoute ? ' bottom-nav__item--section-active' : ''}`} aria-expanded={moreOpen} aria-controls="more-navigation" onClick={() => setMoreOpen(open => !open)}>
          <AppIcon name="more" />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
