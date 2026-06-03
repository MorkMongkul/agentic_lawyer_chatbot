export default function Logo({ size = 36, className = '' }) {
  const r    = Math.round(size * 0.22)
  const barW = Math.round(size * 0.53)
  const barH = Math.round(size * 0.11)
  const barX = Math.round((size - barW) / 2)
  const bar1Y = Math.round(size * 0.34)
  const bar2Y = Math.round(size * 0.55)
  const barR  = Math.round(barH / 2)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Legal AI logo"
      role="img"
    >
      <rect width={size} height={size} rx={r} fill="#BAEC17"/>
      <rect x={barX} y={bar1Y} width={barW} height={barH} rx={barR} fill="#111111"/>
      <rect x={barX} y={bar2Y} width={barW} height={barH} rx={barR} fill="#111111"/>
    </svg>
  )
}
