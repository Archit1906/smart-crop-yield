// All ML computation happens in the Flask backend; this module only transports data.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options })
  } catch {
    throw new ApiError('Cannot reach the prediction server. Make sure the Flask backend is running on port 5000.', 0)
  }
  let body = null
  try { body = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.details)
  return body
}

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details }
}

const qs = (o) => {
  const p = new URLSearchParams()
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  health: () => request('/health'),
  metadata: () => request('/metadata'),
  predict: (payload) => request('/predict', { method: 'POST', body: JSON.stringify(payload) }),
  modelMetrics: () => request('/model-metrics'),
  featureImportance: () => request('/feature-importance'),
  analytics: (filters) => request('/analytics' + qs(filters)),
  historicalTrends: (params) => request('/historical-trends' + qs(params)),
}
