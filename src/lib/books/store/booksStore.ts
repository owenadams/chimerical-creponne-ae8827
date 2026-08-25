import { create } from 'zustand'
import { db } from './db'
import type { AnyTier, BookMetadata, ReadStatus, TrackedBook } from '../types/book'

interface BooksState {
  books: TrackedBook[]
  loaded: boolean
  loadBooks: () => Promise<void>
  addBook: (metadata: BookMetadata, status?: ReadStatus) => Promise<void>
  setTier: (id: string, tier: AnyTier) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  updateNotes: (id: string, notes: string, tropes: string[]) => Promise<void>
  removeBook: (id: string) => Promise<void>
  isTracked: (id: string) => boolean
}

export const useBooksStore = create<BooksState>((set, get) => ({
  books: [],
  loaded: false,

  loadBooks: async () => {
    const books = await db.books.toArray()
    set({ books, loaded: true })
  },

  // Defaults to "want to read": adding a book (from Search or Recommendations) means
  // you're interested in it, not that you've already read and can grade it.
  addBook: async (metadata, status = 'want_to_read') => {
    if (get().isTracked(metadata.id)) return
    const now = new Date().toISOString()
    const book: TrackedBook = {
      ...metadata,
      status,
      tier: 'unranked',
      notes: '',
      tropes: [],
      dateAdded: now,
      dateUpdated: now,
    }
    await db.books.add(book)
    set((state) => ({ books: [...state.books, book] }))
  },

  setTier: async (id, tier) => {
    const dateUpdated = new Date().toISOString()
    // Assigning a real tier only makes sense once you've read the book.
    const status: ReadStatus = tier === 'unranked' ? get().books.find((b) => b.id === id)!.status : 'read'
    await db.books.update(id, { tier, status, dateUpdated })
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? { ...b, tier, status, dateUpdated } : b)),
    }))
  },

  markAsRead: async (id) => {
    const dateUpdated = new Date().toISOString()
    await db.books.update(id, { status: 'read', dateUpdated })
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? { ...b, status: 'read', dateUpdated } : b)),
    }))
  },

  updateNotes: async (id, notes, tropes) => {
    const dateUpdated = new Date().toISOString()
    await db.books.update(id, { notes, tropes, dateUpdated })
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? { ...b, notes, tropes, dateUpdated } : b)),
    }))
  },

  removeBook: async (id) => {
    await db.books.delete(id)
    set((state) => ({ books: state.books.filter((b) => b.id !== id) }))
  },

  isTracked: (id) => get().books.some((b) => b.id === id),
}))
