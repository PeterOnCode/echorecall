// 006 · R-TAGS — ID3 POPM rating ↔ 0–5 star mapping. POPM stores a 0–255 byte; we
// expose a 0–5 star value in the UI. The byte buckets follow the widely-adopted
// Windows Media / MediaMonkey convention so files round-trip with common players.

/** Star (index) → canonical POPM byte. */
const STAR_TO_POPM = [0, 1, 64, 128, 196, 255] as const

/** Map a 0–5 star rating to its POPM byte (input is rounded + clamped to 0–5). */
export function ratingToPopm(stars: number): number {
  const clamped = Math.max(0, Math.min(5, Math.round(stars)))
  return STAR_TO_POPM[clamped]!
}

/**
 * Map a POPM byte (0–255) back to the nearest 0–5 star rating. Buckets are chosen so
 * every canonical byte round-trips ({@link ratingToPopm} → here → same star count).
 */
export function popmToRating(popm: number): number {
  const b = Math.max(0, Math.min(255, Math.round(popm)))
  if (b <= 0) return 0
  if (b < 32) return 1
  if (b < 96) return 2
  if (b < 160) return 3
  if (b < 224) return 4
  return 5
}
