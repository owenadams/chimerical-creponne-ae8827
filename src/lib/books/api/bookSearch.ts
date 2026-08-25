import type { BookMetadata } from '../types/book'
import { searchGoogleBooks } from './googleBooks'
import { searchOpenLibrary } from './openLibrary'

/** Search Google Books first (better cover quality); fall back to / merge in
 *  Open Library results so users still get hits when Google has none or is
 *  missing a cover. Results are de-duplicated by normalized title+author. */
export async function searchBooks(query: string): Promise<BookMetadata[]> {
  const [googleResults, openLibraryResults] = await Promise.allSettled([
    searchGoogleBooks(query),
    searchOpenLibrary(query),
  ])

  const google = googleResults.status === 'fulfilled' ? googleResults.value : []
  const openLibrary = openLibraryResults.status === 'fulfilled' ? openLibraryResults.value : []

  const seen = new Set<string>()
  const merged: BookMetadata[] = []

  for (const book of [...google, ...openLibrary]) {
    const key = `${book.title.trim().toLowerCase()}::${book.authors[0]?.trim().toLowerCase() ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(book)
  }

  return merged
}
