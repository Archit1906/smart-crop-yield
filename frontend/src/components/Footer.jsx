import { Link } from 'react-router-dom'
import { Sprout } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-24 bg-forest-950 text-sprout-100/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sprout-200 text-forest-900"><Sprout size={18} /></span>
            <span className="font-display text-lg font-semibold">CropCast</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed">
            Smart Crop Yield Prediction System, an academic machine-learning project for Unit 5 (Combining Models).
            It is trained on district-level crop statistics published by India's Ministry of Agriculture, with state rainfall records from IMD.
          </p>
          <p className="mt-4 max-w-md text-xs text-sprout-100/50">
            Predictions are statistical estimates based on historical data, not guaranteed agricultural outcomes.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-sprout-300">Product</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/predict">Yield prediction</Link></li>
            <li><Link className="hover:text-white" to="/analytics">Analytics dashboard</Link></li>
            <li><Link className="hover:text-white" to="/models">Model comparison</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-sprout-300">Learn</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/how-it-works">ML pipeline</Link></li>
            <li><Link className="hover:text-white" to="/how-it-works#unit5">Unit 5 – Combining Models</Link></li>
            <li><Link className="hover:text-white" to="/how-it-works#data">Data sources</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-5 text-xs text-sprout-100/50 lg:px-8">
          Data: Directorate of Economics & Statistics (data.gov.in), 1997–2015 · Rainfall: IMD, via Kaggle "Crop Yield in Indian States".
        </div>
      </div>
    </footer>
  )
}
