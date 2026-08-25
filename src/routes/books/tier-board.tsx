import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { TierRow } from '@/components/books/tierboard/TierRow'
import { WantToReadShelf } from '@/components/books/tierboard/WantToReadShelf'
import { BookDetailModal } from '@/components/books/tierboard/BookDetailModal'
import { useBooksStore } from '@/lib/books/store/booksStore'
import { TIERS } from '@/lib/books/types/book'
import type { AnyTier, TrackedBook } from '@/lib/books/types/book'

export const Route = createFileRoute('/books/tier-board')({
  component: TierBoardPage,
})

const ALL_TIERS: AnyTier[] = [...TIERS, 'unranked']

function TierBoardPage() {
  const books = useBooksStore((state) => state.books)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const wantToRead = useMemo(() => books.filter((b) => b.status === 'want_to_read'), [books])

  const grouped = useMemo(() => {
    const map = new Map<AnyTier, TrackedBook[]>(ALL_TIERS.map((tier) => [tier, []]))
    for (const book of books) {
      if (book.status === 'read') map.get(book.tier)?.push(book)
    }
    return map
  }, [books])

  // Look up the live book by id (rather than holding a stale object) so the modal
  // always reflects the latest tier/notes even as the store updates.
  const selectedBook = selectedId ? (books.find((b) => b.id === selectedId) ?? null) : null

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Tier Board</h1>

      {books.length === 0 ? (
        <p className="text-sm text-slate-500">
          No books tracked yet. Search for books and add them to your library to start grading.
        </p>
      ) : (
        <>
          <WantToReadShelf books={wantToRead} onSelectBook={(b) => setSelectedId(b.id)} />
          <div className="space-y-3">
            {ALL_TIERS.map((tier) => (
              <TierRow
                key={tier}
                tier={tier}
                books={grouped.get(tier) ?? []}
                onSelectBook={(b) => setSelectedId(b.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectedBook && <BookDetailModal book={selectedBook} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
