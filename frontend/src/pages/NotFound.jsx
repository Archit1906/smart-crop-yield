import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-32 text-center">
      <h1 className="text-4xl font-semibold text-forest-950">Page not found</h1>
      <p className="mt-3 text-ink-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block rounded-md bg-forest-800 px-4 py-2 text-sm text-white">Back to home</Link>
    </div>
  )
}
