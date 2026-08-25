import type { BookMetadata } from '../types/book'

const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes'

interface GoogleVolumeInfo {
  title: string
  authors?: string[]
  categories?: string[]
  publishedDate?: string
  description?: string
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
}

interface GoogleVolume {
  id: string
  volumeInfo: GoogleVolumeInfo
}

interface GoogleBooksResponse {
  items?: GoogleVolume[]
}

function toMetadata(volume: GoogleVolume): BookMetadata {
  const info = volume.volumeInfo
  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  return {
    id: `google-books:${volume.id}`,
    source: 'google-books',
    title: info.title,
    authors: info.authors ?? [],
    genres: info.categories ?? [],
    publishedYear: Number.isFinite(year) ? year : null,
    // Google serves cover thumbnails over http; upgrade to https to avoid mixed-content blocks.
    coverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null,
    description: info.description ?? null,
  }
}

/** Search Google Books for a free-text query (title, author, etc.). */
export async function searchGoogleBooks(query: string, maxResults = 20): Promise<BookMetadata[]> {
  const url = new URL(GOOGLE_BOOKS_ENDPOINT)
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Books search failed: ${res.status}`)

  const data: GoogleBooksResponse = await res.json()
  return (data.items ?? []).map(toMetadata)
}
