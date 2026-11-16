import { useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Cell,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import { MODEL_COLORS, MODEL_SHORT, MODEL_ORDER, BRAND, fmt, fmtInt } from '../services/theme'
import { Segmented } from '../components/ui'

const LOG_TE = new Set(['crop_te', 'crop_season_te', 'state_crop_te', 'district_crop_te'])

export function ModelPicker({ value, onChange, keys = MODEL_ORDER }) {
  return (
    <select className="field-input !w-auto !py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {keys.map((k) => <option key={k} value={k}>{MODEL_SHORT[k]}</option>)}
    </select>
  )
}

export function ActualVsPredicted({ data, model, height = 300, logScale = true }) {
  const pts = data.map((d) => ({ x: Math.max(d.actual, 0.01), y: Math.max(d[model], 0.01), crop: d.crop }))
  const max = Math.max(...pts.map((p) => Math.max(p.x, p.y)))
  const scale = logScale ? 'log' : 'linear'
  const dom = logScale ? [0.01, Math.max(100, max * 1.2)] : [0, max * 1.05]
  const ticks = logScale ? [0.01, 0.1, 1, 10, 100].filter((t) => t <= dom[1]) : undefined
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ right: 12, bottom: 8 }}>
        <CartesianGrid />
        <XAxis dataKey="x" type="number" scale={scale} domain={dom} allowDataOverflow ticks={ticks} name="Actual" tickFormatter={(v) => fmt(v, v < 1 ? 2 : 0)}
          label={{ value: 'Actual yield (t/ha)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#7a7d72' }} height={40} />
        <YAxis dataKey="y" type="number" scale={scale} domain={dom} allowDataOverflow ticks={ticks} name="Predicted" width={48} tickFormatter={(v) => fmt(v, v < 1 ? 2 : 0)}
          label={{ value: 'Predicted', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#7a7d72' }} />
        <ReferenceLine segment={[{ x: dom[0], y: dom[0] }, { x: dom[1], y: dom[1] }]} stroke="#23251f" strokeDasharray="4 3" ifOverflow="hidden" />
        <Tooltip content={({ active, payload }) => active && payload?.length ? (
          <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
            <div className="font-medium text-ink">{payload[0].payload.crop}</div>
            <div className="num text-ink-2">actual {fmt(payload[0].payload.x, 3)} · predicted {fmt(payload[0].payload.y, 3)} t/ha</div>
          </div>) : null} />
        <Scatter data={pts} fill={MODEL_COLORS[model]} fillOpacity={0.55} shape="circle" />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function ResidualHist({ residuals, model, height = 260 }) {
  const data = residuals.bins.map((b, i) => ({ x: b, n: residuals.models[model].counts[i] }))
  const r = residuals.models[model]
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap={1} margin={{ right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="x" tickFormatter={(v) => fmt(v, 1)} interval={4} />
          <YAxis width={44} tickFormatter={(v) => fmtInt(v)} />
          <ReferenceLine x={data.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a)).x} stroke="#23251f" strokeDasharray="3 3" />
          <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip labelFormatter={(v) => `residual ≈ ${fmt(v, 2)} t/ha`} valueFormatter={(v) => `${fmtInt(v)} test rows`} />} />
          <Bar dataKey="n" name="Count" fill={MODEL_COLORS[model]} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="num mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
        <span>mean {fmt(r.mean, 3)}</span><span>std {fmt(r.std, 3)}</span><span>median |res| {fmt(r.median_abs, 3)} t/ha</span>
      </div>
    </>
  )
}

export function FeatureImportance({ importance, labels, model, height = 280 }) {
  const has = importance[model]
  const kinds = Object.keys(has || {})
  const [kind, setKind] = useState('permutation')
  const k = kinds.includes(kind) ? kind : kinds[0]
  const data = Object.entries(has[k]).map(([f, v]) => ({ name: labels[f] || f, value: v })).sort((a, b) => b.value - a.value)
  return (
    <>
      {kinds.length > 1 && (
        <div className="mb-2"><Segmented value={k} onChange={setKind} options={kinds.map((x) => ({ value: x, label: x === 'impurity' ? 'Impurity (MDI)' : 'Permutation' }))} /></div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 48 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => fmt(v, 2)} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v) => fmt(v, 4)} />} />
          <Bar dataKey="value" name={k === 'impurity' ? 'Share of impurity reduction' : 'Drop in R² when shuffled'} fill={MODEL_COLORS[model]} radius={[0, 4, 4, 0]} barSize={14}
            label={{ position: 'right', formatter: (v) => fmt(v, 3), fontSize: 10, fill: '#4d5047' }} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-ink-3">{k === 'impurity' ? 'Mean decrease in impurity: the share of total squared-error reduction from splits on each feature.' : 'Permutation importance: how much test R² (log scale) drops when the feature is randomly shuffled. Bigger = more relied on.'}</p>
    </>
  )
}

function describeSplit(n) {
  if (LOG_TE.has(n.feature)) return `≈ ${fmt(Math.expm1(n.threshold), 2)} t/ha`
  if (n.feature === 'log_area') return `≈ ${fmtInt(Math.expm1(n.threshold))} ha`
  if (n.feature === 'Annual_Rainfall') return `${fmtInt(n.threshold)} mm`
  if (n.feature === 'Crop_Year') return `${Math.floor(n.threshold)}`
  return fmt(n.threshold, 3)
}

function NodeBox({ n, depth }) {
  const isLeaf = !n.feature
  return (
    <div className={`${isLeaf ? 'w-[118px]' : 'w-[168px]'} shrink-0 rounded-md border px-2 py-1.5 text-[11px] leading-snug ${isLeaf ? 'border-sprout-300 bg-sprout-50' : depth === 0 ? 'border-forest-800 bg-forest-800 text-white' : 'border-line bg-white'}`}>
      {isLeaf ? (
        <>
          <div className="font-semibold text-forest-900">{fmt(n.value_tha, 2)} t/ha</div>
          <div className="text-[10px] text-ink-3">{fmtInt(n.samples)} rows{n.truncated ? ' · subtree' : ''}</div>
        </>
      ) : (
        <>
          <div className="font-semibold">{n.label} ≤ {fmt(n.threshold, 3)}</div>
          <div className={`text-[10px] ${depth === 0 ? 'text-sprout-200' : 'text-ink-3'}`}>({describeSplit(n)}) · {fmtInt(n.samples)} · mean {fmt(n.value_tha, 2)} t/ha</div>
        </>
      )}
    </div>
  )
}

// Left-to-right layout: a node, then its two children stacked vertically (yes on top, no below).
function TreeNode({ n, depth = 0 }) {
  if (!n.feature) return <NodeBox n={n} depth={depth} />
  return (
    <div className="flex items-center">
      <NodeBox n={n} depth={depth} />
      <div className="h-px w-4 shrink-0 bg-ink-3/40" />
      <div className="flex flex-col gap-2 border-l border-ink-3/40 py-1">
        {[['yes', n.left], ['no', n.right]].map(([lab, c]) => (
          <div key={lab} className="flex items-center">
            <div className="h-px w-3 shrink-0 bg-ink-3/40" />
            <span className="mx-0.5 w-5 text-[9px] font-semibold uppercase tracking-wider text-ink-3">{lab}</span>
            <TreeNode n={c} depth={depth + 1} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TreeView({ tree }) {
  return <div className="overflow-x-auto pb-2"><div className="w-max py-1">{<TreeNode n={tree} />}</div></div>
}

export function EffectChart({ effect, height = 170 }) {
  const data = effect.points.map((p) => ({ ...p, band: [p.lo, p.hi] }))
  const isArea = effect.feature === 'log_area'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ right: 6, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale={isArea ? 'log' : 'linear'} tick={{ fontSize: 10 }}
          tickFormatter={(v) => (isArea ? fmtCompactSafe(v) : effect.feature === 'Crop_Year' ? String(Math.round(v)) : fmt(v, v > 100 ? 0 : 1))} />
        <YAxis width={48} tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 2)} />
        <ReferenceLine y={0} stroke="#b5b2a5" />
        <Tooltip content={<ChartTooltip labelFormatter={(v) => fmt(v, 2)} valueFormatter={(v) => (Array.isArray(v) ? `${fmt(v[0], 3)} – ${fmt(v[1], 3)}` : fmt(v, 3))} names={{ band: '95% CI', effect: 'f(x)' }} />} />
        <Area dataKey="band" stroke="none" fill="#eda100" fillOpacity={0.18} isAnimationActive={false} />
        <Line dataKey="effect" stroke="#b07a00" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
const fmtCompactSafe = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))

export function MetricBars({ metrics, metric, height = 300 }) {
  const lowerBetter = metric !== 'r2' && metric !== 'r2_log'
  const data = MODEL_ORDER.map((k) => metrics.find((m) => m.key === k)).filter(Boolean)
  const vals = data.map((d) => d[metric])
  const min = Math.min(...vals), max = Math.max(...vals)
  const pad = (max - min) * 0.6 || 0.01
  const domain = lowerBetter ? [0, max * 1.08] : [Math.max(0, min - pad), Math.min(1, max + pad / 3)]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ right: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="key" tickFormatter={(k) => MODEL_SHORT[k]} interval={0} tick={{ fontSize: 10.5 }} tickLine={false} angle={-30} textAnchor="end" height={56} />
        <YAxis domain={domain} allowDataOverflow width={52} tickFormatter={(v) => fmt(v, metric.startsWith('r2') ? 3 : 2)} />
        <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip labelFormatter={(k) => MODEL_SHORT[k]} valueFormatter={(v) => fmt(v, 4)} />} />
        <Bar dataKey={metric} name={metric.toUpperCase().replace('_LOG', ' (log)')} radius={[4, 4, 0, 0]} barSize={34}
          label={{ position: 'top', formatter: (v) => fmt(v, metric.startsWith('r2') ? 4 : 3), fontSize: 10, fill: '#4d5047' }}>
          {data.map((d) => <Cell key={d.key} fill={MODEL_COLORS[d.key]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MultiLine({ data, keys, xFmt, yFmt, height = 260, xLabel, refX }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={xFmt} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fontSize: 11, fill: '#7a7d72' } : undefined} height={xLabel ? 36 : 30} />
        <YAxis width={46} domain={['auto', 'auto']} tickFormatter={yFmt} />
        {refX != null && <ReferenceLine x={refX} stroke="#7a7d72" strokeDasharray="3 3" />}
        <Tooltip content={<ChartTooltip labelFormatter={xFmt} names={MODEL_SHORT} valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
        <Legend formatter={(v) => MODEL_SHORT[v] || v} iconType="plainline" />
        {keys.map((k) => <Line key={k} dataKey={k} stroke={MODEL_COLORS[k] || BRAND} strokeWidth={2} dot={false} type="monotone" />)}
      </LineChart>
    </ResponsiveContainer>
  )
}
