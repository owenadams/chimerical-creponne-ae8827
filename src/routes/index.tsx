import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getOwnerAccess } from '@/server/owner-auth.functions'

export const Route = createFileRoute('/')({
  component: Home,
})

interface Game {
  slug: string
  title: string
  emoji: string
  tagline: string
  to: string
  available: boolean
  accent: string
}

const GAMES: Game[] = [
  {
    slug: 'alphabet',
    title: 'Alphabet Game',
    emoji: '🔤',
    tagline: 'Name something in the category for each letter — run out and you\'re out.',
    to: '/alphabet',
    available: true,
    accent: 'from-purple-500 to-indigo-500',
  },
  {
    slug: 'scattergories',
    title: 'Scattergories',
    emoji: '📝',
    tagline: 'Roll a letter, then name something in each category — before the timer runs out!',
    to: '/scattergories',
    available: true,
    accent: 'from-teal-500 to-cyan-500',
  },
]

function Home() {
  const [ownerStatus, setOwnerStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking')

  useEffect(() => {
    let active = true

    getOwnerAccess()
      .then((result) => {
        if (!active) return
        setOwnerStatus(result.authenticated ? 'unlocked' : 'locked')
      })
      .catch(() => {
        if (!active) return
        setOwnerStatus('locked')
      })

    return () => {
      active = false
    }
  }, [])

  const ownerStatusClass =
    ownerStatus === 'unlocked'
      ? 'text-emerald-200 bg-emerald-500/15 border-emerald-300/40'
      : ownerStatus === 'locked'
        ? 'text-amber-200 bg-amber-500/15 border-amber-300/40'
        : 'text-slate-200 bg-slate-500/15 border-slate-300/40'

  const ownerStatusLabel =
    ownerStatus === 'unlocked' ? 'Unlocked' : ownerStatus === 'locked' ? 'Locked' : 'Checking'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center p-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight">
            Owen's Games
          </h1>
          <p className="text-purple-300 mt-3 text-base sm:text-lg">
            A small collection of party games to play with friends.
          </p>
        </div>

        {/* Game grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAMES.map((game) =>
            game.available ? (
              <Link
                key={game.slug}
                to={game.to}
                className="group bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all shadow-lg shadow-purple-950/30"
              >
                <div className="text-5xl mb-3">{game.emoji}</div>
                <h2 className="text-xl font-bold text-white mb-1.5">{game.title}</h2>
                <p className="text-white/60 text-sm mb-4">{game.tagline}</p>
                <span
                  className={`inline-block bg-gradient-to-r ${game.accent} text-white text-sm font-semibold px-4 py-2 rounded-lg group-hover:brightness-110 transition-all`}
                >
                  Play →
                </span>
              </Link>
            ) : (
              <div
                key={game.slug}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 opacity-60"
              >
                <div className="text-5xl mb-3 grayscale">{game.emoji}</div>
                <h2 className="text-xl font-bold text-white/80 mb-1.5">{game.title}</h2>
                <p className="text-white/40 text-sm mb-4">{game.tagline}</p>
                <span className="inline-block bg-white/10 text-white/50 text-sm font-semibold px-4 py-2 rounded-lg">
                  Coming soon
                </span>
              </div>
            ),
          )}
        </div>

        {/* Private tools */}
        <section className="mt-8 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Gmail Assistant</h2>
            <span
              className={`text-xs font-semibold uppercase tracking-wide border rounded-full px-3 py-1 ${ownerStatusClass}`}
            >
              {ownerStatusLabel}
            </span>
          </div>

          <p className="text-white/70 text-sm sm:text-base mb-5">
            Your personal assistant area for inbox workflows and automations.
          </p>

          <Link
            to="/gmail-assistant"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 hover:brightness-110 transition-all"
          >
            Open Gmail Assistant
            <span className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
          </Link>
        </section>

        {/* Book Recommendations */}
        <section className="mt-6 bg-white/8 backdrop-blur-sm rounded-2xl border border-white/15 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Book Recommendations</h2>
            <span
              className={`text-xs font-semibold uppercase tracking-wide border rounded-full px-3 py-1 ${ownerStatusClass}`}
            >
              {ownerStatusLabel}
            </span>
          </div>

          <p className="text-white/70 text-sm sm:text-base mb-5">
            Search, tier-grade, and track books you've read or want to read — plus AI-powered
            personalized recommendations from your favorites.
          </p>

          <Link
            to="/books"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-950/40 hover:brightness-110 transition-all"
          >
            Open Book Recommendations
            <span className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
          </Link>
        </section>

        <p className="text-center text-white/30 text-xs mt-12">
          More games on the way.
        </p>
      </div>
    </div>
  )
}
