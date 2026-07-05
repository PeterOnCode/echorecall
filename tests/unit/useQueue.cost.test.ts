import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · US5 (T037 / G-PRICING, FR-018/FR-019): useQueue derives a `queueCost` aggregate —
// a per-item estimate map (keyed by clientId, from item.text.length + item.model), a
// `totalUsd` that sums ONLY estimable amounts (unavailable items are never counted as
// $0), and an `unavailableCount`. Display-only; it never affects the queue or generation.
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

  it('sums only estimable amounts into totalUsd and counts unavailable items', () => {
    const q = useQueue()
    q.model.value = 'tts-1'
    q.addItem('aaaa') // 4 chars · tts-1
    q.model.value = 'gpt-4o-mini-tts'
    q.addItem('bbbb') // unavailable (token-priced)
    q.model.value = 'tts-1-hd'
    q.addItem('cc') // 2 chars · tts-1-hd

    const cost = q.queueCost.value
    expect(cost.unavailableCount).toBe(1)
    expect(cost.totalUsd).toBeCloseTo((4 / 1_000_000) * 15 + (2 / 1_000_000) * 30, 12)
  })

  it('never counts an unavailable item as $0 (total excludes it entirely)', () => {
    const q = useQueue()
    q.model.value = 'gpt-4o-mini-tts'
    q.addItem('x')
    const cost = q.queueCost.value
    expect(cost.totalUsd).toBe(0)
    expect(cost.unavailableCount).toBe(1)
    expect(cost.perItem.get(q.items.value[0]!.clientId)).toBe('unavailable')
  })

  it('is empty for an empty queue', () => {
    const q = useQueue()
    const cost = q.queueCost.value
    expect(cost.perItem.size).toBe(0)
    expect(cost.totalUsd).toBe(0)
    expect(cost.unavailableCount).toBe(0)
  })
})
