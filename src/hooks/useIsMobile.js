import { useState, useEffect } from 'react'

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= maxWidth)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const handler = e => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [maxWidth])

  return isMobile
}
