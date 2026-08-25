/** Core domain models shared across the app. */

/** Classic tier-list grades, ordered from best to worst. */
export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
export type Tier = (typeof TIERS)[number]

/** A tier a book has not yet been graded into. */
export type UngradedTier = 'unranked'

export type AnyTier = Tier | UngradedTier

/** Source used to look up a book's metadata/cover. */
export type BookSource = 'google-books' | 'open-library'

/** Whether a tracked book has been read (and is therefore gradable) or is
 *  still on the user's want-to-read queue. */
export type ReadStatus = 'want_to_read' | 'read'

/** Normalized book metadata, regardless of which API it came from. */
export interface BookMetadata {
  /** Stable id, prefixed with source so ids never collide across APIs. */
  id: string
  source: BookSource
  title: string
  authors: string[]
  genres: string[]
  publishedYear: number | null
  coverUrl: string | null
  description: string | null
}

/** A book the user has added to their tracked library. */
export interface TrackedBook extends BookMetadata {
  status: ReadStatus
  tier: AnyTier
  notes: string
  tropes: string[]
  dateAdded: string
  dateUpdated: string
}

/** Structured recommendation returned by the LLM, before cover lookup. */
export interface RawRecommendation {
  title: string
  author: string
  reason: string
}

/** Recommendation after being matched against a book API for cover/synopsis. */
export interface EnrichedRecommendation extends RawRecommendation {
  metadata: BookMetadata | null
}
