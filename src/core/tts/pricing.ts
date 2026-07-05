import type { Model } from '../shared/types'

// 007 · US5 (G-PRICING, FR-018/FR-019): pure, dependency-free per-item cost estimation.
// Character-priced models (`tts-1`, `tts-1-hd`) have a published $/1M-characters rate;
// the token-priced `gpt-4o-mini-tts` cannot be estimated from character count and is
// reported 'unavailable' (never a number, never $0). Lives in the core so it is
// CLI-reachable and re-exported through the client subset for the Generate editor.

/**
 * USD per 1,000,000 characters for character-priced models; the token-priced model is
 * marked `'tokenPriced'` (no character-based rate). Approximate published TTS rates.
 */
export const MODEL_PRICING: Readonly<
  Record<Model, { usdPerMillionChars: number } | 'tokenPriced'>
> = {
  'tts-1': { usdPerMillionChars: 15 },
  'tts-1-hd': { usdPerMillionChars: 30 },
  'gpt-4o-mini-tts': 'tokenPriced',
}

/** A per-item estimate: a dollar amount, or `'unavailable'` for token-priced models. */
export type CostEstimate = { amountUsd: number } | 'unavailable'

/**
 * Estimate one item's cost from its model and character count. Estimable models return
 * `{ amountUsd }` (sub-cent precision retained; empty text → `{ amountUsd: 0 }`);
 * token-priced (or unknown) models return `'unavailable'` — never a number, so an
 * unavailable item is never mistaken for a free one.
 */
export function estimateItemCost(model: Model, charCount: number): CostEstimate {
  const pricing = MODEL_PRICING[model]
  if (!pricing || pricing === 'tokenPriced') return 'unavailable'
  return { amountUsd: (charCount / 1_000_000) * pricing.usdPerMillionChars }
}
