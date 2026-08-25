import { Check, Plus } from 'lucide-react'
import { BookCover } from '../ui/BookCover'
import type { BookMetadata } from '@/lib/books/types/book'

interface SearchResultCardProps {
  book: BookMetadata
  tracked: boolean
  onAdd: (book: BookMetadata) => void
}

export function SearchResultCard({ book, tracked, onAdd }: SearchResultCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <BookCover coverUrl={book.coverUrl} title={book.title} className="h-56 w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100" title={book.title}>
          {book.title}
        </h3>
        <p className="line-clamp-1 text-xs text-slate-400">
          {book.authors.length ? book.authors.join(', ') : 'Unknown author'}
        </p>
        {book.publishedYear && <p className="text-xs text-slate-500">{book.publishedYear}</p>}

        <button
          type="button"
          disabled={tracked}
          onClick={() => onAdd(book)}
          className={`mt-auto flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
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
      </div>
    </div>
  )
}
