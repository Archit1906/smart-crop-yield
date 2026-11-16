import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { MapPin, Wheat, CloudRain, Tractor, ArrowRight, LoaderCircle, TriangleAlert, Ban, Award, RotateCcw, Info } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { PageHeader, Loading, ErrorState, Tip, ChartCard, Badge, Swatch } from '../components/ui'
import ChartTooltip from '../charts/ChartTooltip'
import { BASE_MODELS, MODEL_COLORS, MODEL_SHORT, fmt, fmtInt, BRAND } from '../services/theme'

const DEFAULTS = { State: 'Punjab', District: 'Ludhiana', Crop: 'Wheat', Season: 'Rabi', Crop_Year: 2014, Area: 250000, Annual_Rainfall: '' }

function Field({ label, help, error, unit, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
        {label}{unit && <span className="font-normal text-ink-3">({unit})</span>}{help && <Tip text={help} />}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  )
}

function GroupTitle({ icon: Icon, children }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-forest-700">
      <Icon size={14} /> {children}
    </div>
  )
}

export default function Predict() {
  const meta = useApi(() => api.metadata(), 'metadata')
  const [form, setForm] = useState(DEFAULTS)
  const [rainTouched, setRainTouched] = useState(false)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  const m = meta.data
  const help = useMemo(() => Object.fromEntries((m?.features || []).map((f) => [f.name, f.help])), [m])
  const districts = m?.districts?.[form.State] || []
  const seasons = m?.crop_seasons?.[form.Crop] || []
  const recordedRain = m?.rainfall_state_year?.[form.State]?.[String(form.Crop_Year)]
  const stateMeanRain = m?.rainfall_state_mean?.[form.State]

  // Pre-fill rainfall with the real recorded value for state + year (unless the user typed their own)
  useEffect(() => {
    if (!m || rainTouched) return
    const v = recordedRain ?? stateMeanRain
    if (v != null) setForm((f) => ({ ...f, Annual_Rainfall: Math.round(v * 10) / 10 }))
  }, [m, form.State, form.Crop_Year, rainTouched, recordedRain, stateMeanRain])

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'State') next.District = ''
      if (k === 'Crop' && !(m?.crop_seasons?.[v] || []).includes(f.Season)) next.Season = ''
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.State) e.State = 'Select a state.'
    if (!form.District) e.District = 'Select a district.'
    if (!form.Crop) e.Crop = 'Select a crop.'
    if (!form.Season) e.Season = 'Select a season.'
    const num = (k, lo, hi, int) => {
      const v = form[k]
      if (v === '' || v == null) return (e[k] = 'This field is required.')
      const n = Number(v)
      if (!Number.isFinite(n)) return (e[k] = 'Enter a number.')
      if (int && !Number.isInteger(n)) return (e[k] = 'Enter a whole year.')
      if (n < lo || n > hi) e[k] = `Must be between ${fmtInt(lo)} and ${fmtInt(hi)}.`
    }
    num('Crop_Year', m.year_range[0], m.year_range[1], true)
    num('Area', m.area_range[0], m.area_range[1])
    num('Annual_Rainfall', m.rainfall_range[0], m.rainfall_range[1])
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    setServerError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const r = await api.predict({ ...form, Crop_Year: Number(form.Crop_Year), Area: Number(form.Area), Annual_Rainfall: Number(form.Annual_Rainfall) })
      setResult(r)
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (err) {
      if (err.details) setErrors(err.details)
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (meta.loading) return <Loading />
  if (meta.error) return <ErrorState error={meta.error} onRetry={meta.reload} />

  const years = []
  for (let y = m.year_range[1]; y >= m.year_range[0]; y--) years.push(y)

  return (
    <>
      <PageHeader eyebrow="Crop yield prediction" title="Estimate the expected yield for a district and crop">
        Enter the location, crop and conditions below. Your inputs go to the Flask backend, which runs five trained models and three ways of combining them, then returns the predicted yield in tonnes per hectare.
      </PageHeader>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <form onSubmit={submit} noValidate className="card p-6 md:p-8">
            <div className="grid gap-8">
              <div>
                <GroupTitle icon={MapPin}>Geographical information</GroupTitle>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="State" help={help.State} error={errors.State}>
                    <select className="field-input" value={form.State} aria-invalid={!!errors.State} onChange={(e) => set('State', e.target.value)}>
                      <option value="">Select state…</option>
                      {m.states.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="District" help={help.District} error={errors.District} hint={form.State ? `${districts.length} districts in the data` : 'Choose a state first'}>
                    <select className="field-input" value={form.District} disabled={!form.State} aria-invalid={!!errors.District} onChange={(e) => set('District', e.target.value)}>
                      <option value="">Select district…</option>
                      {districts.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <GroupTitle icon={Wheat}>Crop & season</GroupTitle>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="Crop" help={help.Crop} error={errors.Crop}>
                    <select className="field-input" value={form.Crop} aria-invalid={!!errors.Crop} onChange={(e) => set('Crop', e.target.value)}>
                      <option value="">Select crop…</option>
                      {m.crops.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Agricultural season" help={help.Season} error={errors.Season}>
                    <select className="field-input" value={form.Season} disabled={!form.Crop} aria-invalid={!!errors.Season} onChange={(e) => set('Season', e.target.value)}>
                      <option value="">Select season…</option>
                      {seasons.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Crop year" help={help.Crop_Year} error={errors.Crop_Year}>
                    <select className="field-input" value={form.Crop_Year} aria-invalid={!!errors.Crop_Year} onChange={(e) => set('Crop_Year', Number(e.target.value))}>
                      {years.map((y) => <option key={y}>{y}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <GroupTitle icon={CloudRain}>Environmental parameters</GroupTitle>
                  <Field label="Annual rainfall" unit="mm" help={help.Annual_Rainfall} error={errors.Annual_Rainfall}
                    hint={recordedRain != null ? `Recorded for ${form.State}, ${form.Crop_Year}: ${fmt(recordedRain, 1)} mm` : stateMeanRain ? `No record for ${form.Crop_Year}; state average ${fmt(stateMeanRain, 0)} mm` : `Range ${fmtInt(m.rainfall_range[0])}–${fmtInt(m.rainfall_range[1])} mm`}>
                    <div className="flex gap-2">
                      <input type="number" step="any" className="field-input" value={form.Annual_Rainfall} min={m.rainfall_range[0]} max={m.rainfall_range[1]}
                        aria-invalid={!!errors.Annual_Rainfall}
                        onChange={(e) => { setRainTouched(true); set('Annual_Rainfall', e.target.value) }} />
                      {rainTouched && (
                        <button type="button" title="Use the recorded value" onClick={() => setRainTouched(false)}
                          className="shrink-0 rounded-md border border-line px-2.5 text-ink-2 hover:bg-paper-2"><RotateCcw size={15} /></button>
                      )}
                    </div>
                  </Field>
                </div>
                <div>
                  <GroupTitle icon={Tractor}>Agricultural information</GroupTitle>
                  <Field label="Cultivated area" unit="ha" help={help.Area} error={errors.Area}
                    hint={form.Crop && m.area_typical?.[form.Crop] ? `Typical district area for ${form.Crop}: ${fmtInt(m.area_typical[form.Crop])} ha` : null}>
                    <input type="number" step="any" className="field-input" value={form.Area} min={1} aria-invalid={!!errors.Area} onChange={(e) => set('Area', e.target.value)} />
                  </Field>
                </div>
              </div>

              {serverError && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {serverError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-forest-800 px-6 py-3 text-sm font-medium text-white hover:bg-forest-700 disabled:opacity-70">
                  {submitting ? <><LoaderCircle size={16} className="animate-spin" /> Running models…</> : <>Predict yield <ArrowRight size={16} /></>}
                </button>
                <button type="button" onClick={() => { setForm({ ...DEFAULTS, Annual_Rainfall: '' }); setRainTouched(false); setErrors({}); setResult(null); setServerError(null) }}
                  className="rounded-md px-4 py-3 text-sm text-ink-2 hover:bg-paper-2">Reset</button>
              </div>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-ink"><Ban size={15} className="text-ink-3" /> Inputs not used</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                These factors affect yield, but no real data for them can be matched to districts and years in the source datasets. The model doesn't use them, so the form doesn't ask for them.
              </p>
              <ul className="mt-3 space-y-2">
                {m.unsupported_features.map((f) => (
                  <li key={f.name} className="text-xs"><span className="font-medium text-ink-2">{f.name}</span><span className="block text-ink-3">{f.reason}</span></li>
                ))}
              </ul>
            </div>
            <div className="card p-5 text-xs leading-relaxed text-ink-3">
              <h3 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink"><Info size={15} className="text-ink-3" /> About the inputs</h3>
              Rainfall is the <strong className="text-ink-2">state-level</strong> annual total from IMD records, not a district measurement. Years are limited to {m.year_range[0]}–{m.year_range[1]}, the range covered by the training data.
            </div>
          </aside>
        </div>

        <AnimatePresence mode="wait">
          {result && <Results key={JSON.stringify(result.input)} r={result} />}
        </AnimatePresence>
      </div>
    </>
  )
}

function Results({ r }) {
  const inp = r.input
  const best = r.prediction_model
  const bars = r.predictions.map((p) => ({ ...p, short: MODEL_SHORT[p.key] }))
  const h = r.history
  const histData = h.records.map((x) => ({ year: x.year, actual: x.yield_tha }))
  const yrs = histData.map((d) => d.year)
  if (!yrs.includes(inp.Crop_Year)) histData.push({ year: inp.Crop_Year })
  histData.sort((a, b) => a.year - b.year)
  const predictedPoint = histData.find((d) => d.year === inp.Crop_Year)
  if (predictedPoint) predictedPoint.predicted = r.predicted_yield_tha
  const diffPct = h.district_mean_tha ? ((r.predicted_yield_tha - h.district_mean_tha) / h.district_mean_tha) * 100 : null

  return (
    <motion.section id="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} className="mt-12 scroll-mt-20">
      <div className="eyebrow">Prediction results</div>

      {/* Hero result */}
      <div className="mt-3 grid overflow-hidden rounded-lg border border-forest-800 md:grid-cols-[1.1fr_1fr]">
        <div className="relative bg-forest-900 p-7 text-white md:p-9">
          <div className="text-sm text-sprout-200/80">Predicted yield · {best.name}</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="num text-6xl font-medium md:text-7xl">{fmt(r.predicted_yield_tha, 2)}</span>
            <span className="text-lg text-sprout-200">t/ha</span>
          </div>
          <div className="mt-2 text-sm text-sprout-100/70">
            ≈ <span className="num text-white">{fmtInt(r.estimated_production_t)}</span> tonnes from {fmtInt(inp.Area)} ha
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-white/10 px-2.5 py-1">{inp.Crop}</span>
            <span className="rounded bg-white/10 px-2.5 py-1">{inp.District}, {inp.State}</span>
            <span className="rounded bg-white/10 px-2.5 py-1">{inp.Season}</span>
            <span className="rounded bg-white/10 px-2.5 py-1">{inp.Crop_Year}</span>
            <span className="rounded bg-white/10 px-2.5 py-1">{fmt(inp.Annual_Rainfall, 0)} mm rain</span>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-sprout-200/80">
            <Award size={14} /> Shown model = highest test R² ({fmt(r.predictions.find((p) => p.key === best.key)?.test_r2, 3)}) of all 8
          </div>
        </div>
        <div className="grid grid-cols-2 bg-white">
          {[
            { l: 'District historical mean', v: h.district_mean_tha, s: h.has_district_history ? `${h.records.length} recorded seasons` : 'No record for this combination' },
            { l: 'Difference vs district mean', v: diffPct, s: 'Prediction relative to history', pct: true },
            { l: `${inp.State} average (${inp.Crop})`, v: h.state_crop_yield_tha, s: 'Area-weighted, all years' },
            { l: `India average (${inp.Crop})`, v: h.national_crop_yield_tha, s: 'Area-weighted, all years' },
            { l: 'Spread across base models', v: r.spread.range, s: `${fmt(r.spread.min)} – ${fmt(r.spread.max)} t/ha` },
            { l: 'Model disagreement (CV)', v: r.spread.cv_percent, s: 'Std ÷ mean of 5 base models', pct: true, noSign: true },
          ].map((c, i) => (
            <div key={c.l} className={`border-line p-5 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t' : ''}`}>
              <div className="text-xs text-ink-3">{c.l}</div>
              <div className="num mt-1.5 text-xl text-ink">
                {c.v == null ? '—' : c.pct ? `${!c.noSign && c.v > 0 ? '+' : ''}${fmt(c.v, 1)}%` : `${fmt(c.v)} `}
                {!c.pct && c.v != null && <span className="text-xs text-ink-3">t/ha</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">{c.s}</div>
            </div>
          ))}
        </div>
      </div>
      {!h.has_district_history && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          This district has no recorded {inp.Crop} ({inp.Season}) seasons in the data. The models fall back to state and crop level patterns, so treat this estimate with extra caution.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Prediction from each model" subtitle="Yield in t/ha. The dashed line marks the headline prediction."
          footer="All base models share one training set. Voting = equal average, Weighted = inverse validation-MSE weights, BMA = posterior-probability weights.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bars} layout="vertical" margin={{ left: 10, right: 40 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fmt(v, 1)} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="short" width={92} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
              <ReferenceLine x={r.predicted_yield_tha} stroke="#23251f" strokeDasharray="4 3" />
              <Bar dataKey="yield_tha" name="Predicted yield" radius={[0, 4, 4, 0]} barSize={18}
                label={{ position: 'right', formatter: (v) => fmt(v, 2), fontSize: 11, fill: '#4d5047' }}>
                {bars.map((b) => <Cell key={b.key} fill={MODEL_COLORS[b.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="How BMA combines the models" subtitle="Final = Σ P(model | data) × prediction">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="py-2 font-medium">Model</th><th className="py-2 text-right font-medium">Prediction</th>
              <th className="py-2 text-right font-medium">BMA weight</th><th className="py-2 text-right font-medium">Weighted-ens.</th><th className="py-2 text-right font-medium">Test R²</th>
            </tr></thead>
            <tbody>
              {BASE_MODELS.map((k) => {
                const p = r.predictions.find((x) => x.key === k)
                return (
                  <tr key={k} className="border-b border-line/70">
                    <td className="py-2"><span className="flex items-center gap-2"><Swatch color={MODEL_COLORS[k]} />{MODEL_SHORT[k]}</span></td>
                    <td className="num py-2 text-right">{fmt(p.yield_tha, 3)}</td>
                    <td className="num py-2 text-right">{fmt(r.bma.weights[k], 4)}</td>
                    <td className="num py-2 text-right">{fmt(r.weighted.weights[k], 3)}</td>
                    <td className="num py-2 text-right text-ink-3">{fmt(p.test_r2, 3)}</td>
                  </tr>
                )
              })}
              {['voting', 'weighted', 'bma'].map((k) => {
                const p = r.predictions.find((x) => x.key === k)
                return (
                  <tr key={k} className="bg-paper/60">
                    <td className="py-2 font-medium"><span className="flex items-center gap-2"><Swatch color={MODEL_COLORS[k]} />{MODEL_SHORT[k]}</span></td>
                    <td className="num py-2 text-right font-medium">{fmt(p.yield_tha, 3)}</td>
                    <td colSpan={2} />
                    <td className="num py-2 text-right text-ink-3">{fmt(p.test_r2, 3)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            With tens of thousands of validation records, the likelihood gaps between models are huge. The posterior therefore puts almost all its weight on the most likely model, which is how BMA is expected to behave with a lot of data. <Link to="/models#bma" className="text-forest-700 underline">See the derivation</Link>.
          </p>
        </ChartCard>

        <ChartCard title="Rainfall sensitivity for this input" subtitle="Predicted yield (t/ha) as annual rainfall varies, with everything else held at your inputs"
          footer="Rainfall is state-level annual data, so its effect is small compared with location and crop history. Tree models give step-shaped responses; spline models give smooth curves.">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={r.rainfall_sensitivity} margin={{ right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => fmtInt(v)} />
              <YAxis tickFormatter={(v) => fmt(v, 1)} domain={['auto', 'auto']} width={44} />
              <Tooltip content={<ChartTooltip labelFormatter={(v) => `${fmtInt(v)} mm`} names={MODEL_SHORT} valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
              <Legend formatter={(v) => MODEL_SHORT[v]} iconType="plainline" />
              <ReferenceLine x={inp.Annual_Rainfall} stroke="#7a7d72" strokeDasharray="3 3" label={{ value: 'your input', fontSize: 10, fill: '#7a7d72', position: 'top' }} />
              {BASE_MODELS.map((k) => <Line key={k} dataKey={k} stroke={MODEL_COLORS[k]} strokeWidth={2} dot={false} type="monotone" />)}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Recorded yield: ${inp.District}, ${inp.Crop} (${inp.Season})`} subtitle="Actual district yields from the dataset, with the prediction for the selected year">
          {h.records.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={histData} margin={{ right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => fmt(v, 1)} width={44} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip names={{ actual: 'Recorded', predicted: 'Predicted' }} valueFormatter={(v) => `${fmt(v, 3)} t/ha`} />} />
                <Legend formatter={(v) => (v === 'actual' ? 'Recorded yield' : 'Prediction')} />
                <Line dataKey="actual" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line dataKey="predicted" stroke="#c69a2b" strokeWidth={0} dot={{ r: 6, fill: '#c69a2b', stroke: '#fff', strokeWidth: 2 }} legendType="circle" />
                {predictedPoint && <ReferenceDot x={inp.Crop_Year} y={r.predicted_yield_tha} r={0} />}
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="grid h-[280px] place-items-center text-sm text-ink-3">No recorded seasons for this district, crop and season.</div>}
        </ChartCard>
      </div>

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Engineered features sent to the models</summary>
        <p className="mt-2 text-xs text-ink-3">Your inputs are turned into these numbers by the same preprocessing pipeline used in training. Target-encoded values are on the log(1 + yield) scale.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(r.engineered_features).map(([k, v]) => (
            <div key={k} className="rounded-md bg-paper px-3 py-2"><div className="text-[11px] text-ink-3">{k}</div><div className="num text-sm">{fmt(v, 4)}</div></div>
          ))}
        </div>
      </details>

      <div className="mt-6 flex items-start gap-3 rounded-md border border-line bg-paper-2/60 px-5 py-4 text-xs leading-relaxed text-ink-2">
        <Badge tone="amber">Disclaimer</Badge> <span>{r.disclaimer}</span>
      </div>
    </motion.section>
  )
}
