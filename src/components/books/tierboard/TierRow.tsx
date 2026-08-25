import { TIER_STYLES } from '@/lib/books/utils/tierStyles'
import { TierBookCard } from './TierBookCard'
import type { AnyTier, TrackedBook } from '@/lib/books/types/book'

interface TierRowProps {
  tier: AnyTier
  books: TrackedBook[]
  onSelectBook: (book: TrackedBook) => void
}

export function TierRow({ tier, books, onSelectBook }: TierRowProps) {
  const style = TIER_STYLES[tier]

  // "Unranked" is a section header, not a graded tier, so it gets a plain
  // label above the shelf instead of being squeezed into the letter badge.
  if (tier === 'unranked') {
    return (
      <div className="pt-2">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Not yet graded</p>
        {books.length === 0 ? (
          <p className="text-xs text-slate-600">Nothing here — add books from Search to start grading.</p>
        ) : (
          <div className="flex flex-wrap gap-3 rounded-lg border border-dashed border-slate-800 p-3">
            {books.map((book) => (
              <TierBookCard key={book.id} book={book} onClick={onSelectBook} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${style.row}`}>
      <div
        className={`flex h-28 w-14 shrink-0 items-center justify-center rounded-md text-lg font-bold ${style.badge}`}
      >
        {style.label}
      </div>

      {books.length === 0 ? (
        <div className="flex flex-1 items-center text-xs text-slate-500">No books in this tier yet.</div>
      ) : (
        <div className="flex flex-1 flex-wrap gap-3">
          {books.map((book) => (
            <TierBookCard key={book.id} book={book} onClick={onSelectBook} />
          ))}
        </div>
      )}
    </div>
  )
}
