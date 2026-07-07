import { createFileRoute, Link } from '@tanstack/react-router'

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
  {
    slug: 'chess-quest',
    title: 'Chess Quest',
    emoji: '♛',
    tagline: 'Explore Chessland with friendly pieces, tiny puzzles, stars and stickers.',
    to: '/chess-quest',
    available: true,
    accent: 'from-amber-400 to-rose-400',
  },
]

function Home() {
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

        <p className="text-center text-white/30 text-xs mt-12">
          More games on the way.
        </p>
      </div>
    </div>
  )
}
