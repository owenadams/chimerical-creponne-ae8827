import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getOwnerAccess } from '@/server/owner-auth.functions'
import { useBooksStore } from '@/lib/books/store/booksStore'
import { useSettingsStore } from '@/lib/books/store/settingsStore'

export const Route = createFileRoute('/books')({
  beforeLoad: async () => {
    const auth = await getOwnerAccess()
    if (!auth.authenticated) {
      throw redirect({ to: '/owner-login' })
    }
  },
  component: BooksLayout,
})

const NAV_LINKS = [
  { to: '/books', label: 'Search' },
  { to: '/books/tier-board', label: 'Tier Board' },
  { to: '/books/library', label: 'Library' },
  { to: '/books/recommendations', label: 'Recommendations' },
  { to: '/books/settings', label: 'Settings' },
]

function BooksLayout() {
  const location = useLocation()

  useEffect(() => {
    // Both IndexedDB and localStorage only exist client-side; this app is server-rendered,
    // so books/settings are loaded here once the layout mounts in the browser.
    useBooksStore.getState().loadBooks()
    useSettingsStore.persist.rehydrate()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-slate-100">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-3">
          <Link to="/" className="mr-3 text-white/50 hover:text-white/80" aria-label="Back to home">
            ←
          </Link>
          <span className="mr-4 text-lg font-semibold tracking-tight">📚 Book Recommendations</span>
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white/90'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
