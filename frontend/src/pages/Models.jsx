import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend } from 'recharts'
import { GitBranch, TrendingUp, Spline, Sigma, Trees, Scale, Award } from 'lucide-react'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { PageHeader, ChartCard, Loading, ErrorState, Formula, Badge, Swatch, Segmented } from '../components/ui'
import ChartTooltip from '../charts/ChartTooltip'
import { ActualVsPredicted, ResidualHist, FeatureImportance, TreeView, EffectChart, MetricBars, MultiLine, ModelPicker } from '../charts/ModelCharts'
import { MODEL_COLORS, MODEL_SHORT, MODEL_ORDER, BASE_MODELS, fmt, fmtInt } from '../services/theme'

const NAV = [
  { id: 'overview', label: 'Overview' }, { id: 'cart', label: 'CART' }, { id: 'boosting', label: 'Boosting' },
  { id: 'basis', label: 'Basis functions' }, { id: 'gam', label: 'GAM' }, { id: 'ensemble', label: 'Ensembles' }, { id: 'bma', label: 'BMA' },
]

function MetricStrip({ row }) {
  if (!row) return null
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
      {[['R²', row.r2, 4], ['MAE', row.mae, 3], ['MSE', row.mse, 3], ['RMSE', row.rmse, 3], ['R² (log)', row.r2_log, 4]].map(([l, v, d]) => (
        <div key={l} className="bg-white px-3 py-2.5">
          <div className="text-[11px] text-ink-3">{l}{l !== 'R²' && l !== 'R² (log)' ? ' (t/ha)' : ''}</div>
          <div className="num text-[15px] text-ink">{fmt(v, d)}</div>
        </div>
      ))}
    </div>
  )
}

function AlgoSection({ id, icon: Icon, color, title, what, how, children, row }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-line pt-12">
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md text-white" style={{ background: color }}><Icon size={19} /></span>
            <h2 className="text-2xl font-semibold text-forest-950">{title}</h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">{what}</p>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-forest-700">In this project</div>
          <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-ink-2">{how}</div>
        </div>
        <div className="space-y-5 min-w-0">
          <MetricStrip row={row} />
          {children}
        </div>
      </div>
    </section>
  )
}

export default function Models() {
  const q = useApi(() => api.modelMetrics(), 'model-metrics')
  const [metric, setMetric] = useState('r2')
  const [avpModel, setAvpModel] = useState('random_forest')
  const [resModel, setResModel] = useState('random_forest')
  const [fiModel, setFiModel] = useState('random_forest')
  const [curveCrop, setCurveCrop] = useState('Rice')
  const [pdFeat, setPdFeat] = useState('Annual_Rainfall')

  if (q.loading) return <Loading label="Loading model evaluation results…" />
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />
  const d = q.data
  const ins = d.insights
  const row = (k) => d.metrics.find((m) => m.key === k)
  const best = d.best_model
  const labels = d.feature_labels
  const pd = ins.partial_dependence
  const pdFmt = { Annual_Rainfall: (v) => `${fmtInt(v)} mm`, Crop_Year: (v) => String(Math.round(v)), Area: (v) => `${fmtInt(v)} ha` }
  const crops = Object.keys(ins.basis.crop_rainfall_curves)
  const bmaD = ins.bma.details
  const baseBest = d.best_base_model

  return (
    <>
      <PageHeader eyebrow="Model comparison · Unit 5" title="Five learners and three ways to combine them">
        Every model is trained on the same {fmtInt(d.split.train)} training rows. Combination weights come from {fmtInt(d.split.validation)} validation rows,
        and all scores below come from the same held-out test set of {fmtInt(d.split.test)} rows. Nothing on this page is typed in by hand: it is all read from the training run ({d.trained_at}).
      </PageHeader>

      <div className="sticky top-16 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 lg:px-8">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="whitespace-nowrap rounded px-3 py-1.5 text-sm text-ink-2 hover:bg-white hover:text-forest-800">{n.label}</a>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-14 px-5 py-10 lg:px-8">
        {/* ---------------- Overview ---------------- */}
        <section id="overview" className="scroll-mt-32 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <ChartCard title="Model comparison table" subtitle="Test set · yield in t/ha · the best value in each column is highlighted">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="py-2 font-medium">Algorithm</th>
                    {['R²', 'MAE', 'MSE', 'RMSE', 'R² (log)', 'Train (s)'].map((h) => <th key={h} className="py-2 text-right font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {MODEL_ORDER.map((k) => {
                      const r = row(k)
                      const bestOf = (c, hi) => (hi ? Math.max : Math.min)(...d.metrics.map((m) => m[c])) === r[c]
                      const cell = (c, dgt, hi) => <td className={`num py-2 text-right ${bestOf(c, hi) ? 'font-semibold text-forest-700' : ''}`}>{fmt(r[c], dgt)}</td>
                      return (
                        <tr key={k} className={`border-b border-line/70 ${r.family === 'combined' ? 'bg-paper/60' : ''}`}>
                          <td className="py-2"><span className="flex items-center gap-2"><Swatch color={MODEL_COLORS[k]} />{r.name}{k === best.key && <Award size={13} className="text-wheat" />}</span></td>
                          {cell('r2', 4, true)}{cell('mae', 3)}{cell('mse', 2)}{cell('rmse', 3)}{cell('r2_log', 4, true)}
                          <td className="num py-2 text-right text-ink-3">{r.family === 'base' ? fmt(r.train_time_s, 1) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                Best by test R²: <strong className="text-ink">{best.name}</strong>. BMA ties with it because its posterior weight on Random Forest is ≈ 1.
                The ensembles beat the weaker single models but <strong>not</strong> the best single model, so combining models doesn't always improve accuracy.
              </p>
            </ChartCard>
            <ChartCard title="Interactive performance comparison" subtitle="Choose a metric. Lower is better for MAE, MSE and RMSE."
              right={<Segmented value={metric} onChange={setMetric} options={[{ value: 'r2', label: 'R²' }, { value: 'mae', label: 'MAE' }, { value: 'rmse', label: 'RMSE' }, { value: 'mse', label: 'MSE' }, { value: 'r2_log', label: 'R² log' }]} />}>
              <MetricBars metrics={d.metrics} metric={metric} />
              {metric.startsWith('r2') && <p className="text-xs text-ink-3">Note: the y-axis is zoomed in to show the differences. All models score above {fmt(Math.min(...d.metrics.map((m) => m[metric])), 2)}.</p>}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard title="Actual vs predicted" subtitle="600 test points, log–log scale" right={<ModelPicker value={avpModel} onChange={setAvpModel} />}>
              <ActualVsPredicted data={ins.actual_vs_predicted} model={avpModel} />
            </ChartCard>
            <ChartCard title="Residual distribution" subtitle="Predicted − actual (t/ha), all test rows" right={<ModelPicker value={resModel} onChange={setResModel} />}>
              <ResidualHist residuals={ins.residuals} model={resModel} />
            </ChartCard>
            <ChartCard title="Feature importance" subtitle="Which engineered features each model relies on" right={<ModelPicker value={fiModel} onChange={setFiModel} keys={BASE_MODELS} />}>
              <FeatureImportance importance={ins.feature_importance} labels={labels} model={fiModel} height={250} />
            </ChartCard>
          </div>

          <ChartCard title={`Within-crop accuracy of the best base model (${MODEL_SHORT[ins.per_crop_best_model.model]})`}
            subtitle="The overall R² is high partly because yields differ hugely between crops. These are the honest per-crop numbers."
            footer="Median APE = median absolute percentage error. Within one crop, R² measures how well the model separates good districts and years from poor ones.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-ink-3">
                  {['Crop', 'Test rows', 'Mean yield (t/ha)', 'MAE (t/ha)', 'Median APE', 'Within-crop R²'].map((h, i) => <th key={h} className={`py-2 font-medium ${i ? 'text-right' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {ins.per_crop_best_model.rows.map((r) => (
                    <tr key={r.crop} className="border-b border-line/60">
                      <td className="py-1.5">{r.crop}</td>
                      <td className="num py-1.5 text-right text-ink-3">{fmtInt(r.n)}</td>
                      <td className="num py-1.5 text-right">{fmt(r.mean_yield, 2)}</td>
                      <td className="num py-1.5 text-right">{fmt(r.mae, 3)}</td>
                      <td className="num py-1.5 text-right">{fmt(r.median_ape, 1)}%</td>
                      <td className="py-1.5 text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-2"><span className="block h-full bg-forest-600" style={{ width: `${Math.max(0, r.r2) * 100}%` }} /></span>
                          <span className="num w-12 text-right">{fmt(r.r2, 3)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </section>

        {/* ---------------- CART ---------------- */}
        <AlgoSection id="cart" icon={GitBranch} color={MODEL_COLORS.cart} title="CART" row={row('cart')}
          what="Classification and Regression Trees split the data again and again on one feature at a time. Each split is the one that most reduces squared error, and each leaf predicts the average yield of its training rows."
          how={<>
            <p><code className="num text-xs">DecisionTreeRegressor</code> tuned on the validation set over max_depth ∈ {'{6…18}'} and min_samples_leaf ∈ {'{5, 20, 50}'}.
              Chosen: depth <span className="num">{ins.cart.params.max_depth}</span>, leaf <span className="num">{ins.cart.params.min_samples_leaf}</span> → <span className="num">{fmtInt(ins.cart.leaves)}</span> leaves.</p>
            <p>The root split is on the district × crop historical yield, which shows the tree has learned that local track record matters most.</p>
          </>}>
          <Formula>Split chosen to maximise Δ = SSE(parent) − [SSE(left) + SSE(right)] ; leaf prediction ŷ = mean(y in leaf)</Formula>
          <ChartCard title="Decision tree (top 3 levels of the fitted model)" subtitle="Thresholds on encoded features are converted back to t/ha or hectares in brackets. 'Subtree' nodes continue deeper.">
            <TreeView tree={ins.cart.tree} />
          </ChartCard>
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Feature importance (CART)"><FeatureImportance importance={ins.feature_importance} labels={labels} model="cart" height={240} /></ChartCard>
            <ChartCard title="Depth tuning" subtitle="Validation MSE (log scale) for the best leaf size at each depth">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={Object.values(ins.cart.grid.reduce((acc, g) => { if (!acc[g.max_depth] || acc[g.max_depth].v > g.val_mse_log) acc[g.max_depth] = { x: g.max_depth, v: g.val_mse_log }; return acc }, {}))}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="x" label={{ value: 'max_depth', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#7a7d72' }} height={36} />
                  <YAxis width={56} tickFormatter={(v) => fmt(v, 4)} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip labelFormatter={(v) => `depth ${v}`} valueFormatter={(v) => fmt(v, 5)} />} />
                  <Line dataKey="v" name="Validation MSE" stroke={MODEL_COLORS.cart} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </AlgoSection>

        {/* ---------------- Boosting ---------------- */}
        <AlgoSection id="boosting" icon={TrendingUp} color={MODEL_COLORS.boosting} title="Gradient Boosting" row={row('boosting')}
          what="Boosting builds an additive model one stage at a time. Each new shallow tree is fitted to the errors (the negative gradient of the loss) of all the trees before it. Its contribution is shrunk by the learning rate."
          how={<>
            <div className="grid grid-cols-2 gap-2">
              {[['Estimators', ins.boosting.params.n_estimators], ['Learning rate', ins.boosting.params.learning_rate], ['Max depth', ins.boosting.params.max_depth], ['Subsample', ins.boosting.params.subsample]].map(([l, v]) => (
                <div key={l} className="rounded-md border border-line bg-white px-3 py-2"><div className="text-[11px] text-ink-3">{l}</div><div className="num">{v}</div></div>
              ))}
            </div>
            <p>Compared with CART: test RMSE {fmt(row('cart').rmse, 3)} → {fmt(row('boosting').rmse, 3)} t/ha ({fmt((1 - row('boosting').rmse / row('cart').rmse) * 100, 1)}% lower).</p>
          </>}>
          <Formula>F₀(x) = ȳ ;  F_m(x) = F_(m−1)(x) + ν · h_m(x),  h_m fitted to r_i = y_i − F_(m−1)(x_i),  ν = {ins.boosting.params.learning_rate}</Formula>
          <ChartCard title="Sequential improvement" subtitle="Mean squared error (log scale) after each boosting stage. Training error is measured on a 20k-row subset."
            footer={`After ${ins.boosting.staged.at(-1).stage} trees: training MSE ${fmt(ins.boosting.staged.at(-1).train_mse_log, 4)}, validation MSE ${fmt(ins.boosting.staged.at(-1).val_mse_log, 4)}. Most of the improvement comes from the first ~50 trees; after that, extra trees give small but steady gains.`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ins.boosting.staged} margin={{ right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="stage" type="number" domain={[1, 'dataMax']} label={{ value: 'Number of trees', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#7a7d72' }} height={36} />
                <YAxis width={52} scale="log" domain={['auto', 'auto']} tickFormatter={(v) => fmt(v, 3)} />
                <Tooltip content={<ChartTooltip labelFormatter={(v) => `after ${v} trees`} valueFormatter={(v) => fmt(v, 5)} names={{ val_mse_log: 'Validation MSE', train_mse_log: 'Training MSE' }} />} />
                <Legend formatter={(v) => (v === 'val_mse_log' ? 'Validation' : 'Training')} iconType="plainline" />
                <Line dataKey="val_mse_log" stroke={MODEL_COLORS.boosting} strokeWidth={2} dot={false} />
                <Line dataKey="train_mse_log" stroke="#7a7d72" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </AlgoSection>

        {/* ---------------- Basis functions ---------------- */}
        <AlgoSection id="basis" icon={Spline} color={MODEL_COLORS.basis} title="Adaptive Basis Function Model" row={row('basis')}
          what="The model writes yield as a weighted sum of basis functions: f(x) = w₀ + Σ w_m φ_m(x). Each numeric feature is expanded into cubic B-splines, so a linear model can still capture curved effects."
          how={<>
            <p><code className="num text-xs">StandardScaler → SplineTransformer(n_knots={ins.basis.params.n_knots}, degree={ins.basis.params.degree}, knots='quantile') → RidgeCV</code>.
              That gives {ins.basis.n_basis_functions} basis functions, with ridge α = {fmt(ins.basis.params.ridge_alpha, 3)} chosen by cross-validation.</p>
            <p>Knots sit at data quantiles, so the basis adapts to where data is dense.</p>
            <p className="rounded-md border border-line bg-white p-3 text-xs"><strong>How it differs from the GAM:</strong> this model uses a fixed spline basis and <em>one</em> global L2 penalty, solved in closed form. The GAM adds a smoothness (curvature) penalty to <em>each</em> term, picks a separate λ per term by GCV, and gives confidence intervals.</p>
          </>}>
          <Formula>f(x) = w₀ + Σ_j Σ_m w_jm · B_m(x_j) ;  minimise ‖y − Φw‖² + α‖w‖²</Formula>
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Yield response curves by crop" subtitle="Average predicted yield vs rainfall (basis model and GAM)"
              right={<select className="field-input !w-auto !py-1.5 text-xs" value={curveCrop} onChange={(e) => setCurveCrop(e.target.value)}>{crops.map((c) => <option key={c}>{c}</option>)}</select>}>
              <MultiLine data={ins.basis.crop_rainfall_curves[curveCrop]} keys={['basis', 'gam']} xFmt={(v) => `${fmtInt(v)}`} yFmt={(v) => fmt(v, 2)} xLabel="Annual rainfall (mm)" />
            </ChartCard>
            <ChartCard title="Partial dependence on raw inputs" subtitle="Average predicted yield (t/ha) over 1,500 test rows as one input varies"
              right={<Segmented value={pdFeat} onChange={setPdFeat} options={[{ value: 'Annual_Rainfall', label: 'Rainfall' }, { value: 'Crop_Year', label: 'Year' }, { value: 'Area', label: 'Area' }]} />}
              footer="Temperature vs yield can't be plotted because the source data has no temperature measurements.">
              <MultiLine data={pd[pdFeat]} keys={BASE_MODELS} xFmt={pdFmt[pdFeat]} yFmt={(v) => fmt(v, 2)} />
            </ChartCard>
          </div>
        </AlgoSection>

        {/* ---------------- GAM ---------------- */}
        <AlgoSection id="gam" icon={Sigma} color={MODEL_COLORS.gam} title="Generalized Additive Model" row={row('gam')}
          what="A GAM models the (log) yield as a sum of smooth functions, one per variable. Because the effects add up, you can plot each variable's contribution separately: this is what makes GAMs interpretable."
          how={<>
            <p><code className="num text-xs">pyGAM LinearGAM</code> with {d.features.length} spline terms ({ins.gam.n_splines_per_term} basis functions each). λ was chosen by a GCV grid search.</p>
            <div className="grid grid-cols-2 gap-2">
              {[['Effective DoF', fmt(ins.gam.summary.edof, 1)], ['GCV', fmt(ins.gam.summary.GCV, 4)], ['AIC', fmtInt(ins.gam.summary.AIC)], ['Pseudo-R²', fmt(ins.gam.summary.pseudo_r2_explained_deviance, 4)]].map(([l, v]) => (
                <div key={l} className="rounded-md border border-line bg-white px-3 py-2"><div className="text-[11px] text-ink-3">{l}</div><div className="num">{v}</div></div>
              ))}
            </div>
            <p>The GAM and the basis model score almost the same here. Both are additive, and the dominant signal (district × crop history) is close to linear on the log scale.</p>
          </>}>
          <Formula>log(1 + yield) = β₀ + f₁(x₁) + … + f_p(x_p) + ε ;  minimise ‖y − Xβ‖² + Σ_j λ_j βᵀ D_jᵀ D_j β</Formula>
          <ChartCard title="Feature-wise effect plots (partial dependence) with 95% confidence intervals"
            subtitle="y-axis: contribution to log(1 + yield). x-axis: feature value (area in hectares, encoded features on the log-yield scale)">
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {ins.gam.effects.map((e) => (
                <div key={e.feature}>
                  <div className="mb-1 text-xs font-medium text-ink-2">f({e.label})</div>
                  <EffectChart effect={e} />
                </div>
              ))}
            </div>
          </ChartCard>
          <ChartCard title="Predicted vs actual (GAM)" subtitle="600 test points, log–log scale">
            <ActualVsPredicted data={ins.actual_vs_predicted} model="gam" height={280} />
          </ChartCard>
        </AlgoSection>

        {/* ---------------- Ensembles ---------------- */}
        <AlgoSection id="ensemble" icon={Trees} color={MODEL_COLORS.random_forest} title="Ensemble Learning" row={row('random_forest')}
          what="Ensembles combine several models. A Random Forest averages many trees, each grown on a bootstrap sample with random feature subsets. Voting and weighted ensembles combine different kinds of model."
          how={<>
            <p><strong>1. Random Forest:</strong> {ins.random_forest.params.n_estimators} trees, max_features {ins.random_forest.params.max_features}, min_samples_leaf {ins.random_forest.params.min_samples_leaf}, bootstrap fraction {ins.random_forest.params.max_samples}.</p>
            <p><strong>2. Voting:</strong> an equal-weight average of the 5 base models' predictions.</p>
            <p><strong>3. Weighted:</strong> w_k ∝ 1 / validation MSE_k.</p>
          </>}>
          <Formula>RF: f̂(x) = (1/B) Σ_b T_b(x) ;  Voting: ŷ = (1/K) Σ_k ŷ_k ;  Weighted: ŷ = Σ_k w_k ŷ_k,  w_k = (1/MSE_k) / Σ_j (1/MSE_j)</Formula>
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard title="Individual vs combined (test RMSE, t/ha)" subtitle="Lower is better"
              footer={(() => {
                const ens = Math.max(row('voting').rmse, row('weighted').rmse)
                const beaten = BASE_MODELS.filter((k) => row(k).rmse > ens).map((k) => MODEL_SHORT[k])
                const notBeaten = BASE_MODELS.filter((k) => row(k).rmse <= Math.min(row('voting').rmse, row('weighted').rmse)).map((k) => MODEL_SHORT[k])
                return `Voting (${fmt(row('voting').rmse, 3)}) and Weighted (${fmt(row('weighted').rmse, 3)}) beat ${beaten.join(', ') || 'none of the base models'}${notBeaten.length ? `, but not ${notBeaten.join(' or ')}` : ''}. Averaging in the weaker models pulls the combined error above that of the strongest learners.`
              })()}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={MODEL_ORDER.filter((k) => k !== 'bma').map((k) => ({ key: k, v: row(k).rmse }))} margin={{ right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="key" tickFormatter={(k) => MODEL_SHORT[k]} tick={{ fontSize: 10.5 }} interval={0} tickLine={false} angle={-30} textAnchor="end" height={56} />
                  <YAxis width={44} domain={[Math.floor(Math.min(...d.metrics.map((m) => m.rmse)) * 10) / 10 - 0.2, 'auto']} allowDataOverflow tickFormatter={(v) => fmt(v, 1)} />
                  <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip labelFormatter={(k) => MODEL_SHORT[k]} valueFormatter={(v) => fmt(v, 4)} />} />
                  <Bar dataKey="v" name="RMSE" radius={[4, 4, 0, 0]} barSize={30} label={{ position: 'top', formatter: (v) => fmt(v, 3), fontSize: 10, fill: '#4d5047' }}>
                    {MODEL_ORDER.filter((k) => k !== 'bma').map((k) => <Cell key={k} fill={MODEL_COLORS[k]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Combination weights" subtitle="How much each base model contributes">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={BASE_MODELS.map((k) => ({ key: k, voting: ins.ensemble.voting_weights[k], weighted: ins.ensemble.weighted_weights[k] }))} margin={{ right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="key" tickFormatter={(k) => MODEL_SHORT[k]} tick={{ fontSize: 10.5 }} interval={0} tickLine={false} angle={-30} textAnchor="end" height={56} />
                  <YAxis width={40} tickFormatter={(v) => fmt(v, 2)} />
                  <Tooltip cursor={{ fill: '#f2f7ec' }} content={<ChartTooltip labelFormatter={(k) => MODEL_SHORT[k]} valueFormatter={(v) => fmt(v, 3)} names={{ voting: 'Voting', weighted: 'Weighted' }} />} />
                  <Legend formatter={(v) => (v === 'voting' ? 'Voting (equal)' : 'Weighted (1/MSE)')} />
                  <Bar dataKey="voting" fill={MODEL_COLORS.voting} radius={[3, 3, 0, 0]} barSize={16} />
                  <Bar dataKey="weighted" fill={MODEL_COLORS.weighted} radius={[3, 3, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </AlgoSection>

        {/* ---------------- BMA ---------------- */}
        <AlgoSection id="bma" icon={Scale} color={MODEL_COLORS.bma} title="Bayesian Model Averaging" row={row('bma')}
          what="BMA treats the choice of model as uncertain. It averages the models' predictions, weighting each by its posterior probability given the data: P(M_k | D) ∝ P(D | M_k) · P(M_k)."
          how={<>
            <p><Badge tone="amber">Approximate BMA</Badge> We don't integrate over each model's parameters. Each fitted model is treated as a Gaussian predictive model on the log scale, y ~ N(f_k(x), σ_k²), with σ_k² estimated from validation residuals.
              The validation log-likelihood stands in for the marginal likelihood. The prior is uniform (1/5 each).</p>
            <p>With n = {fmtInt(ins.bma.n_validation)}, the log-likelihood gaps are in the thousands, so the posterior puts essentially all its weight on one model. This is the textbook behaviour: <em>as data grows, BMA selects rather than averages</em>.</p>
          </>}>
          <Formula>
            ℓ_k = Σ_i log N(y_i ; f_k(x_i), σ_k²) = −(n/2)[log(2πσ_k²) + 1] ;  P(M_k|D) = e^(ℓ_k) P(M_k) / Σ_j e^(ℓ_j) P(M_j) ;  ŷ = Σ_k P(M_k|D) · ŷ_k
          </Formula>
          <ChartCard title="Candidate models, likelihoods and posterior weights"
            footer={(() => {
              const ll = BASE_MODELS.map((j) => bmaD[j].log_likelihood).sort((a, b) => b - a)
              const gap = Math.round(ll[0] - ll[1])
              return `Even the runner-up is ${fmtInt(gap)} log-likelihood units behind, so the posterior odds against it are about e^${gap} to 1 and its weight underflows to 0. 'Tempered weight' uses the average log-likelihood per observation (ℓ_k / n). It is shown only to illustrate relative fit and is NOT used for the BMA prediction.`
            })()}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-ink-3">
                  {['Candidate model', 'σ² (log scale)', 'Log-likelihood ℓ_k', 'ℓ_k − ℓ_best', 'Prior', 'Posterior weight', 'Tempered weight'].map((h, i) => <th key={h} className={`py-2 font-medium ${i ? 'text-right' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {BASE_MODELS.map((k) => (
                    <tr key={k} className="border-b border-line/60">
                      <td className="py-2"><span className="flex items-center gap-2"><Swatch color={MODEL_COLORS[k]} />{MODEL_SHORT[k]}</span></td>
                      <td className="num py-2 text-right">{fmt(bmaD[k].sigma2_log, 5)}</td>
                      <td className="num py-2 text-right">{fmt(bmaD[k].log_likelihood, 1)}</td>
                      <td className="num py-2 text-right text-ink-3">{fmt(bmaD[k].log_likelihood - Math.max(...BASE_MODELS.map((j) => bmaD[j].log_likelihood)), 1)}</td>
                      <td className="num py-2 text-right">{fmt(bmaD[k].prior, 2)}</td>
                      <td className="num py-2 text-right font-semibold">{bmaD[k].posterior_weight < 1e-4 && bmaD[k].posterior_weight > 0 ? bmaD[k].posterior_weight.toExponential(2) : fmt(bmaD[k].posterior_weight, 4)}</td>
                      <td className="num py-2 text-right text-ink-3">{fmt(bmaD[k].tempered_weight, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <p className="text-sm text-ink-2">Want to see the weights applied to a real input? <Link to="/predict" className="text-forest-700 underline">Run a prediction</Link>. The results show each model's prediction, its BMA weight and the combined value.</p>
        </AlgoSection>
      </div>
    </>
  )
}
