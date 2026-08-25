import { BookMarked } from 'lucide-react'
import { TierBookCard } from './TierBookCard'
import type { TrackedBook } from '@/lib/books/types/book'

interface WantToReadShelfProps {
  books: TrackedBook[]
  onSelectBook: (book: TrackedBook) => void
}

export function WantToReadShelf({ books, onSelectBook }: WantToReadShelfProps) {
  return (
    <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet-300 uppercase">
        <BookMarked className="h-3.5 w-3.5" /> Want to read
      </p>
      {books.length === 0 ? (
        <p className="text-xs text-slate-600">
          Books you add but haven't read yet land here — mark them read to grade them.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {books.map((book) => (
            <TierBookCard key={book.id} book={book} onClick={onSelectBook} />
          ))}
        </div>
      )}
    </div>
  )
}
