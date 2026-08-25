import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { searchBooks } from '@/lib/books/api/bookSearch'
import { SearchBar } from '@/components/books/search/SearchBar'
import { SearchResultCard } from '@/components/books/search/SearchResultCard'
import { useDebouncedValue } from '@/lib/books/hooks/useDebouncedValue'
import { useBooksStore } from '@/lib/books/store/booksStore'
import type { BookMetadata } from '@/lib/books/types/book'

export const Route = createFileRoute('/books/')({
  component: SearchPage,
})

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookMetadata[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const debouncedQuery = useDebouncedValue(query)

  const addBook = useBooksStore((state) => state.addBook)
  // Subscribe to `books` (not the stable `isTracked` function) so this page re-renders on add.
  const books = useBooksStore((state) => state.books)
  const trackedIds = useMemo(() => new Set(books.map((b) => b.id)), [books])

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!trimmed) {
      setResults([])
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    searchBooks(trimmed)
      .then((books) => {
        if (cancelled) return
        setResults(books)
        setStatus('idle')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Search</h1>
      <SearchBar value={query} onChange={setQuery} />

      {status === 'loading' && (
        <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching...
        </div>
      )}

      {status === 'error' && (
        <p className="mt-8 text-center text-sm text-red-400">
          Something went wrong searching for books. Please try again.
        </p>
      )}

      {status === 'idle' && debouncedQuery.trim() && results.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">No books found for "{debouncedQuery}".</p>
      )}

      {status === 'idle' && !debouncedQuery.trim() && (
        <p className="mt-8 text-center text-sm text-slate-500">
          Start typing to search Google Books and Open Library.
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((book) => (
            <SearchResultCard key={book.id} book={book} tracked={trackedIds.has(book.id)} onAdd={addBook} />
          ))}
        </div>
      )}
    </div>
  )
}
