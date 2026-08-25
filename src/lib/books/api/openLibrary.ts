import type { BookMetadata } from '../types/book'

const OPEN_LIBRARY_SEARCH_ENDPOINT = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_COVERS_BASE = 'https://covers.openlibrary.org/b/id'

interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  subject?: string[]
  first_publish_year?: number
  cover_i?: number
  first_sentence?: string[]
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[]
}

function toMetadata(doc: OpenLibraryDoc): BookMetadata {
  return {
    id: `open-library:${doc.key}`,
    source: 'open-library',
    title: doc.title,
    authors: doc.author_name ?? [],
    genres: doc.subject?.slice(0, 5) ?? [],
    publishedYear: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i ? `${OPEN_LIBRARY_COVERS_BASE}/${doc.cover_i}-L.jpg` : null,
    description: doc.first_sentence?.[0] ?? null,
  }
}

/** Search Open Library for a free-text query. Used as a fallback source
 *  when Google Books has no result or is missing a cover image. */
export async function searchOpenLibrary(query: string, limit = 20): Promise<BookMetadata[]> {
  const url = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`)

  const data: OpenLibraryResponse = await res.json()
  return data.docs.map(toMetadata)
}
