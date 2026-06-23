import { describe, expect, it } from 'vitest'
import { useQueue } from '~/composables/useQueue'

// Foundational queue state for the 005 redesign (data-model §1-2): every row
// records its source (typed text vs an uploaded file, carrying the filename), and
// the composable tracks the active item plus a multi-select set with bulk
// toggle/remove. The reactive state uses Nuxt auto-imports, so — like the existing
// useQueue().updateItem coverage in QueueItemEditor.test.ts — this runs in the
// Nuxt test environment rather than the plain-node unit env.

describe('useQueue – source tracking (005 · T006)', () => {
  it('tags ad-hoc text rows as source "text" with no filename', () => {
    const q = useQueue()
    const item = q.addItem('hello')!
    expect(item.source).toBe('text')
    expect(item.sourceName).toBeUndefined()
  })

  it('tags uploaded rows as source "upload" carrying the filename', () => {
    const q = useQueue()
    q.addFromUpload('one\ntwo', 'notes.txt')
    const uploaded = q.items.value.filter((i) => i.source === 'upload')
    expect(uploaded).toHaveLength(2)
    expect(uploaded.every((i) => i.sourceName === 'notes.txt')).toBe(true)
  })
})

describe('useQueue – selection & active item (005 · T006)', () => {
  it('tracks the active item id (null by default)', () => {
    const q = useQueue()
    const a = q.addItem('x')!
    expect(q.activeId.value).toBeNull()
    q.activeId.value = a.clientId
    expect(q.activeId.value).toBe(a.clientId)
  })

  it('toggles a single row in and out of the checked set', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    q.toggleChecked(a.clientId)
    expect(q.checkedIds.value.has(a.clientId)).toBe(true)
    q.toggleChecked(a.clientId)
    expect(q.checkedIds.value.has(a.clientId)).toBe(false)
  })

  it('toggleAll selects every given row, then clears when all are selected', () => {
    const q = useQueue()
    q.addItem('a')
    q.addItem('b')
    q.toggleAll(q.items.value)
    expect(q.checkedIds.value.size).toBe(2)
    q.toggleAll(q.items.value)
    expect(q.checkedIds.value.size).toBe(0)
  })

  it('removeMany drops rows and clears their selection/active state', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.toggleChecked(a.clientId)
    q.toggleChecked(b.clientId)
    q.activeId.value = a.clientId
    q.removeMany([a.clientId, b.clientId])
    expect(q.items.value.map((i) => i.clientId)).toEqual([c.clientId])
    expect(q.checkedIds.value.size).toBe(0)
    expect(q.activeId.value).toBeNull()
  })
})
