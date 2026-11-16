import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Database, Eraser, WandSparkles, Cpu, Gauge, Wheat, Combine, ArrowRight, ArrowDown, GitBranch, TrendingUp, Spline, Sigma, Trees, Scale } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { PageHeader, Section, Loading, ErrorState, Formula, ChartCard } from '../components/ui'
import { TreeView, EffectChart, MetricBars } from '../charts/ModelCharts'
import { MODEL_COLORS, fmt, fmtInt } from '../services/theme'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts'

const STEPS = [
  { icon: Database, t: 'Data collection', d: 'District-level area and production for every crop and season, 1997–2015 (Ministry of Agriculture, via data.gov.in), joined with state-year annual rainfall (IMD) on State + Year.' },
  { icon: Eraser, t: 'Data cleaning', d: 'Drop rows with missing or zero production, remove duplicate keys, convert bales to tonnes, exclude crops with unconvertible units, drop very small plots and per-crop log-yield outliers (3 × IQR).' },
  { icon: WandSparkles, t: 'Feature engineering', d: 'Target = Production ÷ Area (t/ha), modelled as log(1 + yield). Categories become a cross-fitted hierarchical target encoding; area is log-transformed. Spline and GAM models also get standardisation and spline bases.' },
  { icon: Cpu, t: 'Model training', d: 'A stratified 70 / 15 / 15 split. Five base learners are trained on the same 70% training set; CART depth is tuned on validation.' },
  { icon: Gauge, t: 'Model evaluation', d: 'R², MAE, MSE and RMSE in t/ha on one shared test set, plus residuals, actual-vs-predicted plots, permutation importance and per-crop errors.' },
  { icon: Wheat, t: 'Yield prediction', d: 'The API validates your inputs, applies the saved feature pipeline (the same one used in training) and runs every saved model. Nothing is retrained per request.' },
  { icon: Combine, t: 'Model combination', d: 'Voting (equal weights), weighted (1/validation-MSE) and approximate Bayesian Model Averaging (validation likelihood → posterior weights).' },
]

function Unit({ id, icon: Icon, color, title, def, formula, impl, output, link }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} id={id}
      className="card grid gap-6 p-6 md:grid-cols-[1fr_1.1fr] md:p-7">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md text-white" style={{ background: color }}><Icon size={18} /></span>
          <h3 className="text-xl font-semibold text-forest-950">{title}</h3>
        </div>
        <dl className="mt-5 space-y-4 text-sm leading-relaxed">
          <div><dt className="eyebrow">Definition</dt><dd className="mt-1 text-ink-2">{def}</dd></div>
          <div><dt className="eyebrow">Mathematical intuition</dt><dd className="mt-1.5"><Formula>{formula}</Formula></dd></div>
          <div><dt className="eyebrow">Implementation in this project</dt><dd className="mt-1 text-ink-2">{impl}</dd></div>
        </dl>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="eyebrow mb-2">Actual output</div>
        <div className="flex-1 rounded-md border border-line bg-paper/50 p-3">{output}</div>
        <Link to={link} className="mt-3 inline-flex items-center gap-1 self-end text-xs font-medium text-forest-700 hover:text-forest-900">Full analysis <ArrowRight size={13} /></Link>
      </div>
    </motion.div>
  )
}

export default function HowItWorks() {
  const meta = useApi(() => api.metadata(), 'metadata')
  const mm = useApi(() => api.modelMetrics(), 'model-metrics')
  if (meta.loading || mm.loading) return <Loading />
  if (meta.error || mm.error) return <ErrorState error={meta.error || mm.error} onRetry={() => { meta.reload(); mm.reload() }} />
  const ds = meta.data.dataset
  const d = mm.data
  const ins = d.insights
  const row = (k) => d.metrics.find((m) => m.key === k)
  const rainEffect = ins.gam.effects.find((e) => e.feature === 'Annual_Rainfall')
  const dcEffect = ins.gam.effects.find((e) => e.feature === 'district_crop_te')

  return (
    <>
      <PageHeader eyebrow="How it works" title="The complete machine-learning pipeline">
        How raw government statistics become a yield prediction, and where each Unit 5 technique fits in.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-20 px-5 py-12 lg:px-8">
        <Section eyebrow="Pipeline" title="Seven stages, from data to combined prediction">
          <div className="grid gap-3 md:grid-cols-7">
            {STEPS.map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="relative flex flex-col">
                <div className="card flex-1 p-4">
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-sprout-100 text-forest-700"><s.icon size={16} /></span>
                    <span className="num text-xs text-ink-3">0{i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-sans text-sm font-semibold text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{s.d}</p>
                </div>
                {i < STEPS.length - 1 && <ArrowDown size={14} className="mx-auto my-1 text-forest-600 md:hidden" />}
              </motion.div>
            ))}
          </div>
        </Section>

        <Section id="data" eyebrow="Data" title="Data collection and cleaning" desc={`From ${fmtInt(ds.raw_rows)} raw district rows down to ${fmtInt(ds.rows)} clean records covering ${ds.crops} crops, ${ds.districts} districts and ${ds.states} states/UTs, ${ds.years[0]}–${ds.years[1]}.`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Cleaning log" subtitle="Rows removed at each step (written by the preprocessing script)">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-ink-3"><th className="py-2 font-medium">Step</th><th className="py-2 text-right font-medium">Removed</th><th className="py-2 text-right font-medium">Remaining</th></tr></thead>
                <tbody>
                  {ds.cleaning_steps.map((s) => (
                    <tr key={s.step} className="border-b border-line/60 align-top">
                      <td className="py-2 pr-3"><div className="font-medium text-ink">{s.step.replace(/_/g, ' ')}</div><div className="text-xs leading-relaxed text-ink-3">{s.note}</div></td>
                      <td className="num whitespace-nowrap py-2 pl-4 text-right">−{fmtInt(s.removed)}</td>
                      <td className="num whitespace-nowrap py-2 pl-4 text-right">{fmtInt(s.rows_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartCard>
            <div className="space-y-6">
              <ChartCard title="Feature selection and leakage prevention" subtitle="Columns deliberately not used">
                <ul className="space-y-3 text-sm">
                  {Object.entries(ds.feature_selection.dropped).map(([k, v]) => (
                    <li key={k}><span className="font-medium text-ink">{k}</span><span className="block text-xs leading-relaxed text-ink-3">{v}</span></li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-3">Correlation between Kaggle Fertilizer and Area: <span className="num text-ink">{fmt(ds.feature_selection.corr_fertilizer_area, 4)}</span></p>
              </ChartCard>
              <ChartCard title="Unit conversions">
                <ul className="space-y-1 text-sm text-ink-2">
                  {Object.entries(ds.unit_conversions).map(([k, v]) => <li key={k}><span className="font-medium">{k}</span>: {v}</li>)}
                </ul>
              </ChartCard>
            </div>
          </div>
        </Section>

        <Section eyebrow="Feature engineering" title="Turning categories into numbers without leakage"
          desc={`There are ${ds.districts} districts × ${ds.crops} crops, which is too many categories for one-hot encoding in GAM and spline models. Instead, each category is replaced by a smoothed average of log-yield, and rare combinations are pulled toward their parent level.`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6 text-sm leading-relaxed text-ink-2">
              <Formula>enc(key) = (n · mean_key + m · enc(parent)) / (n + m),  m = 10</Formula>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {['Global mean', 'Crop', 'State × Crop', 'District × Crop'].map((s, i) => (
                  <span key={s} className="flex items-center gap-2"><span className="rounded border border-line bg-paper px-2 py-1">{s}</span>{i < 3 && <ArrowRight size={12} className="text-ink-3" />}</span>
                ))}
              </div>
              <p className="mt-4">During training, each row's encoding is computed with <strong>5-fold cross-fitting</strong>, so a row never sees its own yield. At prediction time, lookup tables fitted on the full training set are used, and an unseen district-crop pair falls back to its state-crop value.</p>
            </div>
            <div className="card p-6">
              <div className="text-sm font-semibold text-ink">Final model features ({d.features.length})</div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {d.features.map((f) => <li key={f} className="rounded-md bg-paper px-3 py-2"><div className="text-ink">{d.feature_labels[f]}</div><div className="num text-[11px] text-ink-3">{f}</div></li>)}
              </ul>
            </div>
          </div>
        </Section>

        <Section id="unit5" eyebrow="Syllabus mapping" title="Unit 5 – Combining Models: Practical Implementation"
          desc="Each topic is linked to the code that implements it and to output from the trained models.">
          <div className="space-y-6">
            <Unit id="u-bma" icon={Scale} color={MODEL_COLORS.bma} title="Bayesian Model Averaging" link="/models#bma"
              def="Combining predictions using the estimated posterior probability of each model given the data, instead of committing to one 'best' model."
              formula="p(y|x,D) = Σ_k p(y|x,M_k) P(M_k|D),  P(M_k|D) ∝ p(D|M_k) P(M_k)"
              impl={<>backend/models/bayesian_averaging.py: Gaussian validation log-likelihood per model, a uniform prior, then a softmax to get posterior weights. ŷ = Σ w_k ŷ_k. This is an approximation; no parameter posterior is integrated.</>}
              output={<div className="space-y-1.5 text-sm">{Object.entries(ins.bma.weights).map(([k, w]) => (
                <div key={k} className="flex items-center gap-3"><span className="w-28 text-xs text-ink-2">{d.model_names[k]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-paper-2"><span className="block h-full" style={{ width: `${w * 100}%`, background: MODEL_COLORS[k] }} /></span>
                  <span className="num w-14 text-right text-xs">{fmt(w, 3)}</span></div>))}
                <p className="pt-2 text-xs text-ink-3">Posterior weights on {fmtInt(ins.bma.n_validation)} validation rows. BMA test R² = {fmt(row('bma').r2, 4)}.</p></div>} />

            <Unit id="u-boost" icon={TrendingUp} color={MODEL_COLORS.boosting} title="Boosting" link="/models#boosting"
              def="Building a strong learner by adding weak learners one after another, each focusing on what the current ensemble still gets wrong."
              formula="F_m(x) = F_(m−1)(x) + ν·h_m(x),  h_m ≈ −∂L/∂F = residuals"
              impl={<>backend/models/boosting_model.py: GradientBoostingRegressor ({ins.boosting.params.n_estimators} trees, depth {ins.boosting.params.max_depth}, ν = {ins.boosting.params.learning_rate}, subsample {ins.boosting.params.subsample}).</>}
              output={<><ResponsiveContainer width="100%" height={170}><LineChart data={ins.boosting.staged}><CartesianGrid vertical={false} /><XAxis dataKey="stage" tick={{ fontSize: 10 }} /><YAxis scale="log" domain={['auto', 'auto']} width={44} tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 3)} /><Line dataKey="val_mse_log" stroke={MODEL_COLORS.boosting} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
                <p className="text-xs text-ink-3">Validation MSE falls from {fmt(ins.boosting.staged[0].val_mse_log, 3)} after 1 tree to {fmt(ins.boosting.staged.at(-1).val_mse_log, 4)} after {ins.boosting.staged.at(-1).stage}.</p></>} />

            <Unit id="u-abm" icon={Spline} color={MODEL_COLORS.basis} title="Adaptive Basis Function Models" link="/models#basis"
              def="Models of the form f(x) = w₀ + Σ w_m φ_m(x), where nonlinear basis functions φ_m let a linear-in-weights model capture curved relationships."
              formula="φ_m = cubic B-splines with knots at data quantiles;  min ‖y − Φw‖² + α‖w‖²"
              impl={<>backend/models/basis_function_model.py: SplineTransformer ({ins.basis.n_basis_functions} basis functions) + RidgeCV (α = {fmt(ins.basis.params.ridge_alpha, 3)}). CART and boosting are also adaptive basis-function models in the textbook sense: their basis functions are tree leaves learned from the data.</>}
              output={<><ResponsiveContainer width="100%" height={170}><LineChart data={ins.basis.crop_rainfall_curves.Rice}><CartesianGrid vertical={false} /><XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10 }} tickFormatter={(v) => fmtInt(v)} /><YAxis width={40} domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 2)} /><Line dataKey="basis" stroke={MODEL_COLORS.basis} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
                <p className="text-xs text-ink-3">Spline model: average predicted Rice yield (t/ha) vs annual rainfall (mm).</p></>} />

            <Unit id="u-cart" icon={GitBranch} color={MODEL_COLORS.cart} title="CART" link="/models#cart"
              def="Classification and Regression Trees: binary recursive partitioning of the feature space, with a constant prediction in each region."
              formula="min over (j, s) of Σ_(x_i ∈ R_L) (y_i − ȳ_L)² + Σ_(x_i ∈ R_R) (y_i − ȳ_R)²"
              impl={<>backend/models/cart_model.py: DecisionTreeRegressor, with depth and leaf size tuned on validation (depth {ins.cart.params.max_depth}, {fmtInt(ins.cart.leaves)} leaves). Test R² {fmt(row('cart').r2, 4)}.</>}
              output={<div><TreeView tree={{ ...ins.cart.tree, left: { ...ins.cart.tree.left, left: undefined, right: undefined, feature: undefined, truncated: true }, right: { ...ins.cart.tree.right, left: undefined, right: undefined, feature: undefined, truncated: true } }} /></div>} />

            <Unit id="u-gam" icon={Sigma} color={MODEL_COLORS.gam} title="Generalized Additive Models" link="/models#gam"
              def="A model in which the response is a sum of smooth, nonlinear functions of individual variables, so each variable's effect can be read off on its own."
              formula="g(E[y]) = β₀ + Σ_j f_j(x_j),  penalty Σ λ_j ∫ f_j''(x)² dx"
              impl={<>backend/models/gam_model.py: pyGAM LinearGAM, one spline term per feature, λ by GCV. Effective degrees of freedom {fmt(ins.gam.summary.edof, 1)}.</>}
              output={<div className="grid grid-cols-2 gap-3"><div><div className="text-[11px] text-ink-2">f(District × Crop)</div><EffectChart effect={dcEffect} height={150} /></div><div><div className="text-[11px] text-ink-2">f(Annual rainfall)</div><EffectChart effect={rainEffect} height={150} /></div></div>} />

            <Unit id="u-ens" icon={Trees} color={MODEL_COLORS.random_forest} title="Ensemble Learning" link="/models#ensemble"
              def="Combining several models so that their individual errors partly cancel out, giving more stable and often more accurate predictions."
              formula="Bagging: f̂ = (1/B) Σ T_b ;  Voting: (1/K) Σ ŷ_k ;  Weighted: Σ w_k ŷ_k"
              impl={<>backend/models/ensemble_model.py: RandomForestRegressor ({ins.random_forest.params.n_estimators} trees), an equal-weight voting ensemble and an inverse-MSE weighted ensemble of all 5 base models.</>}
              output={<><MetricBars metrics={d.metrics} metric="r2" height={190} /><p className="text-xs text-ink-3">Test R² for all 8 models. The ensembles beat the weaker models but don't beat the best single one.</p></>} />
          </div>
        </Section>
      </div>
    </>
  )
}
