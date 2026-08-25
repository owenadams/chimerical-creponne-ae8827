import { TIERS } from '../types/book'
import type { AnyTier, TrackedBook } from '../types/book'

export type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'author-asc' | 'tier'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Date added (newest)' },
  { value: 'date-asc', label: 'Date added (oldest)' },
  { value: 'title-asc', label: 'Title (A–Z)' },
  { value: 'author-asc', label: 'Author (A–Z)' },
  { value: 'tier', label: 'Tier (best first)' },
]

// Lower rank = better/graded-first; unranked sinks to the bottom.
const TIER_RANK: Record<AnyTier, number> = Object.fromEntries(
  [...TIERS, 'unranked'].map((tier, index) => [tier, index]),
) as Record<AnyTier, number>

export function sortBooks(books: TrackedBook[], sort: SortOption): TrackedBook[] {
  const sorted = [...books]
  switch (sort) {
    case 'date-asc':
      return sorted.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded))
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'author-asc':
      return sorted.sort((a, b) => (a.authors[0] ?? '').localeCompare(b.authors[0] ?? ''))
    case 'tier':
      return sorted.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
    case 'date-desc':
    default:
      return sorted.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
  }
}
