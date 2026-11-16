import { MODEL_COLORS } from '../services/theme'

// Shared tooltip: text in ink tokens, a colored swatch carries series identity.
export default function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, names }) {
  if (!active || !payload?.length) return null
  const vf = valueFormatter || ((v) => (typeof v === 'number' ? v.toFixed(2) : v))
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      {label != null && <div className="mb-1 font-medium text-ink">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey + p.name} className="flex items-center gap-2 py-0.5 text-ink-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || MODEL_COLORS[p.dataKey] }} />
          <span>{names?.[p.dataKey] || p.name}</span>
          <span className="num ml-auto pl-3 text-ink">{vf(p.value, p)}</span>
        </div>
      ))}
    </div>
  )
}
