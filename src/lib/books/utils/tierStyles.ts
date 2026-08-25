import type { AnyTier } from '../types/book'

/** Tailwind color classes per tier, used by the tier board rows and badges. */
export const TIER_STYLES: Record<AnyTier, { label: string; row: string; badge: string }> = {
  S: {
    label: 'S',
    row: 'border-amber-500/40 bg-amber-500/10',
    badge: 'bg-amber-500 text-amber-950',
  },
  A: {
    label: 'A',
    row: 'border-emerald-500/40 bg-emerald-500/10',
    badge: 'bg-emerald-500 text-emerald-950',
  },
  B: {
    label: 'B',
    row: 'border-sky-500/40 bg-sky-500/10',
    badge: 'bg-sky-500 text-sky-950',
  },
  C: {
    label: 'C',
    row: 'border-violet-500/40 bg-violet-500/10',
    badge: 'bg-violet-500 text-violet-950',
  },
  D: {
    label: 'D',
    row: 'border-rose-500/40 bg-rose-500/10',
    badge: 'bg-rose-500 text-rose-950',
  },
  unranked: {
    label: 'Unranked',
    row: 'border-slate-700 bg-slate-900/60',
    badge: 'bg-slate-700 text-slate-200',
  },
}
