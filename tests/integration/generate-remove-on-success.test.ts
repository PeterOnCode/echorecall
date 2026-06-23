import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useQueue } from '../../app/composables/useQueue'
import { useGeneration } from '../../app/composables/useGeneration'

// US2 generate flow (FR-005a/FR-005b/FR-022): Generate targets the checked items
// when any are checked, otherwise the whole (visible) queue; each successfully
// generated row is removed from the queue while failures stay for retry; and the
// run's successful generation ids remain available for a one-shot batch archive
// download even though their rows have left the queue.
//
// useQueue/useGeneration rely on Nuxt auto-imports (ref/computed) and the global
// $fetch. This node-env integration test wires the real composables together,
// shimming the Vue reactivity globals and stubbing $fetch at the HTTP boundary —
// no Nuxt runtime, no network.

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed

let archiveCalls: string[][]

beforeEach(() => {
  archiveCalls = []
  g.$fetch = vi.fn(async (url: string, opts: { body: { text?: string; ids?: string[] } }) => {
    if (url === '/api/generations') {
      const text = opts.body.text
      if (text === 'boom') throw { data: { error: { message: 'boom failed' } } }
      return { id: `id-${text}`, audioUrl: `/api/generations/id-${text}/audio` }
    }
    if (url === '/api/generations/archive') {
      archiveCalls.push(opts.body.ids ?? [])
      return new Blob(['zip'])
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  // Minimal DOM stubs so downloadArchive's browser side-effects don't crash in node.
  ;(globalThis.URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:test')
  ;(globalThis.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  g.document = {
    body: { appendChild: vi.fn() },
    createElement: () => ({ href: '', download: '', click: vi.fn(), remove: vi.fn() }),
  }
})

describe('Generate target = checked-else-all (FR-005a)', () => {
  it('generates only the checked rows when any are checked, leaving the rest', async () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.toggleChecked(a.clientId)
    q.toggleChecked(c.clientId)

    const gen = useGeneration()
    await gen.generateAll(q.generateTarget.value, q.speed.value, q.removeItem)

    // a and c succeeded → removed; b was never targeted and remains queued.
    expect(q.items.value.map((i) => i.clientId)).toEqual([b.clientId])
    expect(q.items.value[0]!.status).toBe('queued')
  })

  it('targets the whole queue when nothing is checked', async () => {
    const q = useQueue()
    q.addItem('a')
    q.addItem('b')
    expect(q.generateTarget.value).toHaveLength(2)
  })
})

describe('Remove-on-success, retain failures (FR-005b)', () => {
  it('removes each successfully generated row and keeps failed ones', async () => {
    const q = useQueue()
    q.addItem('ok')
    const boom = q.addItem('boom')!

    const gen = useGeneration()
    await gen.generateAll(q.generateTarget.value, q.speed.value, q.removeItem)

    expect(q.items.value.map((i) => i.clientId)).toEqual([boom.clientId])
    expect(q.items.value[0]!.status).toBe('failed')
    expect(q.items.value[0]!.error).toBe('boom failed')
  })
})

describe('Batch archive of the run (FR-022)', () => {
  it("exposes the run's successful ids and downloads them after the rows are removed", async () => {
    const q = useQueue()
    q.addItem('ok1')
    q.addItem('boom')
    q.addItem('ok2')

    const gen = useGeneration()
    await gen.generateAll(q.generateTarget.value, q.speed.value, q.removeItem)

    // The two successes left the queue but their saved ids are retained for download.
    expect(gen.lastBatchIds.value).toEqual(['id-ok1', 'id-ok2'])
    expect(q.items.value.every((i) => i.text === 'boom')).toBe(true)

    await gen.downloadArchive(gen.lastBatchIds.value)
    expect(archiveCalls).toEqual([['id-ok1', 'id-ok2']])
  })

  it('offers no batch when a run yields zero successes', async () => {
    const q = useQueue()
    q.addItem('boom')

    const gen = useGeneration()
    await gen.generateAll(q.generateTarget.value, q.speed.value, q.removeItem)

    expect(gen.lastBatchIds.value).toEqual([])
    await gen.downloadArchive(gen.lastBatchIds.value)
    expect(archiveCalls).toEqual([]) // nothing to download
  })
})
