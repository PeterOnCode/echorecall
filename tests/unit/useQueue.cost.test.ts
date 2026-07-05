import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · US5 (T037 / G-PRICING, FR-018/FR-019): useQueue derives a `queueCost` aggregate —
// a per-item estimate map (keyed by clientId, from item.text + item.model), a `totalUsd`
// that sums ONLY estimable amounts (any unavailable/unknown-model item is never counted as
// $0), and an `unavailableCount`. All three real models are now estimable (gpt-4o-mini-tts
// via its audio-duration model). Display-only; it never affects the queue or generation.
//
// useQueue relies on Nuxt auto-imports (ref/computed); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed

describe('useQueue queueCost (US5)', () => {
  it('maps a per-item estimate by clientId from text length and the row model', () => {
    const q = useQueue()
    q.model.value = 'tts-1'
    const a = q.addItem('hello')! // 5 chars
    const cost = q.queueCost.value
    expect(cost.perItem.get(a.clientId)).toEqual({ amountUsd: (5 / 1_000_000) * 15 })
  })

  it('sums every estimable model into totalUsd, including gpt-4o-mini-tts', () => {
    const q = useQueue()
    q.model.value = 'tts-1'
    q.addItem('aaaa') // 4 chars · tts-1
    q.model.value = 'gpt-4o-mini-tts'
    q.addItem('bbbb') // 1 word · audio-duration estimate
    q.model.value = 'tts-1-hd'
    q.addItem('cc') // 2 chars · tts-1-hd

    // gpt-4o-mini-tts 'bbbb': 1 word → 1/150 min audio + ⌈4/4⌉=1 text token
    const gptCost = (1 / 150) * 0.015 + (1 / 1_000_000) * 0.6
    const cost = q.queueCost.value
    expect(cost.unavailableCount).toBe(0)
    expect(cost.totalUsd).toBeCloseTo((4 / 1_000_000) * 15 + gptCost + (2 / 1_000_000) * 30, 12)
  })

  it('gives gpt-4o-mini-tts a positive per-item estimate (no longer unavailable)', () => {
    const q = useQueue()
    q.model.value = 'gpt-4o-mini-tts'
    q.addItem('hello world')
    const cost = q.queueCost.value
    const est = cost.perItem.get(q.items.value[0]!.clientId)
    expect(est).not.toBe('unavailable')
    expect((est as { amountUsd: number }).amountUsd).toBeGreaterThan(0)
    expect(cost.totalUsd).toBeGreaterThan(0)
    expect(cost.unavailableCount).toBe(0)
  })

  it('is empty for an empty queue', () => {
    const q = useQueue()
    const cost = q.queueCost.value
    expect(cost.perItem.size).toBe(0)
    expect(cost.totalUsd).toBe(0)
    expect(cost.unavailableCount).toBe(0)
  })
})
