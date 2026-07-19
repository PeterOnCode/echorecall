import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'
import { useGeneration } from '../../app/composables/useGeneration'
import { useQueue } from '../../app/composables/useQueue'

// 007 · US6 / FR-020: a blank recording date is attached to the individual
// successful generation attempt. Failed rows are restored to blank so a retry on a
// later day gets that later date; explicit user dates are never overwritten.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch

let shouldFail = false
let requestDates: Array<string | undefined> = []

beforeEach(() => {
  shouldFail = false
  requestDates = []
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0))
  g.$fetch = vi.fn(async (_url: string, options: { body: { metadata: { recordedAt?: string } } }) => {
    requestDates.push(options.body.metadata.recordedAt)
    if (shouldFail) throw { data: { error: { message: 'generation failed' } } }
    return { id: 'generated-id', audioUrl: '/audio' }
  })
})

afterEach(() => {
  vi.useRealTimers()
  delete g.$fetch
})

describe('recording-date default at successful generation time', () => {
  it('does not stamp a queue item when it is added', () => {
    const queue = useQueue()
    expect(queue.addItem('a')!.metadata.recordedAt).toBeUndefined()
  })

  it('stamps a blank date for a successful attempt and preserves an explicit date', async () => {
    const queue = useQueue()
    const blank = queue.addItem('blank')!
    const explicit = queue.addItem('explicit')!
    queue.updateItem(explicit.clientId, { metadata: { recordedAt: '2020-01-01' } })
    const generation = useGeneration()

    await generation.generateAll(queue.items.value, queue.speed.value)

    expect(requestDates).toEqual(['2026-07-19', '2020-01-01'])
    expect(blank.metadata.recordedAt).toBe('2026-07-19')
    expect(explicit.metadata.recordedAt).toBe('2020-01-01')
  })

  it('restores a blank date after failure and uses the retry day after success', async () => {
    const queue = useQueue()
    const item = queue.addItem('retry me')!
    const generation = useGeneration()

    shouldFail = true
    await generation.generateAll([item], queue.speed.value)
    expect(requestDates).toEqual(['2026-07-19'])
    expect(item.metadata.recordedAt).toBeUndefined()

    shouldFail = false
    vi.setSystemTime(new Date(2026, 6, 20, 9, 0, 0))
    await generation.generateAll([item], queue.speed.value)

    expect(requestDates).toEqual(['2026-07-19', '2026-07-20'])
    expect(item.metadata.recordedAt).toBe('2026-07-20')
  })

  it('restores an empty-string date exactly when an attempt fails', async () => {
    const queue = useQueue()
    queue.metadata.value = { recordedAt: '' }
    const item = queue.addItem('retry me')!
    const generation = useGeneration()
    shouldFail = true

    await generation.generateAll([item], queue.speed.value)

    expect(item.metadata.recordedAt).toBe('')
  })
})
