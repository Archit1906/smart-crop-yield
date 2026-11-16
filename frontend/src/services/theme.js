// Fixed categorical order (validated palette, light mode). Color follows the model, never its rank.
export const MODEL_ORDER = ['cart', 'boosting', 'basis', 'gam', 'random_forest', 'voting', 'weighted', 'bma']
export const MODEL_COLORS = {
  cart: '#2a78d6',
  boosting: '#eb6834',
  basis: '#1baf7a',
  gam: '#eda100',
  random_forest: '#e87ba4',
  voting: '#008300',
  weighted: '#6250d6',
  bma: '#e34948',
}
export const MODEL_SHORT = {
  cart: 'CART', boosting: 'Boosting', basis: 'Spline basis', gam: 'GAM', random_forest: 'Random Forest',
  voting: 'Voting', weighted: 'Weighted', bma: 'BMA',
}
export const BASE_MODELS = ['cart', 'boosting', 'basis', 'gam', 'random_forest']
export const BRAND = '#2f7040'
export const BRAND_SOFT = '#b9d99f'

export const fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }))
export const fmtInt = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'))
export const fmtCompact = (v) => {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1e7) return (v / 1e7).toFixed(1) + ' Cr'
  if (a >= 1e5) return (v / 1e5).toFixed(1) + ' L'
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return String(Math.round(v))
}
