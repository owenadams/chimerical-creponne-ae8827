import { BookCover } from '../ui/BookCover'
import type { TrackedBook } from '@/lib/books/types/book'

interface TierBookCardProps {
  book: TrackedBook
  onClick: (book: TrackedBook) => void
}

export function TierBookCard({ book, onClick }: TierBookCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(book)}
      title={book.title}
      className="group w-20 shrink-0 text-left focus:outline-none"
    >
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        className="h-28 w-20 rounded-md border border-slate-800 transition-transform group-hover:scale-105 group-hover:border-slate-500"
      />
      <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-300">{book.title}</p>
    </button>
  )
}
