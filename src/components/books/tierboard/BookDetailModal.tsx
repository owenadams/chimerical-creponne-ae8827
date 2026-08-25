import { useState } from 'react'
import { BookMarked, Trash2, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { BookCover } from '../ui/BookCover'
import { TIER_STYLES } from '@/lib/books/utils/tierStyles'
import { TIERS } from '@/lib/books/types/book'
import type { AnyTier, TrackedBook } from '@/lib/books/types/book'
import { useBooksStore } from '@/lib/books/store/booksStore'

interface BookDetailModalProps {
  book: TrackedBook
  onClose: () => void
}

const ALL_TIERS: AnyTier[] = [...TIERS, 'unranked']

export function BookDetailModal({ book, onClose }: BookDetailModalProps) {
  const setTier = useBooksStore((s) => s.setTier)
  const markAsRead = useBooksStore((s) => s.markAsRead)
  const updateNotes = useBooksStore((s) => s.updateNotes)
  const removeBook = useBooksStore((s) => s.removeBook)

  const [notes, setNotes] = useState(book.notes)
  const [tropeInput, setTropeInput] = useState('')
  const [tropes, setTropes] = useState<string[]>(book.tropes)

  function commitNotesAndTropes(nextNotes: string, nextTropes: string[]) {
    updateNotes(book.id, nextNotes, nextTropes)
  }

  function addTrope() {
    const trope = tropeInput.trim()
    if (!trope || tropes.includes(trope)) {
      setTropeInput('')
      return
    }
    const next = [...tropes, trope]
    setTropes(next)
    setTropeInput('')
    commitNotesAndTropes(notes, next)
  }

  function removeTrope(trope: string) {
    const next = tropes.filter((t) => t !== trope)
    setTropes(next)
    commitNotesAndTropes(notes, next)
  }

  function handleRemoveBook() {
    removeBook(book.id)
    onClose()
  }

  return (
    <Modal title="Grade & notes" onClose={onClose}>
      <div className="flex gap-4">
        <BookCover coverUrl={book.coverUrl} title={book.title} className="h-32 w-24 shrink-0 rounded-md" />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-100">{book.title}</h3>
          <p className="text-sm text-slate-400">
            {book.authors.length ? book.authors.join(', ') : 'Unknown author'}
          </p>
          {book.publishedYear && <p className="text-xs text-slate-500">{book.publishedYear}</p>}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-slate-400">Tier</p>
        {book.status === 'want_to_read' ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-slate-700 p-3">
            <p className="flex-1 text-xs text-slate-400">
              On your want-to-read list. Mark it as read once you've finished it to grade it.
            </p>
            <button
              type="button"
              onClick={() => markAsRead(book.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              <BookMarked className="h-3.5 w-3.5" /> Mark as read
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ALL_TIERS.map((tier) => {
              const style = TIER_STYLES[tier]
              const active = book.tier === tier
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTier(book.id, tier)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? style.badge : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {style.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="book-notes">
          Notes
        </label>
        <textarea
          id="book-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => commitNotesAndTropes(notes, tropes)}
          rows={3}
          placeholder="What did you love about it?"
          className="w-full resize-none rounded-md border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-slate-400">Favorite tropes</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tropes.map((trope) => (
            <span
              key={trope}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
            >
              {trope}
              <button type="button" onClick={() => removeTrope(trope)} aria-label={`Remove ${trope}`}>
                <X className="h-3 w-3 text-slate-400 hover:text-slate-100" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tropeInput}
          onChange={(e) => setTropeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTrope()
            }
          }}
          onBlur={addTrope}
          placeholder="e.g. enemies to lovers — press Enter to add"
          className="w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleRemoveBook}
        className="mt-5 flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" /> Remove from library
      </button>
    </Modal>
  )
}
