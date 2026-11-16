import { NavLink, Link } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X, Sprout } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const LINKS = [
  { to: '/predict', label: 'Predict' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/models', label: 'Models' },
  { to: '/how-it-works', label: 'How it works' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const cls = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-forest-800' : 'text-ink-2 hover:text-forest-700'}`
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-md bg-forest-800 text-sprout-200"><Sprout size={18} /></span>
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-semibold text-forest-900">CropCast</span>
            <span className="block text-[10.5px] uppercase tracking-[0.16em] text-ink-3">Smart Yield Prediction</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={cls}>
              {({ isActive }) => (
                <span className="relative">
                  {l.label}
                  {isActive && <motion.span layoutId="nav-underline" className="absolute -bottom-[21px] left-0 right-0 h-[2px] bg-forest-700" />}
                </span>
              )}
            </NavLink>
          ))}
          <Link to="/predict" className="ml-3 rounded-md bg-forest-800 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700">
            Predict yield
          </Link>
        </nav>
        <button className="rounded-md p-2 text-ink md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-paper md:hidden">
            <div className="flex flex-col px-5 py-3">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                  className={({ isActive }) => `py-2.5 text-[15px] ${isActive ? 'font-semibold text-forest-800' : 'text-ink-2'}`}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
