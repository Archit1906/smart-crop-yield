import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, MapPin, CloudRain, Wheat, GitBranch, TrendingUp, Spline, Sigma, Trees, Scale, Database, Cpu, ChartColumn, Lightbulb } from 'lucide-react'
import FieldIllustration from '../components/FieldIllustration'
import CountUp from '../components/CountUp'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { fmt, MODEL_COLORS } from '../services/theme'

const ALGOS = [
  { key: 'cart', icon: GitBranch, name: 'CART', desc: 'A regression tree that splits on the factors that matter most.' },
  { key: 'boosting', icon: TrendingUp, name: 'Gradient Boosting', desc: '400 shallow trees, each one correcting the errors of the trees before it.' },
  { key: 'basis', icon: Spline, name: 'Adaptive Basis Functions', desc: 'B-spline expansions with knots at data quantiles, plus ridge regression.' },
  { key: 'gam', icon: Sigma, name: 'Generalized Additive Model', desc: 'Smooth, interpretable effect curves for each variable (pyGAM).' },
  { key: 'random_forest', icon: Trees, name: 'Random Forest & Voting', desc: 'Bagged trees, plus equal- and error-weighted ensembles of all models.' },
  { key: 'bma', icon: Scale, name: 'Bayesian Model Averaging', desc: 'Each model weighted by its posterior probability on validation data.' },
]

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } }

export default function Landing() {
  const { data: a } = useApi(() => api.analytics({}), 'analytics:{}')
  const { data: m } = useApi(() => api.modelMetrics(), 'model-metrics')
  const k = a?.kpis

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <FieldIllustration className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/85 to-paper/10" />
        <div className="relative mx-auto max-w-7xl px-5 pb-28 pt-20 md:pb-36 md:pt-28 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-forest-700/20 bg-white/70 px-3 py-1 text-xs font-medium text-forest-800">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-600" /> 8 models trained on {k ? <CountUp value={k.records} /> : '…'} district records
            </span>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.05] text-forest-950 md:text-[64px]">
              Predict Tomorrow's Harvest, <em className="font-display not-italic text-forest-600">Today.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              An intelligent crop yield prediction platform powered by machine learning and agricultural data.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/predict" className="inline-flex items-center gap-2 rounded-md bg-forest-800 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-forest-700">
                Predict Crop Yield <ArrowRight size={16} />
              </Link>
              <Link to="/analytics" className="inline-flex items-center gap-2 rounded-md border border-forest-800/25 bg-white/80 px-5 py-3 text-sm font-medium text-forest-900 hover:bg-white">
                Explore Analytics
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats from the dataset */}
      <section className="relative z-10 mx-auto -mt-14 max-w-7xl px-5 lg:px-8">
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-white shadow-sm md:grid-cols-5">
          {[
            { label: 'District-season records', value: k?.records },
            { label: 'Districts', value: k?.districts },
            { label: 'States & UTs', value: k?.states },
            { label: 'Crops modelled', value: k?.crops },
            { label: 'Best test R²', value: m?.best_model?.r2, decimals: 3 },
          ].map((s, i) => (
            <div key={s.label} className={`px-5 py-5 ${i ? 'border-l border-line' : ''} ${i === 4 ? 'col-span-2 border-t md:col-span-1 md:border-t-0' : ''} ${i === 2 ? 'border-t md:border-t-0' : ''} ${i === 3 ? 'border-t md:border-t-0' : ''}`}>
              <div className="num text-2xl font-medium text-forest-900 md:text-[28px]">
                {s.value != null ? <CountUp value={s.value} decimals={s.decimals || 0} /> : '—'}
              </div>
              <div className="mt-1 text-xs text-ink-3">{s.label}</div>
            </div>
          ))}
        </div>
        {k?.years && <p className="mt-2 text-right text-[11px] text-ink-3">Source: Ministry of Agriculture district statistics, {k.years[0]}–{k.years[1]}. All figures are computed live by the backend.</p>}
      </section>

      {/* About */}
      <section className="mx-auto mt-24 grid max-w-7xl gap-12 px-5 md:grid-cols-2 lg:px-8">
        <motion.div {...fade}>
          <div className="eyebrow">The platform</div>
          <h2 className="mt-2 text-3xl font-semibold text-forest-950">Yield estimates based on two decades of real district statistics</h2>
        </motion.div>
        <motion.div {...fade} className="space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>Choose a district, a crop and a season. CropCast runs your inputs through five trained regression models and three ways of combining them, then reports the expected yield in <strong className="text-ink">tonnes per hectare</strong>.</p>
          <p>Every number comes from the Ministry of Agriculture's district crop statistics and IMD rainfall records. We don't fill in missing weather or soil data with made-up values. The form only asks for what the models were actually trained on.</p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto mt-20 max-w-7xl px-5 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
          {[
            { icon: MapPin, t: 'District-level inputs', d: 'Predictions are personalised to the selected state, district, crop and season.' },
            { icon: CloudRain, t: 'Rainfall sensitivity', d: 'See how every model expects yield to respond as annual rainfall changes.' },
            { icon: ChartColumn, t: 'Transparent evaluation', d: 'R², MAE, MSE and RMSE are all computed on one shared held-out test set.' },
            { icon: Wheat, t: 'Historical context', d: 'Each prediction is shown next to the district\'s recorded yields.' },
          ].map((f) => (
            <motion.div key={f.t} {...fade} className="bg-white p-6">
              <f.icon size={20} className="text-forest-600" />
              <h3 className="mt-4 font-sans text-[15px] font-semibold text-ink">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Algorithms */}
      <section className="mx-auto mt-24 max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="eyebrow">Unit 5 – Combining Models</div>
            <h2 className="mt-2 text-3xl font-semibold text-forest-950">Supported ML algorithms</h2>
          </div>
          <Link to="/models" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">Compare all models <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {ALGOS.map((al) => {
            const r = m?.metrics?.find((x) => x.key === al.key)
            return (
              <motion.div key={al.key} {...fade} className="card group p-5 transition hover:border-forest-600/40">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-sprout-100 text-forest-700"><al.icon size={18} /></span>
                  {r && <span className="num text-xs text-ink-3">test R² <span className="text-ink">{fmt(r.r2, 3)}</span></span>}
                </div>
                <h3 className="mt-4 flex items-center gap-2 font-sans text-[15px] font-semibold text-ink">
                  <span className="h-2 w-2 rounded-sm" style={{ background: MODEL_COLORS[al.key] }} />{al.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{al.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-7xl px-5 lg:px-8">
        <div className="rounded-lg bg-forest-900 px-6 py-12 text-white md:px-12">
          <div className="eyebrow !text-sprout-300">How it works</div>
          <h2 className="mt-2 text-3xl font-semibold">From raw statistics to insight in four steps</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              { icon: Database, t: 'Input Data', d: 'Location, crop, season, year, area and rainfall.' },
              { icon: Cpu, t: 'ML Models', d: m?.split ? `Five base learners, each trained on ${m.split.train.toLocaleString('en-IN')} records.` : 'Five base learners trained on the same records.' },
              { icon: Wheat, t: 'Yield Prediction', d: 'Per-model predictions plus the ensemble and BMA combinations.' },
              { icon: Lightbulb, t: 'Agricultural Insights', d: 'Feature effects, rainfall response and historical trends.' },
            ].map((s, i) => (
              <motion.div key={s.t} {...fade} transition={{ delay: i * 0.08, duration: 0.5 }} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-sprout-200"><s.icon size={19} /></span>
                  {i < 3 && <ArrowRight size={16} className="hidden text-sprout-300/60 md:block" />}
                </div>
                <div className="num mt-4 text-xs text-sprout-300">0{i + 1}</div>
                <h3 className="mt-1 font-sans text-base font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-sprout-100/70">{s.d}</p>
              </motion.div>
            ))}
          </div>
          <Link to="/how-it-works" className="mt-10 inline-flex items-center gap-2 rounded-md bg-sprout-200 px-4 py-2.5 text-sm font-medium text-forest-950 hover:bg-white">
            Read the full ML pipeline <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  )
}
