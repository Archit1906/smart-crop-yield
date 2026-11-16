import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, Cell,
} from 'recharts'
import { Database, Wheat, MapPin, CalendarRange, Sprout, Ruler, ThermometerSun, RotateCcw } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { PageHeader, ChartCard, Stat, Loading, ErrorState, Segmented } from '../components/ui'
import ChartTooltip from '../charts/ChartTooltip'
import { BRAND, BRAND_SOFT, fmt, fmtInt, fmtCompact } from '../services/theme'

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="min-w-[150px] flex-1">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <select className="field-input !py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export default function Analytics() {
  const meta = useApi(() => api.metadata(), 'metadata')
  const [f, setF] = useState({ state: '', crop: '', season: '', year: '' })
  const key = 'analytics:' + JSON.stringify(f === null ? {} : Object.fromEntries(Object.entries(f).filter(([, v]) => v)))
  const an = useApi(() => api.analytics(f), key, [f])
  const [trendCrop, setTrendCrop] = useState('Rice')
  const tcrop = f.crop || trendCrop
  const tr = useApi(() => api.historicalTrends({ crop: tcrop, state: f.state }), `trends:${tcrop}:${f.state}`, [tcrop, f.state])
  const [cropScale, setCropScale] = useState('log')

  if (meta.loading) return <Loading />
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />
  const m = meta.data
  const years = []
  for (let y = m.year_range[1]; y >= m.year_range[0]; y--) years.push(String(y))
  const d = an.data
  const k = d?.kpis
  const isIndex = d?.metric?.key === 'yield_index'
  const metricFmt = (v) => (isIndex ? fmt(v, 2) + '×' : fmt(v, 2) + ' t/ha')
  const active = Object.values(f).some(Boolean)

  return (
    <>
      <PageHeader eyebrow="Analytics dashboard" title="Agricultural productivity across India">
        Every chart here is computed by the backend from {m.dataset.rows.toLocaleString('en-IN')} cleaned district-season records ({m.dataset.years[0]}–{m.dataset.years[1]}).
        Aggregate yields are area-weighted: total production ÷ total area.
      </PageHeader>

      <div className="sticky top-16 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-3 px-5 py-3 lg:px-8">
          <Select label="State" value={f.state} onChange={(v) => setF({ ...f, state: v })} options={m.states} placeholder="All states" />
          <Select label="Crop" value={f.crop} onChange={(v) => setF({ ...f, crop: v })} options={m.crops} placeholder="All crops" />
          <Select label="Season" value={f.season} onChange={(v) => setF({ ...f, season: v })} options={m.seasons} placeholder="All seasons" />
          <Select label="Year" value={f.year} onChange={(v) => setF({ ...f, year: v })} options={years} placeholder="All years" />
          <button disabled={!active} onClick={() => setF({ state: '', crop: '', season: '', year: '' })}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm text-ink-2 hover:bg-paper-2 disabled:opacity-40">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {an.error && <ErrorState error={an.error} onRetry={an.reload} />}
        {an.loading && !d && <Loading />}
        {d && (
          <div className={`transition-opacity ${an.loading ? 'opacity-50' : ''}`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Stat icon={Database} label="Records" value={fmtInt(k.records)} sub="district × season × year" />
              <Stat icon={Wheat} label="Crops" value={k.crops} sub="supported" />
              <Stat icon={MapPin} label="States" value={k.states} sub={`${fmtInt(k.districts)} districts`} />
              <Stat icon={CalendarRange} label="Seasons" value={k.seasons} sub={k.years ? `${k.years[0]}–${k.years[1]}` : '—'} />
              <Stat icon={Sprout} label={f.crop ? 'Average yield' : 'Yield index'} value={f.crop ? (k.avg_yield_tha != null ? `${fmt(k.avg_yield_tha)} t/ha` : '—') : (k.yield_index != null ? `${fmt(k.yield_index)}×` : '—')}
                sub={f.crop ? 'area-weighted' : 'pick a crop to see t/ha'} />
              <Stat icon={Ruler} label="Area covered" value={fmtCompact(k.total_area_ha)} sub="hectare-seasons" />
            </div>

            {d.empty ? (
              <div className="card mt-6 p-10 text-center text-sm text-ink-3">No records match these filters. Try removing one.</div>
            ) : (
              <>
                {isIndex && (
                  <p className="mt-4 rounded-md border border-line bg-white px-4 py-2.5 text-xs text-ink-2">
                    <strong>Yield index:</strong> averaging t/ha across different crops isn't meaningful (sugarcane yields about 70 t/ha, pulses under 1 t/ha). With no crop selected, the state, season and year charts show a unitless index: the median of each record's yield ÷ the national median for that crop, where 1.0 = typical. Select a crop to see t/ha.
                  </p>
                )}
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <ChartCard title="Crop-wise average yield" subtitle={`t/ha, area-weighted, ${d.crop_yield.length} crops`}
                    right={<Segmented value={cropScale} onChange={setCropScale} options={[{ value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }]} />}
                    className="lg:row-span-2">
                    <div style={{ height: Math.max(260, d.crop_yield.length * 20) }} className="max-h-[720px] overflow-y-auto">
                      <ResponsiveContainer width="100%" height={Math.max(260, d.crop_yield.length * 20)}>
                        <BarChart data={d.crop_yield} layout="vertical" margin={{ left: 4, right: 44 }} barCategoryGap={3}>
                          <CartesianGrid horizontal={false} />
                          <XAxis type="number" scale={cropScale} domain={cropScale === 'log' ? [0.05, 'auto'] : [0, 'auto']} allowDataOverflow tickFormatter={(v) => fmt(v, v < 1 ? 2 : 0)} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                          <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
                          <Bar dataKey="value" name="Yield" fill={BRAND} radius={[0, 4, 4, 0]} barSize={13}
                            label={{ position: 'right', formatter: (v) => fmt(v, v < 10 ? 2 : 1), fontSize: 10, fill: '#4d5047' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title={d.top_crops_mode === 'yield_growth' ? 'Top-performing crops: yield growth' : 'Top-performing crops vs national average'}
                    subtitle={d.top_crops_mode === 'yield_growth' ? `% change in area-weighted yield, ${d.top_crops[0]?.period || ''}` : 'Selection yield ÷ national yield for the same crop (1.0 = national)'}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={d.top_crops} layout="vertical" margin={{ left: 4, right: 48 }} barCategoryGap={4}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => (d.top_crops_mode === 'yield_growth' ? `${fmt(v, 0)}%` : `${fmt(v, 1)}×`)} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                        {d.top_crops_mode !== 'yield_growth' && <ReferenceLine x={1} stroke="#7a7d72" strokeDasharray="3 3" />}
                        <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v, p) => d.top_crops_mode === 'yield_growth'
                          ? `${fmt(v, 1)}% (${fmt(p.payload.early_tha)} → ${fmt(p.payload.late_tha)} t/ha)`
                          : `${fmt(v, 2)}× (${fmt(p.payload.yield_tha)} vs ${fmt(p.payload.national_tha)} t/ha)`} />} />
                        <Bar dataKey="value" name={d.top_crops_mode === 'yield_growth' ? 'Growth' : 'Relative yield'} radius={[0, 4, 4, 0]} barSize={14}
                          label={{ position: 'right', formatter: (v) => (d.top_crops_mode === 'yield_growth' ? `${fmt(v, 0)}%` : `${fmt(v, 2)}×`), fontSize: 10, fill: '#4d5047' }}>
                          {d.top_crops.map((c) => <Cell key={c.name} fill={c.value >= (d.top_crops_mode === 'yield_growth' ? 0 : 1) ? BRAND : '#c69a2b'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Season-wise yield comparison" subtitle={d.metric.label}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.season_yield} margin={{ right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" tickLine={false} />
                        <YAxis tickFormatter={(v) => fmt(v, 1)} width={40} />
                        {isIndex && <ReferenceLine y={1} stroke="#7a7d72" strokeDasharray="3 3" />}
                        <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v, p) => `${metricFmt(v)} · ${fmtInt(p.payload.records)} records`} />} />
                        <Bar dataKey="value" name={isIndex ? 'Index' : 'Yield'} fill={BRAND} radius={[4, 4, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div className="mt-6">
                  <ChartCard title="State-wise agricultural productivity" subtitle={d.metric.label}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={d.state_productivity} margin={{ bottom: 70, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 10.5 }} tickLine={false} height={20} />
                        <YAxis tickFormatter={(v) => fmt(v, 1)} width={40} />
                        {isIndex && <ReferenceLine y={1} stroke="#7a7d72" strokeDasharray="3 3" />}
                        <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v, p) => `${metricFmt(v)} · ${fmtInt(p.payload.records)} records`} />} />
                        <Bar dataKey="value" name={isIndex ? 'Index' : 'Yield'} radius={[4, 4, 0, 0]}>
                          {d.state_productivity.map((s) => <Cell key={s.name} fill={s.name === f.state ? '#c69a2b' : BRAND} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <ChartCard title="Year-wise yield trend" subtitle={`${d.metric.label}${f.year ? ' (the year filter is ignored for trends)' : ''}`}
                    footer={d.partial_years_excluded?.length ? `${d.partial_years_excluded.join(', ')} left out of trend lines: the source has only partial reporting for ${d.partial_years_excluded.length > 1 ? 'those years' : 'that year'}.` : null}>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={d.year_trend} margin={{ right: 12 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => fmt(v, isIndex ? 2 : 1)} domain={['auto', 'auto']} width={44} />
                        {f.year && <ReferenceLine x={Number(f.year)} stroke="#c69a2b" strokeDasharray="3 3" />}
                        <Tooltip content={<ChartTooltip valueFormatter={(v, p) => `${metricFmt(v)} · ${fmtInt(p.payload.records)} records`} />} />
                        <Line dataKey="value" name={isIndex ? 'Index' : 'Yield'} stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title={`Rainfall vs yield: ${d.rainfall_vs_yield.crop}`}
                    subtitle={d.rainfall_vs_yield.crop_was_selected ? 'Each dot is one district-season. The line shows area-weighted yield by rainfall decile.' : `No crop selected, so showing the most common crop in the selection (${d.rainfall_vs_yield.crop}).`}
                    footer={`Pearson correlation r = ${fmt(d.rainfall_vs_yield.correlation, 3)}. Rainfall is the state annual total, so every district in a state shares one value per year.`}>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart margin={{ right: 12 }}>
                        <CartesianGrid />
                        <XAxis dataKey="x" type="number" name="Rainfall" domain={['auto', 'auto']} tickFormatter={(v) => fmtInt(v)} label={{ value: 'Annual rainfall (mm)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#7a7d72' }} height={36} />
                        <YAxis dataKey="y" type="number" name="Yield" width={44} tickFormatter={(v) => fmt(v, 1)} />
                        <Tooltip content={<ChartTooltip labelFormatter={() => ''} valueFormatter={(v) => fmt(v, 2)} names={{ x: 'Rainfall (mm)', y: 'Yield (t/ha)' }} />} />
                        <Scatter data={d.rainfall_vs_yield.points} fill={BRAND_SOFT} fillOpacity={0.7} shape="circle" />
                        <Scatter data={d.rainfall_vs_yield.binned} fill={BRAND} line={{ stroke: BRAND, strokeWidth: 2 }} shape="circle" name="Decile mean" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                  <ChartCard title={`Historical trend: ${tcrop}${f.state ? `, ${f.state}` : ', India'}`}
                    subtitle={tr.data?.trend_tha_per_year != null ? `Linear trend ${tr.data.trend_tha_per_year > 0 ? '+' : ''}${fmt(tr.data.trend_tha_per_year, 3)} t/ha per year` : 'Yield and cultivated area per year'}
                    right={!f.crop && <select className="field-input !w-auto !py-1.5 text-xs" value={trendCrop} onChange={(e) => setTrendCrop(e.target.value)}>
                      {m.crops.map((c) => <option key={c}>{c}</option>)}</select>}>
                    {tr.loading && !tr.data ? <Loading /> : tr.data && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-medium text-ink-3">Yield (t/ha)</div>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={tr.data.series}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                              <YAxis width={36} domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, 1)} />
                              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
                              <Line dataKey="yield_tha" name="Yield" stroke={BRAND} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium text-ink-3">Cultivated area (thousand ha)</div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={tr.data.series}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                              <YAxis width={44} tickFormatter={(v) => fmtCompact(v)} />
                              <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v) => `${fmtInt(v)} kha`} />} />
                              <Bar dataKey="area_kha" name="Area" fill="#8fb878" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </ChartCard>

                  <div className="card flex flex-col justify-center p-6">
                    <ThermometerSun className="text-ink-3" />
                    <h3 className="mt-3 font-sans text-[15px] font-semibold text-ink">Temperature vs yield: not shown</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-3">{d.temperature_vs_yield.reason}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
