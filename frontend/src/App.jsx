import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
const Predict = lazy(() => import('./pages/Predict'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Models = lazy(() => import('./pages/Models'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
import NotFound from './pages/NotFound'
import { Loading } from './components/ui'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<Loading label="Loading page…" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/models" element={<Models />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
