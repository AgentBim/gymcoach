export function ChalkUpLogo({ size = 24 }) {
  const r = size * 0.22
  const pad = size * 0.10
  const bh = Math.max(2, size * 0.13)
  const gap = size * 0.10
  const totalH = bh * 3 + gap * 2
  const topY = (size - totalH) / 2
  const cx = size / 2
  const widths = [0.52, 0.38, 0.26]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2}
        rx={r} fill="#A8ED52" />
      {widths.map((w, i) => {
        const bw = size * w
        const x0 = cx - bw / 2
        const y0 = topY + i * (bh + gap)
        return (
          <rect key={i} x={x0} y={y0} width={bw} height={bh}
            rx={bh / 2} fill="#0C1118" />
        )
      })}
    </svg>
  )
}
