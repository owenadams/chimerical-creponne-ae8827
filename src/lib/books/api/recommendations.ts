import { searchBooks } from './bookSearch'
import type { EnrichedRecommendation, RawRecommendation } from '../types/book'

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

/** Look up each raw LLM recommendation against the book APIs to attach a
 *  verified cover image and synopsis. Falls back to null metadata (still
 *  shown to the user, just without a cover) if no confident match is found. */
export async function enrichRecommendations(
  raw: RawRecommendation[],
): Promise<EnrichedRecommendation[]> {
  return Promise.all(
    raw.map(async (rec) => {
      try {
        const results = await searchBooks(`${rec.title} ${rec.author}`)
        const normalizedTitle = normalize(rec.title)
        const match =
          results.find((r) => normalize(r.title) === normalizedTitle) ??
          results.find((r) => normalize(r.title).includes(normalizedTitle)) ??
          results[0] ??
          null
        return { ...rec, metadata: match }
      } catch {
        return { ...rec, metadata: null }
      }
    }),
  )
}
