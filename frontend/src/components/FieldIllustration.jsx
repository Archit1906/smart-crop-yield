// Hand-built SVG landscape: terraced fields with crop rows (no external images needed).
export default function FieldIllustration({ className = '' }) {
  const rows = (y0, n, gap, color, skew = 0) =>
    Array.from({ length: n }, (_, i) => (
      <path key={i} d={`M-20 ${y0 + i * gap} Q 400 ${y0 + i * gap - 18 + skew} 820 ${y0 + i * gap + 6}`}
        stroke={color} strokeWidth="1.4" fill="none" opacity={0.55} />
    ))
  return (
    <svg viewBox="0 0 800 520" className={className} role="img" aria-label="Illustration of terraced crop fields at sunrise" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3efe2" />
          <stop offset="1" stopColor="#e7eedb" />
        </linearGradient>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fc584" /><stop offset="1" stopColor="#7fae67" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d9450" /><stop offset="1" stopColor="#3f7a3f" /></linearGradient>
        <linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f6838" /><stop offset="1" stopColor="#1d4a2a" /></linearGradient>
        <linearGradient id="wheat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dcbc63" /><stop offset="1" stopColor="#c69a2b" /></linearGradient>
      </defs>
      <rect width="800" height="520" fill="url(#sky)" />
      <circle cx="610" cy="150" r="58" fill="#efd58b" opacity="0.85" />
      <circle cx="610" cy="150" r="86" fill="#efd58b" opacity="0.18" />
      <path d="M0 250 C 140 200 260 230 380 215 S 640 190 800 225 V520 H0Z" fill="#c4dbae" />
      <path d="M0 290 C 160 250 300 280 430 262 S 680 240 800 270 V520 H0Z" fill="url(#h1)" />
      <g clipPath="url(#c1)">{rows(300, 6, 14, '#e9f1df')}</g>
      <path d="M0 330 C 120 305 230 340 360 330 S 600 300 800 320 V520 H0Z" fill="url(#wheat)" />
      <g>{rows(345, 5, 12, '#f6e7b5', 4)}</g>
      <path d="M0 385 C 170 350 330 395 470 380 S 700 352 800 372 V520 H0Z" fill="url(#h2)" />
      <g>{rows(398, 7, 13, '#b9d99f', -2)}</g>
      <path d="M0 450 C 200 418 380 460 560 440 S 760 430 800 438 V520 H0Z" fill="url(#h3)" />
      <g>{rows(462, 5, 13, '#5d9450', 2)}</g>
      {/* a few plants in the foreground */}
      {[70, 140, 210, 650, 720].map((x, i) => (
        <g key={x} transform={`translate(${x} ${488 - (i % 2) * 6})`} stroke="#b9d99f" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 0 V-26" />
          <path d="M0 -12 C -10 -16 -14 -24 -14 -28 C -6 -26 0 -20 0 -14" fill="#7fae67" stroke="none" />
          <path d="M0 -18 C 10 -22 14 -30 14 -34 C 6 -32 0 -26 0 -20" fill="#9fc584" stroke="none" />
        </g>
      ))}
    </svg>
  )
}
