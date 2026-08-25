import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { BookDetailModal } from '@/components/books/tierboard/BookDetailModal'
import { LibraryRow } from '@/components/books/library/LibraryRow'
import { useBooksStore } from '@/lib/books/store/booksStore'
import { TIER_STYLES } from '@/lib/books/utils/tierStyles'
import { SORT_OPTIONS, sortBooks, type SortOption } from '@/lib/books/utils/sortBooks'
import { TIERS } from '@/lib/books/types/book'
import type { AnyTier, TrackedBook } from '@/lib/books/types/book'

export const Route = createFileRoute('/books/library')({
  component: LibraryPage,
})

type LibraryFilter = AnyTier | 'all' | 'want_to_read'

const FILTER_OPTIONS: { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'All books' },
  { value: 'want_to_read', label: 'Want to read' },
  ...TIERS.map((tier) => ({ value: tier as LibraryFilter, label: TIER_STYLES[tier].label })),
  { value: 'unranked', label: 'Not yet graded' },
]

function LibraryPage() {
  const books = useBooksStore((state) => state.books)
  const removeBook = useBooksStore((state) => state.removeBook)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [sort, setSort] = useState<SortOption>('date-desc')
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const byQuery = trimmed
      ? books.filter(
          (b) =>
            b.title.toLowerCase().includes(trimmed) ||
            b.authors.some((a) => a.toLowerCase().includes(trimmed)) ||
            b.genres.some((g) => g.toLowerCase().includes(trimmed)),
        )
      : books
    const byFilter =
      filter === 'all'
        ? byQuery
        : filter === 'want_to_read'
          ? byQuery.filter((b) => b.status === 'want_to_read')
          : byQuery.filter((b) => b.status === 'read' && b.tier === filter)
    return sortBooks(byFilter, sort)
  }, [books, query, filter, sort])

  const editingBook = editingId ? (books.find((b) => b.id === editingId) ?? null) : null

  function handleRemove(book: TrackedBook) {
    if (window.confirm(`Remove "${book.title}" from your library?`)) {
      removeBook(book.id)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Library</h1>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, author, or genre..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pr-4 pl-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LibraryFilter)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-slate-500">
          No books tracked yet. Search for books and add them to your library.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No books match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((book) => (
            <LibraryRow key={book.id} book={book} onEdit={(b) => setEditingId(b.id)} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {editingBook && <BookDetailModal book={editingBook} onClose={() => setEditingId(null)} />}
    </div>
  )
}
