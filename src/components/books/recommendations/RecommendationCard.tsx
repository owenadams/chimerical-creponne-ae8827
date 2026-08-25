import { Check, Plus, Sparkles } from 'lucide-react'
import { BookCover } from '../ui/BookCover'
import type { EnrichedRecommendation } from '@/lib/books/types/book'

interface RecommendationCardProps {
  recommendation: EnrichedRecommendation
  tracked: boolean
  onAdd: (recommendation: EnrichedRecommendation) => void
}

export function RecommendationCard({ recommendation, tracked, onAdd }: RecommendationCardProps) {
  const { metadata } = recommendation

  return (
    <div className="flex gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <BookCover
        coverUrl={metadata?.coverUrl ?? null}
        title={recommendation.title}
        className="h-36 w-24 shrink-0 rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-sm font-semibold text-slate-100">{recommendation.title}</h3>
        <p className="text-xs text-slate-400">{recommendation.author}</p>

        <p className="mt-2 flex gap-1.5 text-xs text-slate-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
          <span>{recommendation.reason}</span>
        </p>

        {metadata?.description && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{metadata.description}</p>
        )}

        <div className="mt-auto pt-3">
          {metadata ? (
            <button
              type="button"
              disabled={tracked}
              onClick={() => onAdd(recommendation)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tracked
                  ? 'cursor-default bg-emerald-900/40 text-emerald-400'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {tracked ? (
                <>
                  <Check className="h-3.5 w-3.5" /> In library
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Add to library
                </>
              )}
            </button>
          ) : (
            <p className="text-xs text-slate-600">No verified catalog match found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
