import { Pencil, Trash2 } from 'lucide-react'
import { BookCover } from '../ui/BookCover'
import { TIER_STYLES } from '@/lib/books/utils/tierStyles'
import type { TrackedBook } from '@/lib/books/types/book'

interface LibraryRowProps {
  book: TrackedBook
  onEdit: (book: TrackedBook) => void
  onRemove: (book: TrackedBook) => void
}

export function LibraryRow({ book, onEdit, onRemove }: LibraryRowProps) {
  const tierStyle = TIER_STYLES[book.tier]

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <BookCover coverUrl={book.coverUrl} title={book.title} className="h-16 w-11 shrink-0 rounded" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{book.title}</p>
        <p className="truncate text-xs text-slate-400">
          {book.authors.length ? book.authors.join(', ') : 'Unknown author'}
        </p>
        <p className="text-xs text-slate-500">
          {book.genres[0] ?? 'Uncategorized'}
          {book.publishedYear ? ` · ${book.publishedYear}` : ''}
        </p>
      </div>

      <span
        className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${
          book.status === 'want_to_read' ? 'bg-violet-500/20 text-violet-300' : tierStyle.badge
        }`}
      >
        {book.status === 'want_to_read' ? 'Want to read' : tierStyle.label}
      </span>

      <p className="hidden w-24 shrink-0 text-right text-xs text-slate-500 md:block">
        {new Date(book.dateAdded).toLocaleDateString()}
      </p>

      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onEdit(book)}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label={`Edit ${book.title}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(book)}
          className="rounded-md p-2 text-slate-400 hover:bg-red-950 hover:text-red-400"
          aria-label={`Remove ${book.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
