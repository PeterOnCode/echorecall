import { describe, it, expect } from 'vitest'
import { estimateItemCost, MODEL_PRICING } from '../../src/core/tts/pricing'

// 007 · US5 (T036 / G-PRICING, FR-018/FR-019): pure per-item cost estimate. Character-
// priced models return { amountUsd } (sub-cent precision retained); the token-priced
// gpt-4o-mini-tts is 'unavailable' (never a number, never $0). charCount comes from the
// caller (item.text.length). Dependency-free — asserted directly, no repo/network.

describe('MODEL_PRICING', () => {
  it('prices the two character-priced models and marks the token-priced one', () => {
    expect(MODEL_PRICING['tts-1']).toEqual({ usdPerMillionChars: 15 })
    expect(MODEL_PRICING['tts-1-hd']).toEqual({ usdPerMillionChars: 30 })
    expect(MODEL_PRICING['gpt-4o-mini-tts']).toBe('tokenPriced')
  })
})

describe('estimateItemCost', () => {
  it('prices tts-1 at $15 per 1,000,000 characters', () => {
    expect(estimateItemCost('tts-1', 1_000_000)).toEqual({ amountUsd: 15 })
    expect(estimateItemCost('tts-1', 500)).toEqual({ amountUsd: (500 / 1_000_000) * 15 })
  })

  it('prices tts-1-hd at $30 per 1,000,000 characters', () => {
    expect(estimateItemCost('tts-1-hd', 1_000_000)).toEqual({ amountUsd: 30 })
    expect(estimateItemCost('tts-1-hd', 1200)).toEqual({ amountUsd: (1200 / 1_000_000) * 30 })
  })

  it("returns 'unavailable' for the token-priced gpt-4o-mini-tts", () => {
    expect(estimateItemCost('gpt-4o-mini-tts', 1000)).toBe('unavailable')
  })

  it('estimable models cost $0 for empty text; the token-priced one stays unavailable', () => {
    expect(estimateItemCost('tts-1', 0)).toEqual({ amountUsd: 0 })
    expect(estimateItemCost('tts-1-hd', 0)).toEqual({ amountUsd: 0 })
    expect(estimateItemCost('gpt-4o-mini-tts', 0)).toBe('unavailable')
  })
})
