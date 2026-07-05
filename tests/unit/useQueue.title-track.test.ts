import { describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · Generate derives Title + Track rather than exposing them as editable fields. Right
// before generation `stampDerivedMetadata` fills each target row's:
//   - Title: the first 60 characters of the row's text, ellipsised when longer, filled only
//     when the row has no title (an imported title survives).
//   - Track: the row's 1-based position in the full queue (what the QueuePanel shows), always
//     refreshed.
//
// useQueue relies on Nuxt auto-imports (ref/computed/watch); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch

describe('useQueue derived Title (007)', () => {
  it('uses the full text as the title when it is 60 characters or fewer', () => {
    const q = useQueue()
    const a = q.addItem('Short line of narration')!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe('Short line of narration')
  })

  it('uses the full text as the title at exactly 60 characters (no ellipsis)', () => {
    const q = useQueue()
    const text = 'x'.repeat(60)
    const a = q.addItem(text)!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe(text)
  })

  it('truncates to the first 60 characters and appends an ellipsis when longer', () => {
    const q = useQueue()
    const text = 'x'.repeat(61)
    const a = q.addItem(text)!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe(`${'x'.repeat(60)}…`)
    expect(a.metadata.title!.length).toBe(61) // 60 chars + the single ellipsis glyph
  })

  it('fills the title only when empty; never overwrites an existing title', () => {
    const q = useQueue()
    const a = q.addItem('some text')!
    q.updateItem(a.clientId, { metadata: { title: 'Kept Title' } })
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe('Kept Title')
  })
})

describe('useQueue derived Track (007)', () => {
  it('stamps each row with its 1-based queue position', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.track).toBe('1')
    expect(b.metadata.track).toBe('2')
    expect(c.metadata.track).toBe('3')
  })

  it('reflects queue position even when only a subset (the generate target) is stamped', () => {
    const q = useQueue()
    q.addItem('a')!
    const b = q.addItem('b')!
    q.addItem('c')!
    // Only the second row is checked → the generate target is just that row, but its track
    // still reflects its position in the full queue (2), not "1".
    q.toggleChecked(b.clientId)
    q.stampDerivedMetadata(q.generateTarget.value)
    expect(b.metadata.track).toBe('2')
  })

  it('always refreshes the track, overwriting any prior value', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    q.updateItem(a.clientId, { metadata: { track: '99' } })
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.track).toBe('1')
  })
})
