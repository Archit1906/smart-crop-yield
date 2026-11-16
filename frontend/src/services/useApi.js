import { useEffect, useState, useCallback } from 'react'

const cache = new Map()

// Small data hook with an in-memory cache keyed by `key` (so pages don't refetch static data).
export function useApi(fn, key, deps = []) {
  const [state, setState] = useState(() => ({ data: cache.get(key) ?? null, error: null, loading: !cache.has(key) }))
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => { cache.delete(key); setNonce((n) => n + 1) }, [key])

  useEffect(() => {
    let alive = true
    if (cache.has(key)) { setState({ data: cache.get(key), error: null, loading: false }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then((data) => { cache.set(key, data); if (alive) setState({ data, error: null, loading: false }) })
      .catch((error) => { if (alive) setState({ data: null, error, loading: false }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, ...deps])

  return { ...state, reload }
}
