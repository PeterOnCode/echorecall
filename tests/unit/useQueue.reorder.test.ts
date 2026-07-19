import { describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · The QueuePanel is a drag-and-drop UTable: dragging a row to a new position reorders
// the queue via `useQueue.reorder(orderedClientIds)`. Because the derived Track is the row's
// queue position (stampDerivedMetadata), a reorder renumbers the tracks at generation time.
// reorder is robust to a partial/dirty id list: unknown ids are ignored, and any queue item
// missing from the list keeps its relative order appended after the named ones.
//
// useQueue relies on Nuxt auto-imports (ref/computed/watch); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch

describe('useQueue.reorder (007)', () => {
  it('reorders items to match the given clientId order', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.reorder([c.clientId, a.clientId, b.clientId])
    expect(q.items.value.map((i) => i.text)).toEqual(['c', 'a', 'b'])
  })

  it('renumbers the derived tracks to the new order after a reorder', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    q.reorder([b.clientId, a.clientId])
    q.stampDerivedMetadata(q.items.value)
    expect(b.metadata.track).toBe('1')
    expect(a.metadata.track).toBe('2')
  })

  it('ignores unknown ids and appends items missing from the order (relative order kept)', () => {
    const q = useQueue()
    q.addItem('a')!
    const b = q.addItem('b')!
    q.addItem('c')!
    // Only b is named (plus a bogus id); a and c keep their relative order after b.
    q.reorder([b.clientId, 'not-a-real-id'])
    expect(q.items.value.map((i) => i.text)).toEqual(['b', 'a', 'c'])
  })

  it('keeps per-row state across a reorder (same rows, new order)', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    // A per-row metadata edit on b must survive the reorder unchanged.
    q.updateItem(b.clientId, { metadata: { title: 'Kept' } })
    q.reorder([b.clientId, a.clientId])
    expect(q.items.value.map((i) => i.clientId)).toEqual([b.clientId, a.clientId])
    expect(q.items.value[0]!.metadata.title).toBe('Kept')
  })
})
