import { motion } from 'framer-motion'
import { Info, LoaderCircle, TriangleAlert, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function PageHeader({ eyebrow, title, children, right }) {
  return (
    <div className="border-b border-line bg-gradient-to-b from-sprout-50 to-paper">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 pb-10 pt-12 md:flex-row md:items-end md:justify-between lg:px-8">
        <div className="max-w-3xl">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="mt-2 text-3xl font-semibold text-forest-950 md:text-[42px] md:leading-[1.1]">{title}</h1>
          {children && <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{children}</p>}
        </div>
        {right}
      </div>
    </div>
  )
}

export function Section({ id, eyebrow, title, desc, children, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      {(eyebrow || title) && (
        <div className="mb-6 max-w-3xl">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {title && <h2 className="mt-1.5 text-2xl font-semibold text-forest-950 md:text-[28px]">{title}</h2>}
          {desc && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{desc}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

export function ChartCard({ title, subtitle, children, right, className = '', footer }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }} className={`card p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-sans text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
      {footer && <div className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-3">{footer}</div>}
    </motion.div>
  )
}

export function Stat({ label, value, sub, icon: Icon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-ink-3">
        <span>{label}</span>
        {Icon && <Icon size={15} className="text-forest-600" />}
      </div>
      <div className="num mt-2 text-2xl font-medium text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading data from the backend…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-16 text-sm text-ink-3 ${className}`}>
      <LoaderCircle size={18} className="animate-spin text-forest-600" /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card mx-auto my-10 flex max-w-xl flex-col items-center gap-3 p-8 text-center">
      <TriangleAlert className="text-red-600" />
      <p className="text-sm text-ink">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-paper-2">
          <RotateCcw size={14} /> Retry
        </button>
      )}
    </div>
  )
}

export function Tip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label="More information" className="text-ink-3 hover:text-forest-700"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        onClick={() => setShow((s) => !s)}>
        <Info size={14} />
      </button>
      {show && (
        <span role="tooltip" className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

export function Badge({ children, tone = 'green' }) {
  const t = { green: 'bg-sprout-100 text-forest-800', gray: 'bg-paper-2 text-ink-2', amber: 'bg-amber-50 text-amber-800' }[tone]
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>
}

export function Formula({ children }) {
  return <div className="num overflow-x-auto rounded-md border border-line bg-paper px-4 py-3 text-[13px] text-forest-900">{children}</div>
}

export function Swatch({ color }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-paper p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 font-medium transition ${value === o.value ? 'bg-white text-forest-800 shadow-sm' : 'text-ink-3 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
