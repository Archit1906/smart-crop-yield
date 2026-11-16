import { useEffect, useRef, useState } from 'react'
import { useInView, animate } from 'framer-motion'

// Animates from 0 to a real value fetched from the backend (never a hard-coded figure).
export default function CountUp({ value, decimals = 0, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView || value == null) return
    const c = animate(0, value, { duration: 1.4, ease: 'easeOut', onUpdate: setV })
    return () => c.stop()
  }, [inView, value])
  return <span ref={ref}>{Number(v).toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>
}
