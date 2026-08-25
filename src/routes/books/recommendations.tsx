import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { requestRecommendations } from '@/lib/books/api/llm'
import { enrichRecommendations } from '@/lib/books/api/recommendations'
import { RecommendationCard } from '@/components/books/recommendations/RecommendationCard'
import { useBooksStore } from '@/lib/books/store/booksStore'
import { useSettingsStore } from '@/lib/books/store/settingsStore'
import type { EnrichedRecommendation } from '@/lib/books/types/book'

export const Route = createFileRoute('/books/recommendations')({
  component: RecommendationsPage,
})

function RecommendationsPage() {
  const books = useBooksStore((state) => state.books)
  const addBook = useBooksStore((state) => state.addBook)
  const llmSettings = useSettingsStore((state) => state.llm)

  const [recommendations, setRecommendations] = useState<EnrichedRecommendation[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const favoriteBooks = useMemo(
    () => books.filter((b) => b.status === 'read' && (b.tier === 'S' || b.tier === 'A')),
    [books],
  )
  const trackedIds = useMemo(() => new Set(books.map((b) => b.id)), [books])

  async function handleGenerate() {
    setStatus('loading')
    setError(null)
    try {
      const raw = await requestRecommendations(llmSettings, books)
      const enriched = await enrichRecommendations(raw)
      setRecommendations(enriched)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating recommendations.')
      setStatus('error')
    }
  }

  function handleAdd(recommendation: EnrichedRecommendation) {
    if (recommendation.metadata) addBook(recommendation.metadata)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Recommendations</h1>
      <p className="mb-4 text-sm text-slate-400">
        Personalized picks generated from your S and A tier books, notes, and favorite tropes.
      </p>

      {favoriteBooks.length === 0 ? (
        <p className="text-sm text-slate-500">
          Grade at least one book S or A tier on the{' '}
          <Link to="/books/tier-board" className="text-slate-300 underline">
            Tier Board
          </Link>{' '}
          to unlock personalized recommendations.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate recommendations
            </>
          )}
        </button>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}{' '}
          <Link to="/books/settings" className="underline">
            Check your AI settings
          </Link>
          .
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={`${rec.title}:${rec.author}`}
              recommendation={rec}
              tracked={rec.metadata ? trackedIds.has(rec.metadata.id) : false}
              onAdd={handleAdd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
