export function ChalkUpLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="48" height="48" rx="10" fill="#0C1118"/>
      <path d="M34 12 A16 16 0 1 0 34 37" fill="none" stroke="#A8ED52" strokeWidth="5" strokeLinecap="round"/>
      <rect x="32" y="18" width="10" height="5" rx="2.5" fill="white" transform="rotate(-42 37 20.5)"/>
    </svg>
  )
}
